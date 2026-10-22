import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllowance } from '@/lib/consultant/plans'
import { buildContext, tickersFor } from '@/lib/consultant/context'
import { CONSULTANT_BASE, TIER_STYLE } from '@/lib/consultant/prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'claude-opus-5-5'
const MAX_TURNS = 20          // history sent per request (keeps cost bounded)
const MAX_CHARS = 2000        // per message

interface ChatTurn { role: 'user' | 'assistant'; content: string }

function parseTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const turns = raw.slice(-MAX_TURNS)
  for (const t of turns) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string' || !t.content.trim()) return null
  }
  // Must start and end with the user
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null
  return turns.map(t => ({ role: t.role, content: t.content.slice(0, MAX_CHARS) }))
}

/**
 * POST /api/consultant — the paid AI Consultant. Streams plain text.
 * Body: { messages: ChatTurn[], focus?: string }  (focus = ticker on screen)
 * 402 + allowance JSON when the user is out of questions.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const turns = parseTurns(body?.messages)
  if (!turns) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const focus = typeof body?.focus === 'string' ? body.focus.toUpperCase().slice(0, 6) : null

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const allowance = await getAllowance(supabase, user.id)
  if (allowance.remaining <= 0) return NextResponse.json({ error: 'limit', allowance }, { status: 402 })

  // Metering goes through the service role: users can read their usage but never write it
  const admin = createAdminClient()
  const { data: usageRow } = await admin.from('ai_usage').insert({ user_id: user.id, model: MODEL }).select('id').single()
  const markUsage = (patch: Record<string, unknown>) =>
    usageRow ? admin.from('ai_usage').update(patch).eq('id', usageRow.id) : Promise.resolve()

  const question = turns[turns.length - 1].content
  const context = await buildContext(supabase, user.id, tickersFor(question, focus))

  // Context rides in the latest user turn only; earlier turns are sent as plain text
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) =>
    i === turns.length - 1
      ? { role: 'user', content: [
          { type: 'text', text: `<marketjump_context>\n${context.text}\n</marketjump_context>` },
          { type: 'text', text: t.content },
        ] }
      : { role: t.role, content: t.content },
  )

  const client = new Anthropic()
  // `fallbacks` isn't in this SDK version's types yet; the SDK forwards it unchanged.
  // If a safety classifier declines, the API re-runs on Anthropic's recommended model.
  const params: BetaMessageStreamParams & { fallbacks: 'default' } = {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: CONSULTANT_BASE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: TIER_STYLE[context.level] ?? TIER_STYLE.rookie },
    ],
    messages,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = client.beta.messages.stream(params)
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await response.finalMessage()
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\nI can’t help with that one. Try asking about a stock, your calls, or how markets work.'))
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('\n\n(Answer cut short. Ask me to continue.)'))
        }
        await markUsage({
          status: final.stop_reason === 'refusal' ? 'failed' : 'completed',
          model: final.model,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_read_tokens: final.usage.cache_read_input_tokens ?? 0,
        })
      } catch (err) {
        console.error('[consultant] error:', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err)
        // Failed answers don't count against the allowance
        await markUsage({ status: 'failed' })
        const busy = err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)
        controller.enqueue(encoder.encode(busy
          ? '\n\nThe consultant is busy right now. Please try again in a moment. (This question wasn’t counted.)'
          : '\n\nSomething went wrong answering that. Please try again. (This question wasn’t counted.)'))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Questions-Remaining': String(allowance.remaining - 1),
      'X-Plan': allowance.plan,
    },
  })
}

/** GET /api/consultant — the user's plan and remaining questions */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ allowance: await getAllowance(supabase, user.id) })
}

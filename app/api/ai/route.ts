import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPTS: Record<string, string> = {
  rookie: `You are MarketJump's market analyst. The user is a ROOKIE investor learning the ropes.
Rules:
- Use real financial terms but immediately define them inline in parentheses
- Structure: 1) What's happening 2) Why it matters 3) What to watch
- Teach while explaining — no condescension, but no assumed knowledge
- Be specific: name the metric, the number, the implication
- No filler phrases like "it's worth noting" or "this is interesting"
- Max 4 short paragraphs

End with: Public information and opinion only. Not financial advice.`,

  analyst: `You are MarketJump's market analyst. The user is an ANALYST with solid market knowledge.
Rules:
- Lead with the core thesis in one sentence
- Focus on: catalysts, risk/reward, key metrics, sector context
- Reference specific data points from the card
- Skip basic definitions — assume the user knows what P/E, YoY, basis points mean
- Be direct. No hedging language.
- Max 3 focused paragraphs

End with: Public information and opinion only. Not financial advice.`,

  shark: `You are MarketJump's market analyst. The user is a SHARK — institutional-level thinker.
Rules:
- Tight, technical, zero fluff
- Lead with the trade implication, not the news
- Cover: positioning, flow signals, macro context, options/derivatives angle if relevant
- Use precise language: "risk-off rotation", "spread compression", "vol regime"
- If the analysis is vague, say nothing — only output high-conviction insight
- Max 2 dense paragraphs

End with: Public information and opinion only. Not financial advice.`,
}

function buildCardPrompt(body: {
  cardType: string
  ticker: string
  headline: string
  summary: string
  changePercent?: number
  source: string
  level: string
}): string {
  const { cardType, ticker, headline, summary, changePercent, source, level } = body

  if (cardType === 'stock') {
    return `Ticker: ${ticker}
Price change: ${changePercent ?? 0}%
Headline: ${headline}
Summary: ${summary}
Source: ${source}
User level: ${level}
Generate a ${level}-appropriate market analysis of this stock movement. Keep it under 200 words.`
  }

  if (cardType === 'social') {
    return `Post content: ${summary}
Ticker mentioned: ${ticker}
User level: ${level}
Analyze the validity of this market opinion for a ${level} user. Keep it under 200 words.`
  }

  return `Headline: ${headline}
Summary: ${summary}
Event category: macro
User level: ${level}
Explain the market impact of this macro event for a ${level} user. Cover which sectors, currencies, and specific tickers may be affected. Keep it under 200 words.`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set')
    return NextResponse.json({ analysis: null, error: 'no_key' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const userPrompt = buildCardPrompt(body)
    const levelKey = (body.level ?? 'rookie').toLowerCase()
    const systemPrompt = SYSTEM_PROMPTS[levelKey] ?? SYSTEM_PROMPTS.rookie

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ analysis })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI route error:', message)

    // Distinguish credit/auth errors from transient failures
    const isAuthErr = message.includes('401') || message.includes('403') || message.includes('credit')
    return NextResponse.json(
      { analysis: null, error: isAuthErr ? 'no_credits' : 'unavailable' },
      { status: isAuthErr ? 402 : 503 }
    )
  }
}

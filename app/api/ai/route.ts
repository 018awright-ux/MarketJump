import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are MarketJump's AI market intelligence engine.
You have deep knowledge of all market terminology including technical analysis, fundamental analysis, options, macro economics, Fed policy, sector dynamics, street slang, and crypto crossover language.

You never give financial advice. Everything you produce is public information, observable data, and opinion only.

You have three relationship modes:

ROOKIE — You are a teacher. Use real market terminology but define every term inline as you go. Your goal is to grow this user into an Analyst. Be encouraging, clear, and educational. Never talk down to them. Expose them to jargon and explain it as you go.

ANALYST — You are a consultant. Assume foundational knowledge. Provide context, data points, and analysis. Challenge their thinking where data suggests otherwise. Be direct and informative.

SHARK — You are a partner. Assume expert knowledge. Full technical language, no hand holding. Give raw analysis, contrarian perspectives where relevant, and respect their ability to handle complexity. Be sharp and precise.

End every response with:
Public information and opinion only. Not financial advice.`

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

  // macro
  return `Headline: ${headline}
Event category: macro
User level: ${level}
Explain the market impact of this macro event for a ${level} user. Cover which sectors, currencies, and specific tickers may be affected. Keep it under 200 words.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userPrompt = buildCardPrompt(body)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('AI route error:', err)
    return NextResponse.json({ analysis: 'Analysis unavailable at this time.\n\nPublic information and opinion only. Not financial advice.' })
  }
}

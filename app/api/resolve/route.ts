import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuote } from '@/lib/finnhub'

const SCORE_CORRECT = 50    // points earned for a correct call
const SCORE_INCORRECT = 20  // points lost for an incorrect call

// GET /api/resolve — resolve expired predictions for the current user
// Safe to call on every profile load; only processes unresolved, expired predictions
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date().toISOString()

    // Get all expired, unresolved predictions for this user
    const { data: pending, error } = await supabase
      .from('predictions')
      .select('id, ticker, prediction, price_at_prediction')
      .eq('user_id', user.id)
      .eq('resolved', false)
      .lte('resolution_date', now)

    if (error || !pending?.length) {
      return NextResponse.json({ resolved: 0 })
    }

    // Fetch current prices for each unique ticker (batched)
    const tickers = [...new Set(pending.map(p => p.ticker))]
    const quoteMap: Record<string, number> = {}

    await Promise.allSettled(
      tickers.map(async ticker => {
        const quote = await getQuote(ticker)
        if (quote?.c) quoteMap[ticker] = quote.c
      })
    )

    // Determine result for each prediction
    let correct = 0
    let incorrect = 0

    const updates = pending.map(pred => {
      const currentPrice = quoteMap[pred.ticker]
      if (!currentPrice) {
        // Can't resolve without a price — extend by 1 day and try again later
        const newResolution = new Date()
        newResolution.setDate(newResolution.getDate() + 1)
        return supabase
          .from('predictions')
          .update({ resolution_date: newResolution.toISOString() })
          .eq('id', pred.id)
      }

      const priceDiff = currentPrice - pred.price_at_prediction
      let result: 'correct' | 'incorrect'

      if (pred.prediction === 'bullish') {
        result = priceDiff > 0 ? 'correct' : 'incorrect'
      } else {
        result = priceDiff < 0 ? 'correct' : 'incorrect'
      }

      if (result === 'correct') correct++
      else incorrect++

      return supabase
        .from('predictions')
        .update({ resolved: true, result })
        .eq('id', pred.id)
    })

    await Promise.allSettled(updates)

    if (correct === 0 && incorrect === 0) {
      return NextResponse.json({ resolved: 0 })
    }

    // Update profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('market_score, total_predictions, correct_predictions')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newCorrect = (profile.correct_predictions ?? 0) + correct
      const newTotal = profile.total_predictions ?? 0
      const accuracy = newTotal > 0 ? Math.round((newCorrect / newTotal) * 100 * 10) / 10 : 0
      const scoreDelta = correct * SCORE_CORRECT - incorrect * SCORE_INCORRECT
      const newScore = Math.max(0, (profile.market_score ?? 0) + scoreDelta)

      await supabase
        .from('profiles')
        .update({
          correct_predictions: newCorrect,
          accuracy,
          market_score: newScore,
        })
        .eq('id', user.id)

      // Insert notifications for resolved predictions
      try {
        const notifRows = []
        if (correct > 0) {
          notifRows.push({
            user_id: user.id,
            type: 'prediction',
            title: `${correct} prediction${correct > 1 ? 's' : ''} resolved ✅`,
            body: `Your correct call${correct > 1 ? 's' : ''} earned you +${correct * SCORE_CORRECT} pts`,
          })
        }
        if (incorrect > 0) {
          notifRows.push({
            user_id: user.id,
            type: 'prediction',
            title: `${incorrect} prediction${incorrect > 1 ? 's' : ''} resolved ❌`,
            body: `Your incorrect call${incorrect > 1 ? 's' : ''} cost you -${incorrect * SCORE_INCORRECT} pts`,
          })
        }
        if (notifRows.length) {
          await supabase.from('notifications').insert(notifRows)
        }
      } catch { /* notifications table may not exist yet */ }
    }

    return NextResponse.json({ resolved: correct + incorrect, correct, incorrect })
  } catch (err) {
    console.error('Resolve error:', err)
    return NextResponse.json({ resolved: 0, error: 'Resolution failed' })
  }
}

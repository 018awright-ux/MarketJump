import type { SupabaseClient } from '@supabase/supabase-js'
import { getQuote } from '@/lib/finnhub'

export const SCORE_CORRECT = 50   // points earned for a correct call
export const SCORE_INCORRECT = 20 // points lost for an incorrect call

interface DuePrediction {
  id: string
  user_id: string
  ticker: string
  prediction: 'bullish' | 'bearish'
  price_at_prediction: number
}

export interface ResolveSummary {
  resolved: number
  correct: number
  incorrect: number
  deferred: number
  users: number
}

/**
 * Score every Move whose resolution date has passed.
 * - Judgment Day cron: service-role client, all users
 * - Profile load: the user's own session client + userId (RLS limits it to their rows)
 */
export async function resolveDuePredictions(
  supabase: SupabaseClient,
  { userId }: { userId?: string } = {},
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { resolved: 0, correct: 0, incorrect: 0, deferred: 0, users: 0 }

  let query = supabase
    .from('predictions')
    .select('id, user_id, ticker, prediction, price_at_prediction')
    .eq('resolved', false)
    .lte('resolution_date', new Date().toISOString())
    // Moves saved without a real entry price can't be scored fairly — leave them out
    .gt('price_at_prediction', 0)
    .limit(5000)
  if (userId) query = query.eq('user_id', userId)

  const { data: due, error } = await query
  if (error || !due?.length) return summary

  // One quote per ticker, in small batches to stay inside Finnhub's rate limit
  const tickers = [...new Set((due as DuePrediction[]).map(p => p.ticker))]
  const prices: Record<string, number> = {}
  for (let i = 0; i < tickers.length; i += 20) {
    await Promise.allSettled(tickers.slice(i, i + 20).map(async t => {
      const q = await getQuote(t)
      if (q?.c > 0) prices[t] = q.c
    }))
  }

  const perUser: Record<string, { correct: number; incorrect: number }> = {}
  const tomorrow = new Date(Date.now() + 86400_000).toISOString()

  await Promise.allSettled((due as DuePrediction[]).map(async pred => {
    const price = prices[pred.ticker]
    if (!price) {
      // No price right now — try again on the next run
      summary.deferred++
      await supabase.from('predictions').update({ resolution_date: tomorrow }).eq('id', pred.id)
      return
    }
    const diff = price - Number(pred.price_at_prediction)
    const result = (pred.prediction === 'bullish' ? diff > 0 : diff < 0) ? 'correct' : 'incorrect'
    const { data: updated } = await supabase
      .from('predictions')
      .update({ resolved: true, result, price_at_resolution: price })
      .eq('id', pred.id)
      .eq('resolved', false) // if another run scored it first, nothing updates
      .select('id')
    // Only count Moves this run actually scored, so points are never applied twice
    if (!updated?.length) return
    const u = (perUser[pred.user_id] ??= { correct: 0, incorrect: 0 })
    u[result]++
    summary[result]++
  }))

  summary.resolved = summary.correct + summary.incorrect
  summary.users = Object.keys(perUser).length

  for (const [uid, { correct, incorrect }] of Object.entries(perUser)) {
    await updateProfileStats(supabase, uid, correct, incorrect)
  }
  return summary
}

async function updateProfileStats(supabase: SupabaseClient, uid: string, correct: number, incorrect: number) {
  // Accuracy = correct / scored Moves (pending Moves don't count against you)
  const [{ count: correctCount }, { count: scoredCount }, { data: profile }] = await Promise.all([
    supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('result', 'correct'),
    supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('resolved', true),
    supabase.from('profiles').select('market_score').eq('id', uid).single(),
  ])
  const scored = scoredCount ?? 0
  const delta = correct * SCORE_CORRECT - incorrect * SCORE_INCORRECT

  await supabase.from('profiles').update({
    correct_predictions: correctCount ?? 0,
    accuracy: scored > 0 ? Math.round(((correctCount ?? 0) / scored) * 1000) / 10 : 0,
    market_score: Math.max(0, (profile?.market_score ?? 0) + delta),
  }).eq('id', uid)

  try {
    const rows = []
    if (correct > 0) rows.push({
      user_id: uid, type: 'prediction', href: '/profile',
      title: `${correct} Move${correct > 1 ? 's' : ''} called right ✅`,
      body: `Judgment Day: +${correct * SCORE_CORRECT} pts`,
    })
    if (incorrect > 0) rows.push({
      user_id: uid, type: 'prediction', href: '/profile',
      title: `${incorrect} Move${incorrect > 1 ? 's' : ''} missed ❌`,
      body: `Judgment Day: -${incorrect * SCORE_INCORRECT} pts`,
    })
    if (rows.length) await supabase.from('notifications').insert(rows)
  } catch { /* notifications table may not exist yet */ }
}

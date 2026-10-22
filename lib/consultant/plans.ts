import type { SupabaseClient } from '@supabase/supabase-js'

// MarketJump AI Consultant plans (Pro billing not wired up yet).
// Limits are questions per rolling window; tune them from real usage + cost data.
// Pro margin check: ~3-5¢ of Claude per question, so 100 questions ≈ $3-5 against $10 minus Stripe fees.
export const PLANS = {
  free: { label: 'Free', questions: 5, windowDays: 7, windowLabel: 'week', price: null },
  pro: { label: 'Pro', questions: 100, windowDays: 30, windowLabel: 'month', price: '$10/month' },
} as const

export type PlanId = keyof typeof PLANS

export interface Allowance {
  plan: PlanId
  limit: number
  used: number
  remaining: number
  windowLabel: string
  resetsAt: string | null // when the oldest counted question drops out of the window
}

// Reads with the user's own session (RLS: own rows only). A missing table or row means free.
export async function getAllowance(supabase: SupabaseClient, userId: string): Promise<Allowance> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  const isPro = sub?.plan === 'pro' && sub.status === 'active'
    && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())
  const plan: PlanId = isPro ? 'pro' : 'free'
  const { questions, windowDays, windowLabel } = PLANS[plan]

  const since = new Date(Date.now() - windowDays * 86400_000).toISOString()
  // Failed answers don't count against the allowance
  const { data: rows } = await supabase
    .from('ai_usage')
    .select('created_at')
    .eq('user_id', userId)
    .neq('status', 'failed')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(questions)

  const used = rows?.length ?? 0
  const resetsAt = used >= questions && rows?.[0]
    ? new Date(new Date(rows[0].created_at).getTime() + windowDays * 86400_000).toISOString()
    : null

  return { plan, limit: questions, used, remaining: Math.max(0, questions - used), windowLabel, resetsAt }
}

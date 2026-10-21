import type { SupabaseClient } from '@supabase/supabase-js'
import { getTier } from '@/lib/tier'

/**
 * Recalculate every user's tier from their current market_score, accuracy and
 * total_predictions. Guru is NOT permanent — users who drop below thresholds revert.
 * Needs a service-role client (updates every profile).
 */
export async function recalculateTiers(supabase: SupabaseClient) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, market_score, accuracy, total_predictions, level')

  if (error) throw new Error(error.message)

  const changes: { id: string; old: string; new: string }[] = []

  for (const profile of profiles ?? []) {
    const calculated = getTier(
      profile.market_score       ?? 0,
      profile.accuracy           ?? 0,
      profile.total_predictions  ?? 0,
    )

    if (calculated.tier !== profile.level) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ level: calculated.tier })
        .eq('id', profile.id)

      if (!updateErr) changes.push({ id: profile.id, old: profile.level, new: calculated.tier })
    }
  }

  return { profiles_checked: profiles?.length ?? 0, profiles_updated: changes.length, changes }
}

import type { SupabaseClient } from '@supabase/supabase-js'

// Profile sections a user can hide from visitors (Edit Brand → Visible on your page).
// The owner always sees everything on their own profile.
export const HIDEABLE_SECTIONS = [
  { key: 'stats', label: 'Stats', hint: 'Brand Score, accuracy, total and correct Moves' },
  { key: 'audience', label: 'Audience & Following', hint: 'Counts and the lists of people' },
  { key: 'agreed', label: 'Agreed By', hint: 'Community rating bar and vote buttons' },
  { key: 'live', label: 'Live Moves', hint: 'Your open calls' },
  { key: 'history', label: 'Move History', hint: 'Resolved calls, best and worst Move' },
  { key: 'posts', label: 'Posts', hint: 'Your videos and analysis' },
] as const

export type HideableSection = typeof HIDEABLE_SECTIONS[number]['key']

// Fetched on its own so profiles still load if the hidden_sections column
// hasn't been added yet (supabase-schema-social.sql)
export async function fetchHiddenSections(
  supabase: SupabaseClient,
  profileId: string,
): Promise<HideableSection[]> {
  const { data, error } = await supabase.from('profiles').select('hidden_sections').eq('id', profileId).single()
  if (error || !data) return []
  return (data.hidden_sections ?? []) as HideableSection[]
}

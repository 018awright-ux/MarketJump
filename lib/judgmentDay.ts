// Market Judgment Day: every Friday at 4:30 PM New York time, open Moves are scored.
// All maths here is DST-aware via the America/New_York zone.

const TZ = 'America/New_York'
const JD_HOUR = 16
const JD_MINUTE = 30

// Wall-clock parts of `d` in New York
function nyParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(d).map(x => [x.type, x.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour, minute: +p.minute, weekday }
}

// UTC instant for a New York wall-clock time
function nyToUtc(y: number, m: number, d: number, hour: number, minute: number) {
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute))
  const p = nyParts(guess)
  const asIfUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute)
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()))
}

// This week's Friday 4:30 PM NY, relative to `now` (may be in the past)
function fridayOfWeek(now: Date) {
  const p = nyParts(now)
  const daysToFri = 5 - p.weekday // Sat → -1 (yesterday)
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + daysToFri))
  return nyToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), JD_HOUR, JD_MINUTE)
}

/** Next Judgment Day strictly after `now` — when a Move made now gets scored */
export function nextJudgmentDay(now = new Date()): Date {
  const fri = fridayOfWeek(now)
  return fri > now ? fri : new Date(fridayOfWeek(new Date(now.getTime() + 7 * 86400_000)))
}

/** Most recent Judgment Day at or before `now` */
export function lastJudgmentDay(now = new Date()): Date {
  const fri = fridayOfWeek(now)
  return fri <= now ? fri : fridayOfWeek(new Date(now.getTime() - 7 * 86400_000))
}

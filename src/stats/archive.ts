// Daily archive: replay a past daily and race the time she set on the day. Pure, tested.
// Replays are saved as 'extra' solves (with replayOf), so they never touch PBs, medians or trends:
// she's seen the puzzle before, so it wouldn't be a fair comparison.

import type { SolveRecord } from '../db'
import type { Difficulty } from '../engine/types'
import { addDays, formatTime } from './metrics'
import { slotOf, type DailyKind, type DailyPlan, type DailySlot } from '../dailies'

export type ArchiveEntry = {
  slot: DailySlot
  kind: DailyKind
  n: number
  difficulty: Difficulty
  /** her daily solve on the day itself (null = missed) */
  onDay: SolveRecord | null
  /** fastest replay so far */
  bestReplay: SolveRecord | null
  replays: number
}

export type ArchiveDay = { day: string; entries: ArchiveEntry[] }

/** The last `days` days of dailies before today, newest first (three a day from TRIO_FROM). */
export function archiveDays(
  solves: SolveRecord[],
  today: string,
  lineup: (day: string) => Pick<DailyPlan, 'slot' | 'kind' | 'n' | 'difficulty'>[],
  days = 28,
): ArchiveDay[] {
  const out: ArchiveDay[] = []
  for (let k = 1; k <= days; k++) {
    const day = addDays(today, -k)
    const entries = lineup(day).map(({ slot, kind, n, difficulty }) => {
      const onDay = solves.find((s) => s.mode === 'daily' && s.day === day && slotOf(s) === slot) ?? null
      const replays = solves.filter((s) => s.replayOf === day && slotOf(s) === slot)
      const bestReplay = replays.reduce<SolveRecord | null>((b, s) => (!b || s.timeMs < b.timeMs ? s : b), null)
      return { slot, kind, n, difficulty, onDay, bestReplay, replays: replays.length }
    })
    out.push({ day, entries })
  }
  return out
}

/** One honest line for the win screen after a replay. */
export function replayLine(nowMs: number, onDayMs: number | null, prevBestMs: number | null): string {
  if (onDayMs === null) {
    if (prevBestMs !== null && nowMs < prevBestMs) return `Faster than your last go by ${secs(prevBestMs - nowMs)}`
    return 'Missed it on the day. Done now.'
  }
  const diff = onDayMs - nowMs
  if (Math.abs(diff) < 1000) return `Level with your time on the day (${formatTime(onDayMs)})`
  if (diff > 0) return `${secs(diff)} faster than on the day (${formatTime(onDayMs)})`
  return `On the day you took ${formatTime(onDayMs)}. Second goes aren't always quicker.`
}

function secs(ms: number): string {
  const s = Math.round(ms / 1000)
  return s >= 60 ? formatTime(ms) : `${s}s`
}

/** "Mon 22 Sep" */
export function shortDay(day: string): string {
  return new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

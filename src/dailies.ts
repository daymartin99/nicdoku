// Three dailies a day: Calm, Wild and a Wildcard that changes through the week.
// Pure (no signals), so the archive, stats and tests can all use it.

import type { Difficulty } from './engine/types'
import type { PuzzleStyle } from './engine/generate'
import { GENERATOR_VERSION } from './config'

export type DailySlot = 'calm' | 'wild' | 'special'
export type DailyKind = 'calm' | 'wild' | 'giant' | 'mini' | 'stripes' | 'classic'

export type DailyPlan = {
  day: string
  slot: DailySlot
  kind: DailyKind
  n: number
  difficulty: Difficulty
  style: PuzzleStyle
  seed: string
  maxAttempts?: number
}

export const DAILY_SLOTS: DailySlot[] = ['calm', 'wild', 'special']

/** First day with three dailies. Earlier days had the one classic daily (archive keeps them that way). */
export const TRIO_FROM = '2026-11-11'

export const KIND_INFO: Record<DailyKind, { title: string; blurb: string; icon: string }> = {
  calm: { title: 'Calm', blurb: 'Soft colours, gentle shapes', icon: '🌿' },
  wild: { title: 'Wild', blurb: 'Snaky shapes, tiny pockets', icon: '🌀' },
  giant: { title: 'Giant', blurb: 'So many colours', icon: '🐘' },
  mini: { title: 'Mini', blurb: 'A quick one', icon: '🐭' },
  stripes: { title: 'Stripes', blurb: 'Colours run in lines', icon: '🦓' },
  classic: { title: 'Classic', blurb: 'The original daily', icon: '★' },
}

/** The original single daily: size and difficulty through the week (Mon easy → Sun big). */
export function classicSpec(day: string): { n: number; difficulty: Difficulty } {
  const table: { n: number; difficulty: Difficulty }[] = [
    { n: 10, difficulty: 'expert' }, // Sun
    { n: 8, difficulty: 'easy' },
    { n: 8, difficulty: 'medium' },
    { n: 9, difficulty: 'medium' },
    { n: 9, difficulty: 'hard' },
    { n: 9, difficulty: 'hard' },
    { n: 10, difficulty: 'hard' }, // Sat
  ]
  return table[dow(day)]
}

/** The original daily's seed (kept, so classic days are the same puzzle as before). */
export function classicSeed(day: string) {
  return `nicdoku:${GENERATOR_VERSION}:daily:${day}`
}

function dow(day: string) {
  return new Date(day + 'T12:00:00').getDay() // 0 Sun
}

/** The Wildcard through the week. Giant twice, because she asked for it. */
const SPECIAL_WEEK: { kind: DailyKind; n: number; difficulty: Difficulty; style: PuzzleStyle }[] = [
  { kind: 'giant', n: 13, difficulty: 'hard', style: 'classic' }, // Sun
  { kind: 'mini', n: 6, difficulty: 'medium', style: 'classic' },
  { kind: 'stripes', n: 9, difficulty: 'medium', style: 'stripes' },
  { kind: 'classic', n: 0, difficulty: 'medium', style: 'classic' }, // Wed: original daily
  { kind: 'stripes', n: 10, difficulty: 'hard', style: 'stripes' },
  { kind: 'classic', n: 0, difficulty: 'hard', style: 'classic' }, // Fri: original daily
  { kind: 'giant', n: 12, difficulty: 'hard', style: 'classic' }, // Sat
]

export function dailyPlan(day: string, slot: DailySlot): DailyPlan {
  const d = dow(day)
  const weekend = d === 0 || d === 5 || d === 6
  if (slot === 'calm') {
    return { day, slot, kind: 'calm', n: 8, difficulty: 'easy', style: 'calm', seed: seedFor(day, slot), maxAttempts: 250 }
  }
  if (slot === 'wild') {
    return {
      day, slot, kind: 'wild', n: weekend ? 10 : 9, difficulty: weekend ? 'expert' : 'hard', style: 'wild',
      seed: seedFor(day, slot), maxAttempts: 150,
    }
  }
  const w = day < TRIO_FROM ? SPECIAL_WEEK[3] : SPECIAL_WEEK[d]
  if (w.kind === 'classic') return { day, slot, kind: 'classic', ...classicSpec(day), style: 'classic', seed: classicSeed(day) }
  return {
    day, slot, kind: w.kind, n: w.n, difficulty: w.difficulty, style: w.style, seed: seedFor(day, slot),
    maxAttempts: w.kind === 'giant' ? 250 : undefined,
  }
}

function seedFor(day: string, slot: DailySlot) {
  return `nicdoku:${GENERATOR_VERSION}:daily:${day}:${slot}`
}

/** The day's dailies: three from TRIO_FROM, the single classic one before that. */
export function dailyLineup(day: string): DailyPlan[] {
  return day < TRIO_FROM ? [dailyPlan(day, 'special')] : DAILY_SLOTS.map((s) => dailyPlan(day, s))
}

/** Solves saved before there were three dailies have no slot: they were the classic one. */
export function slotOf(rec: { dailySlot?: DailySlot }): DailySlot {
  return rec.dailySlot ?? 'special'
}

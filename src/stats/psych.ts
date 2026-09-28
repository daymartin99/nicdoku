// Stats seen through a psychology lens. Pure functions, no DOM or storage.
//
// Honesty rules (keep these when editing):
//  - only her vs past-her; gains first; neutral wording when there's nothing to celebrate
//  - these are outward signs, not measurements of inner states: never claim "you were in flow"
//  - every number shown must come straight from her own data with simple, checkable maths

import type { SolveRecord } from '../db'
import type { PowerRun } from '../power/state'
import { POWER_MS } from '../power/timeline'
import { moodSummary, type MoodKind, type MoodPair } from '../mood'
import { addDays, isoWeekStart, median } from './metrics'

const MIN = 60_000
export const BLOCK_MS = 5 * MIN
export const BLOCKS = POWER_MS / BLOCK_MS // 12

// ---------- mood lift ----------

export const MOOD_MIN_PAIRS = 3

export type MoodLift = { kind: MoodKind; n: number; better: number; same: number; worse: number; line: string; sub: string | null }

/** "After breaks you felt better 7 of 10 times" – only with ≥ 3 before/after pairs of that kind. */
export function moodLift(pairs: MoodPair[], kind: MoodKind): MoodLift | null {
  const mine = pairs.filter((p) => p.kind === kind)
  if (mine.length < MOOD_MIN_PAIRS) return null
  const s = moodSummary(mine)
  const what = kind === 'break' ? 'breaks' : 'Power Hours'
  let line: string
  let sub: string | null = null
  if (s.better > 0) {
    line = `After ${what} you felt better ${s.better} of ${s.n} times`
    if (s.same > 0) sub = `About the same ${s.same} time${s.same === 1 ? '' : 's'}`
  } else if (s.same > 0) {
    line = `After ${what} you felt about the same ${s.same} of ${s.n} times`
  } else {
    line = `You've checked in before and after ${s.n} ${what}`
  }
  return { kind, n: s.n, better: s.better, same: s.same, worse: s.worse, line, sub }
}

// ---------- warm-up effect ----------

export type WarmUp = { pct: number; sessions: number; firstMs: number; restMs: number; line: string }

/**
 * Within each break, compare the 1st puzzle with puzzles 2–5 of the same board size
 * (a paired comparison, so good and bad days cancel out). Median across breaks.
 * Only returned when she is ≥ 5% quicker after warming up, over ≥ 3 breaks.
 */
export function warmUp(solves: SolveRecord[], minSessions = 3): WarmUp | null {
  const groups = new Map<string, SolveRecord[]>()
  for (const s of solves) {
    if (s.mode !== 'session' || !s.sessionId) continue
    const g = groups.get(s.sessionId)
    if (g) g.push(s)
    else groups.set(s.sessionId, [s])
  }
  const ratios: number[] = []
  const firsts: number[] = []
  const rests: number[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => a.at - b.at)
    const first = list[0]
    const later = list.slice(1, 5).filter((s) => s.n === first.n)
    const m = median(later.map((s) => s.timeMs))
    if (m === null || first.timeMs <= 0) continue
    ratios.push(m / first.timeMs)
    firsts.push(first.timeMs)
    rests.push(m)
  }
  if (ratios.length < minSessions) return null
  const r = median(ratios)!
  const pct = Math.round((1 - r) * 100)
  if (pct < 5) return null
  return {
    pct,
    sessions: ratios.length,
    firstMs: median(firsts)!,
    restMs: median(rests)!,
    line: `You're ${pct}% quicker after your first puzzle`,
  }
}

// ---------- Power Hour ----------

/** Time from the start of the hour to her first clean solve (null if none). */
export function settlingMs(run: PowerRun): number | null {
  const s = run.solves.find((x) => x.clean)
  return s ? s.at : null
}

/** How long the hour actually ran (ms, capped at 60 min). */
export function runDurationMs(run: PowerRun): number {
  if (run.endedAt) return Math.max(0, Math.min(POWER_MS, run.endedAt - run.startedAt))
  const last = run.solves[run.solves.length - 1]
  return last ? Math.min(POWER_MS, last.at) : 0
}

/** Longest stretch without leaving the app, and how often she switched away. Shown neutrally. */
export function focusStats(run: PowerRun): { longestMs: number; switches: number; awayMs: number } {
  const dur = runDurationMs(run)
  return {
    longestMs: Math.min(dur || POWER_MS, Math.max(0, run.longestFocusMs || 0)),
    switches: run.switches || 0,
    awayMs: run.awayMs || 0,
  }
}

export type PeakEnd = {
  peak: { combo: number; at: number } | null
  end: { kind: 'boss' | 'bell' | 'mid' | 'early' | 'none'; text: string }
}

/** Peak = best clean combo and when it happened. End = how the hour finished. */
export function peakEnd(run: PowerRun): PeakEnd {
  const peak = run.bestCombo >= 2 ? { combo: run.bestCombo, at: run.peakAt } : null
  const last = run.solves[run.solves.length - 1]
  const dur = runDurationMs(run)
  let end: PeakEnd['end']
  if (!last) end = { kind: 'none', text: 'A first look around the hour' }
  else if (last.boss) end = { kind: 'boss', text: 'Ended on the boss puzzle' }
  else if (run.endReason === 'early') end = { kind: 'early', text: `You called it at ${Math.max(1, Math.round(dur / MIN))} min` }
  else if (dur - last.at <= 90_000) {
    const s = Math.max(1, Math.round((dur - last.at) / 1000))
    end = { kind: 'bell', text: s <= 5 ? 'Solved one right on the bell' : `Solved one in the last ${s}s` }
  } else end = { kind: 'mid', text: 'Time ran out mid-puzzle' }
  return { peak, end }
}

/** Puzzles solved in each 5-minute block of the hour (12 numbers). */
export function crescendo(run: PowerRun): number[] {
  const out = new Array<number>(BLOCKS).fill(0)
  for (const s of run.solves) out[Math.min(BLOCKS - 1, Math.max(0, Math.floor(s.at / BLOCK_MS)))]++
  return out
}

export const STEADY_BAND = 0.35

/**
 * Steady-pace blocks: 5-minute blocks where she solved ≥ 1 puzzle and the pace stayed within ±35%
 * of her median for the hour. Pace is time per cell (timeMs / n²) so bigger boards later on
 * don't automatically count as "slow". `total` is the number of blocks the hour actually ran.
 */
export function steadyBlocks(run: PowerRun): { steady: number; total: number } {
  const dur = runDurationMs(run)
  const total = Math.max(0, Math.min(BLOCKS, Math.ceil(dur / BLOCK_MS)))
  const pace = (s: PowerRun['solves'][number]) => s.timeMs / (s.n * s.n)
  const mid = median(run.solves.map(pace))
  if (mid === null || mid <= 0) return { steady: 0, total }
  let steady = 0
  for (let b = 0; b < total; b++) {
    const inBlock = run.solves.filter((s) => Math.min(BLOCKS - 1, Math.floor(s.at / BLOCK_MS)) === b)
    const m = median(inBlock.map(pace))
    if (m !== null && Math.abs(m - mid) / mid <= STEADY_BAND) steady++
  }
  return { steady, total }
}

export type PowerBests = { puzzles: number; score: number; combo: number }

export function powerBests(runs: PowerRun[]): PowerBests {
  return runs.reduce<PowerBests>(
    (a, r) => ({
      puzzles: Math.max(a.puzzles, r.solves.length),
      score: Math.max(a.score, r.score),
      combo: Math.max(a.combo, r.bestCombo),
    }),
    { puzzles: 0, score: 0, combo: 0 },
  )
}

/**
 * Compare the latest hour with the one before. Lines only for things that went up; otherwise
 * one neutral line. `runs` in any order.
 */
export function vsLastTime(runs: PowerRun[]): { lines: string[]; neutral: string | null } | null {
  const sorted = [...runs].sort((a, b) => a.startedAt - b.startedAt)
  if (sorted.length < 2) return null
  const cur = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const lines: string[] = []
  const dp = cur.solves.length - prev.solves.length
  if (dp > 0) lines.push(`+${dp} puzzle${dp === 1 ? '' : 's'} vs last time`)
  const ds = cur.score - prev.score
  if (ds > 0) lines.push(`+${ds.toLocaleString('en-GB')} points vs last time`)
  const dc = cur.bestCombo - prev.bestCombo
  if (dc > 0) lines.push(`Longer combo than last time (${cur.bestCombo} vs ${prev.bestCombo})`)
  return { lines, neutral: lines.length ? null : 'Every hour is different. This one is in the books.' }
}

// ---------- real-life framing ----------

/** Minutes of puzzling (breaks, daily, bonus and Power Hours) in the ISO week containing `today`. */
export function weekMinutes(solves: SolveRecord[], runs: PowerRun[], today: string): number {
  const from = isoWeekStart(today)
  const to = addDays(from, 7)
  const inWeek = (d: string) => d >= from && d < to
  const ms =
    solves.filter((s) => inWeek(s.day)).reduce((a, s) => a + s.timeMs, 0) +
    runs.filter((r) => inWeek(r.day)).reduce((a, r) => a + runDurationMs(r), 0)
  return ms / MIN
}

export const EPISODE_MIN = 45
export const SONG_MIN = 3.5
export const FILM_MIN = 120

/** A plain, accurate everyday comparison for a number of minutes (null under 2 min). */
export function realLife(minutes: number): string | null {
  if (minutes < 2) return null
  if (minutes < 20) {
    const k = Math.max(1, Math.round(minutes / SONG_MIN))
    return `about as long as ${k} song${k === 1 ? '' : 's'}`
  }
  if (minutes < 100) {
    const k = Math.round((minutes / EPISODE_MIN) * 2) / 2
    if (k <= 0.5) return 'about half an episode of telly'
    return `about ${k === 1 ? 'one episode' : `${k} episodes`} of telly`
  }
  const f = Math.round((minutes / FILM_MIN) * 2) / 2
  return `about ${f === 1 ? 'one film' : `${f} films`}`
}

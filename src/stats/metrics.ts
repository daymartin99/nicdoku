// Pure stats over SolveRecord[]. No DOM, no IndexedDB – easy to test.
//
// Principles (keep these when editing):
//  - gains first; never phrase anything as "you got worse"
//  - records are per board size, so a 10×10 never counts against a 9×9
//  - medians, not means (one distracted solve shouldn't wreck a number)
//  - streaks are forgiving: 2 automatic freezes per ISO week, no "broken" message
//
// Performance metrics (PBs, medians, %, trends, rates) ignore mode === 'extra'.
// Activity metrics (streak, heatmap, minutes/day, puzzle & time totals) count
// every solve – playing is playing.

import type { SolveRecord } from '../db'

export type DayCell = { day: string; played: boolean; frozen: boolean }
export type StreakInfo = {
  activeLast7: number
  current: number
  best: number
  freezesLeftThisWeek: number
  days: DayCell[]
}
export type DailyPoint = {
  day: string
  solves: number
  medianTimeByN: Record<number, number>
  score: number
  minutes: number
}
export type TrendPoint = { week: string; median: number | null; count: number; hasPB: boolean }
/** baselineWeek: the week improvementPct is measured against (the first week with data). */
export type Trend = { points: TrendPoint[]; improvementPct: number | null; baselineWeek: string | null }
export type Totals = {
  puzzles: number
  cleanRate: number | null
  totalTimeMs: number
  totalScore: number
  bestSessionScore: number
  avgFirstTapMs: number | null
  avgMsPerPlacement: number | null
}
export type SessionSummary = {
  sessionId: string
  day: string
  startAt: number
  endAt: number
  count: number
  totalTimeMs: number
  score: number
  cleanCount: number
  pbCount: number
}

export const FREEZES_PER_WEEK = 2
/** Earlier solves of a size needed before a faster one counts as a "new best". */
export const PB_MIN_PRIOR = 3

// ---------- small helpers ----------

const perf = (solves: SolveRecord[]) => solves.filter((s) => s.mode !== 'extra')
const byAt = (a: SolveRecord, b: SolveRecord) => a.at - b.at

export function sizeLabel(n: number): string {
  return `${n}×${n}`
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Date strings are YYYY-MM-DD local days; do arithmetic in UTC to dodge DST.
function toUTC(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function fromUTC(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}
export function addDays(day: string, k: number): string {
  return fromUTC(toUTC(day) + k * 86400000)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000)
}
/** Monday (YYYY-MM-DD) of the ISO week containing `day`. */
export function isoWeekStart(day: string): string {
  const dow = (new Date(toUTC(day)).getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(day, -dow)
}

// ---------- formatting ----------

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  if (totalMin < 1) return `${Math.round(Math.max(0, ms) / 1000)}s`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

// ---------- records ----------

export function personalBests(solves: SolveRecord[]): Map<number, SolveRecord> {
  const out = new Map<number, SolveRecord>()
  for (const s of perf(solves)) {
    const cur = out.get(s.n)
    if (!cur || s.timeMs < cur.timeMs) out.set(s.n, s)
  }
  return out
}

/** Fastest clean (no mistakes/hints) solve per size. */
export function cleanPersonalBests(solves: SolveRecord[]): Map<number, SolveRecord> {
  return personalBests(solves.filter((s) => s.clean))
}

/** Sizes she has played (non-extra), ascending. */
export function sizesPlayed(solves: SolveRecord[]): number[] {
  return [...new Set(perf(solves).map((s) => s.n))].sort((a, b) => a - b)
}

/** Median time of the last `lastK` solves of size n. */
export function medianTime(solves: SolveRecord[], n: number, lastK = 10): number | null {
  const xs = perf(solves).filter((s) => s.n === n).sort(byAt).slice(-lastK)
  return median(xs.map((s) => s.timeMs))
}

/**
 * True when `rec` beats every earlier solve of the same size. `solves` should not
 * contain `rec` (it is ignored if it does). Needs at least PB_MIN_PRIOR earlier
 * solves of that size – beating one or two attempts isn't much of a record.
 */
export function isNewPB(solves: SolveRecord[], rec: SolveRecord): boolean {
  if (rec.mode === 'extra') return false
  const prior = perf(solves).filter((s) => s !== rec && s.n === rec.n && s.at < rec.at)
  if (prior.length < PB_MIN_PRIOR) return false
  return prior.every((s) => rec.timeMs < s.timeMs)
}

/** Solves that were a new best at the moment they happened (same rule as isNewPB). */
export function pbSet(solves: SolveRecord[]): Set<SolveRecord> {
  const best = new Map<number, number>()
  const seen = new Map<number, number>()
  const out = new Set<SolveRecord>()
  for (const s of perf(solves).sort(byAt)) {
    const b = best.get(s.n)
    const k = seen.get(s.n) ?? 0
    seen.set(s.n, k + 1)
    if (b === undefined || s.timeMs < b) {
      best.set(s.n, s.timeMs)
      if (b !== undefined && k >= PB_MIN_PRIOR) out.add(s)
    }
  }
  return out
}

/** % of her earlier solves of the same size that were slower than `rec` (null if < 5 earlier). */
export function fasterThanPct(solves: SolveRecord[], rec: SolveRecord): number | null {
  const prior = perf(solves).filter((s) => s !== rec && s.n === rec.n && s.at < rec.at)
  if (prior.length < 5) return null
  const slower = prior.filter((s) => s.timeMs > rec.timeMs).length
  return Math.round((100 * slower) / prior.length)
}

/** Friendly line, only when it's good news (≥ 50%). */
export function fasterThanLine(solves: SolveRecord[], rec: SolveRecord): string | null {
  const p = fasterThanPct(solves, rec)
  if (p === null || p < 50) return null
  return `Faster than ${p}% of your ${sizeLabel(rec.n)} solves`
}

// ---------- streak ----------

export function streak(solves: SolveRecord[], today: string): StreakInfo {
  const played = new Set(solves.map((s) => s.day))
  const frozen = new Set<string>()
  const usedByWeek = new Map<string, number>()
  let current = 0
  let best = 0

  const first = [...played].filter((d) => d <= today).sort()[0]
  if (first) {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (played.has(d)) {
        current++
        if (current > best) best = current
      } else if (d === today) {
        // today isn't over yet – never break or freeze for it
      } else if (current > 0) {
        const wk = isoWeekStart(d)
        const used = usedByWeek.get(wk) ?? 0
        if (used < FREEZES_PER_WEEK) {
          usedByWeek.set(wk, used + 1)
          frozen.add(d)
        } else {
          current = 0
        }
      }
    }
  }

  let activeLast7 = 0
  for (let k = 0; k < 7; k++) if (played.has(addDays(today, -k))) activeLast7++

  const days: DayCell[] = []
  for (let k = 13; k >= 0; k--) {
    const day = addDays(today, -k)
    days.push({ day, played: played.has(day), frozen: frozen.has(day) })
  }

  return {
    activeLast7,
    current,
    best,
    freezesLeftThisWeek: FREEZES_PER_WEEK - (usedByWeek.get(isoWeekStart(today)) ?? 0),
    days,
  }
}

// ---------- series ----------

export function dailySeries(solves: SolveRecord[], days = 30, today: string = todayLocal()): DailyPoint[] {
  const from = addDays(today, -(days - 1))
  const byDay = new Map<string, SolveRecord[]>()
  for (const s of solves) {
    if (s.day < from || s.day > today) continue
    const arr = byDay.get(s.day)
    if (arr) arr.push(s)
    else byDay.set(s.day, [s])
  }
  const out: DailyPoint[] = []
  for (let k = 0; k < days; k++) {
    const day = addDays(from, k)
    const list = byDay.get(day) ?? []
    const medianTimeByN: Record<number, number> = {}
    for (const n of new Set(perf(list).map((s) => s.n))) {
      medianTimeByN[n] = median(perf(list).filter((s) => s.n === n).map((s) => s.timeMs))!
    }
    out.push({
      day,
      solves: list.length,
      medianTimeByN,
      score: list.reduce((a, s) => a + s.score, 0),
      minutes: Math.round(list.reduce((a, s) => a + s.timeMs, 0) / 6000) / 10,
    })
  }
  return out
}

/**
 * Weekly medians for one size over the last `weeks` ISO weeks (oldest first).
 * improvementPct is only set when the latest week is faster than the first
 * (positive number = % faster); otherwise null so the UI stays quiet.
 */
export function trend(solves: SolveRecord[], n: number, weeks = 8, today: string = todayLocal()): Trend {
  const lastWeek = isoWeekStart(today)
  const firstWeek = addDays(lastWeek, -7 * (weeks - 1))
  const pbs = pbSet(solves)
  const points: TrendPoint[] = []
  const sized = perf(solves).filter((s) => s.n === n)
  for (let w = 0; w < weeks; w++) {
    const week = addDays(firstWeek, 7 * w)
    const end = addDays(week, 7)
    const list = sized.filter((s) => s.day >= week && s.day < end)
    points.push({
      week,
      median: median(list.map((s) => s.timeMs)),
      count: list.length,
      hasPB: list.some((s) => pbs.has(s)),
    })
  }
  const withData = points.filter((p) => p.median !== null)
  let improvementPct: number | null = null
  const baselineWeek = withData.length ? withData[0].week : null
  if (withData.length >= 2) {
    const a = withData[0].median!
    const b = withData[withData.length - 1].median!
    const pct = Math.round((100 * (a - b)) / a)
    if (pct > 0) improvementPct = pct
  }
  return { points, improvementPct, baselineWeek }
}

/** Day counts from the Monday `weeks-1` weeks ago through today (GitHub-style). */
export function heatmap(solves: SolveRecord[], weeks = 12, today: string = todayLocal()): { day: string; count: number }[] {
  const from = addDays(isoWeekStart(today), -7 * (weeks - 1))
  const counts = new Map<string, number>()
  for (const s of solves) counts.set(s.day, (counts.get(s.day) ?? 0) + 1)
  const out: { day: string; count: number }[] = []
  for (let d = from; d <= today; d = addDays(d, 1)) out.push({ day: d, count: counts.get(d) ?? 0 })
  return out
}

// ---------- totals & sessions ----------

export function totals(solves: SolveRecord[]): Totals {
  const p = perf(solves)
  const sessions = sessionSummaries(solves)
  const withTap = p.filter((s) => s.firstTapMs > 0)
  return {
    puzzles: solves.length,
    cleanRate: p.length ? p.filter((s) => s.clean).length / p.length : null,
    totalTimeMs: solves.reduce((a, s) => a + s.timeMs, 0),
    totalScore: solves.reduce((a, s) => a + s.score, 0),
    bestSessionScore: sessions.reduce((a, s) => Math.max(a, s.score), 0),
    avgFirstTapMs: withTap.length ? withTap.reduce((a, s) => a + s.firstTapMs, 0) / withTap.length : null,
    avgMsPerPlacement: p.length ? p.reduce((a, s) => a + s.timeMs / s.n, 0) / p.length : null,
  }
}

/** Per-size rate stats for the "By size" tab. */
export function sizeStats(solves: SolveRecord[], n: number) {
  const list = perf(solves).filter((s) => s.n === n)
  const withTap = list.filter((s) => s.firstTapMs > 0)
  return {
    count: list.length,
    cleanRate: list.length ? list.filter((s) => s.clean).length / list.length : null,
    avgFirstTapMs: withTap.length ? withTap.reduce((a, s) => a + s.firstTapMs, 0) / withTap.length : null,
    fastest: [...list].sort((a, b) => a.timeMs - b.timeMs).slice(0, 5),
  }
}

export function sessionSummaries(solves: SolveRecord[]): SessionSummary[] {
  const pbs = pbSet(solves)
  const groups = new Map<string, SolveRecord[]>()
  for (const s of solves) {
    if (!s.sessionId) continue
    const g = groups.get(s.sessionId)
    if (g) g.push(s)
    else groups.set(s.sessionId, [s])
  }
  const out: SessionSummary[] = []
  for (const [sessionId, list] of groups) {
    list.sort(byAt)
    out.push({
      sessionId,
      day: list[0].day,
      startAt: list[0].at,
      endAt: list[list.length - 1].at,
      count: list.length,
      totalTimeMs: list.reduce((a, s) => a + s.timeMs, 0),
      score: list.reduce((a, s) => a + s.score, 0),
      cleanCount: list.filter((s) => s.clean).length,
      pbCount: list.filter((s) => pbs.has(s)).length,
    })
  }
  return out.sort((a, b) => a.startAt - b.startAt)
}

// ---------- headline ----------

/** Current run of clean solves, counting back from the most recent. */
export function cleanRun(solves: SolveRecord[]): number {
  const p = perf(solves).sort(byAt)
  let k = 0
  for (let i = p.length - 1; i >= 0 && p[i].clean; i--) k++
  return k
}

/** One short, true, positive line for Home. */
export function headline(solves: SolveRecord[], today: string): string {
  // Nothing yet: say nothing rather than a guilt-tinged 'welcome back'.
  if (!solves.length) return ''
  const p = perf(solves)

  // 1. a fresh personal best (today / yesterday)
  const yesterday = addDays(today, -1)
  const recentPBs = [...pbSet(solves)].filter((s) => s.day === today || s.day === yesterday).sort(byAt)
  const pb = recentPBs[recentPBs.length - 1]
  if (pb) {
    return `New ${sizeLabel(pb.n)} best ${pb.day === today ? 'today' : 'yesterday'}: ${formatTime(pb.timeMs)}`
  }

  // 2. monthly median improvement on her most-played recent size
  const monthAgo = addDays(today, -30)
  const twoMonthsAgo = addDays(today, -60)
  let medianLine: { pct: number; text: string } | null = null
  const recent = p.filter((s) => s.day > monthAgo && s.day <= today)
  const counts = new Map<number, number>()
  for (const s of recent) counts.set(s.n, (counts.get(s.n) ?? 0) + 1)
  for (const [n, c] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (c < 3) continue
    const before = p.filter((s) => s.n === n && s.day > twoMonthsAgo && s.day <= monthAgo)
    if (before.length < 3) continue
    const a = median(before.map((s) => s.timeMs))!
    const b = median(recent.filter((s) => s.n === n).map((s) => s.timeMs))!
    const pct = Math.round((100 * (a - b)) / a)
    if (pct >= 5 && (!medianLine || pct > medianLine.pct)) {
      medianLine = { pct, text: `Your ${sizeLabel(n)} median is down ${pct}% this month` }
    }
  }
  const run = cleanRun(solves)

  if (medianLine && medianLine.pct >= 10) return medianLine.text
  if (run >= 5) return `${run} clean solves in a row`
  if (medianLine) return medianLine.text
  if (run >= 3) return `${run} clean solves in a row`

  const st = streak(solves, today)
  if (st.activeLast7 >= 3) return `You've played ${st.activeLast7} of the last 7 days`
  if (solves.length >= 10) return `${solves.length} puzzles solved so far`
  return 'Welcome back'
}

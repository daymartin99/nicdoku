// Personal record books. Every Power format (length × intensity, e.g. "10-min Wild") has its own
// tables, and normal breaks get speed records per board size. Pure functions, unit-tested.

import type { PowerRun, PowerSolve } from '../power/state'
import type { SolveRecord } from '../db'
import { formatTime } from './metrics'

export type Pick = { t: number; c: string; h?: boolean }

// ---------- colour names ----------

function hsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return { h, s, l }
}

/** A friendly name for any board colour: "Pink", "Dark green", "Cyan", "Mustard"… */
export function colourName(hex: string): string {
  const c = hsl(hex)
  if (!c) return 'Colour'
  const { h, s, l } = c
  let base: string
  if (s < 0.15) base = l < 0.35 ? 'Charcoal' : l > 0.8 ? 'Silver' : 'Grey'
  else if (h < 20 && s > 0.6 && l > 0.6) base = 'Coral'
  else if (h < 12 || h >= 345) base = l > 0.74 ? 'Pink' : 'Red'
  else if (h < 40) base = l < 0.42 || (s < 0.45 && l < 0.55) ? 'Brown' : 'Orange'
  else if (h < 66) base = l < 0.5 ? 'Mustard' : 'Yellow'
  else if (h < 100) base = 'Lime'
  else if (h < 150) base = 'Green'
  else if (h < 165) base = s > 0.85 ? 'Mint' : 'Green'
  else if (h < 195) base = s > 0.85 && l > 0.4 ? 'Cyan' : 'Teal'
  else if (h < 250) base = 'Blue'
  else if (h < 290) base = 'Purple'
  else if (h < 335) base = s > 0.9 && l > 0.45 && l < 0.65 ? 'Magenta' : 'Pink'
  else base = 'Rose'
  if (l < 0.38 && !['Brown', 'Charcoal'].includes(base)) return `Dark ${base.toLowerCase()}`
  if (l > 0.78 && !['Yellow', 'Pink', 'Silver', 'Coral'].includes(base)) return `Light ${base.toLowerCase()}`
  return base
}

// ---------- record rows ----------

export type RecordGroup = 'run' | 'speed' | 'colour'

export type Rec = {
  /** stable key, e.g. "score", "piece-1", "solve-9", "colour-Pink" */
  id: string
  group: RecordGroup
  label: string
  value: number
  better: 'low' | 'high'
  display: string
  /** run id (Power) or solve id (breaks) that holds it */
  ref: string
  /** epoch ms when it was set */
  at: number
  /** colour records: the shade that set it (for a swatch) */
  hex?: string
}

/** One solved puzzle, from either a Power run or a break. */
export type Game = {
  ref: string
  at: number
  n: number
  timeMs: number
  firstTapMs?: number
  picks?: Pick[]
  hinted: boolean
}

const ORD = ['1st', '2nd', '3rd']

function keep(map: Map<string, Rec>, r: Rec) {
  const cur = map.get(r.id)
  if (!cur) return map.set(r.id, r)
  const better = r.better === 'low' ? r.value < cur.value : r.value > cur.value
  // ties go to whoever set it first
  if (better) map.set(r.id, r)
}

/** Speed records that only look at individual puzzles: taps, pieces, solves, colours. */
export function speedRecords(games: Game[]): Rec[] {
  const out = new Map<string, Rec>()
  for (const g of games) {
    if (g.firstTapMs && g.firstTapMs > 0) {
      keep(out, { id: 'first-tap', group: 'speed', label: 'Quickest first tap', value: g.firstTapMs, better: 'low', display: formatSecs(g.firstTapMs), ref: g.ref, at: g.at })
    }
    const picks = [...(g.picks ?? [])].sort((a, b) => a.t - b.t)
    for (let k = 0; k < 3 && k < picks.length; k++) {
      // only counts if she found all of the first k+1 herself
      if (picks.slice(0, k + 1).some((p) => p.h)) break
      keep(out, { id: `piece-${k + 1}`, group: 'speed', label: `Quickest ${ORD[k]} correct piece`, value: picks[k].t, better: 'low', display: formatSecs(picks[k].t), ref: g.ref, at: g.at })
    }
    if (!g.hinted) {
      keep(out, { id: `solve-${g.n}`, group: 'speed', label: `Fastest ${g.n}×${g.n} solve`, value: g.timeMs, better: 'low', display: formatTime(g.timeMs), ref: g.ref, at: g.at })
    }
    for (const p of picks) {
      if (p.h || !p.c) continue
      const name = colourName(p.c)
      keep(out, { id: `colour-${name}`, group: 'colour', label: `Fastest ${name.toLowerCase()}`, value: p.t, better: 'low', display: formatSecs(p.t), ref: g.ref, at: g.at, hex: p.c })
    }
  }
  return [...out.values()]
}

/** A hint or reveal placed a piece (older runs without piece data count as unhinted). */
const hintedSolve = (s: PowerSolve) => (s.picks ?? []).some((p) => p.h)

function gamesOfRun(run: PowerRun): Game[] {
  return run.solves.map((s) => ({
    ref: run.id,
    at: run.startedAt + s.at,
    n: s.n,
    timeMs: s.timeMs,
    firstTapMs: s.firstTapMs,
    picks: s.picks,
    hinted: hintedSolve(s),
  }))
}

/** The full record book for a set of Power runs (normally one format). */
export function formatRecords(runs: PowerRun[]): Rec[] {
  const out = new Map<string, Rec>()
  for (const r of runs) {
    const at = r.startedAt
    const n = r.solves.length
    if (n > 0) {
      keep(out, { id: 'score', group: 'run', label: 'Best score', value: r.score, better: 'high', display: r.score.toLocaleString('en-GB'), ref: r.id, at })
      keep(out, { id: 'puzzles', group: 'run', label: 'Most puzzles', value: n, better: 'high', display: String(n), ref: r.id, at })
      const clean = r.solves.filter((s) => s.clean).length
      keep(out, { id: 'clean', group: 'run', label: 'Most clean solves', value: clean, better: 'high', display: String(clean), ref: r.id, at })
    }
    if (r.bestCombo >= 2) {
      keep(out, { id: 'combo', group: 'run', label: 'Longest combo', value: r.bestCombo, better: 'high', display: `×${r.bestCombo}`, ref: r.id, at })
    }
    // only full-length runs with a few solves count for "fewest mistakes"
    if (r.endReason !== 'early' && n >= 3) {
      keep(out, { id: 'mistakes', group: 'run', label: 'Fewest mistakes', value: r.mistakes, better: 'low', display: String(r.mistakes), ref: r.id, at })
    }
    for (const [k, id] of [[3, 'to-3'], [5, 'to-5'], [10, 'to-10']] as const) {
      if (n >= k) {
        const t = r.solves[k - 1].at
        keep(out, { id, group: 'run', label: `Fastest to ${k} puzzles`, value: t, better: 'low', display: formatTime(t), ref: r.id, at })
      }
    }
  }
  for (const rec of speedRecords(runs.flatMap(gamesOfRun))) keep(out, rec)
  return sortRecs([...out.values()])
}

const GROUP_ORDER: Record<RecordGroup, number> = { run: 0, speed: 1, colour: 2 }
const ID_ORDER = ['score', 'puzzles', 'combo', 'clean', 'mistakes', 'to-3', 'to-5', 'to-10', 'first-tap', 'piece-1', 'piece-2', 'piece-3']

function sortRecs(recs: Rec[]): Rec[] {
  const idx = (id: string) => {
    const i = ID_ORDER.indexOf(id)
    return i < 0 ? 100 + (id.startsWith('solve-') ? Number(id.slice(6)) : 0) : i
  }
  return recs.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || idx(a.id) - idx(b.id) || a.label.localeCompare(b.label))
}

/**
 * Records a run just set, compared with every earlier run of the same format.
 * A format's first-ever run returns [] (everything would be a "record"); use isFirstOfFormat.
 */
export function newRecords(formatRuns: PowerRun[], runId: string): Rec[] {
  const run = formatRuns.find((r) => r.id === runId)
  if (!run) return []
  const before = formatRuns.filter((r) => r.id !== runId && r.startedAt < run.startedAt)
  if (!before.length) return []
  const old = new Map(formatRecords(before).map((r) => [r.id, r]))
  return formatRecords([...before, run]).filter((r) => {
    if (r.ref !== runId) return false
    const prev = old.get(r.id)
    if (!prev) return r.group !== 'run' // a brand-new colour or size record is still a first
    return r.better === 'low' ? r.value < prev.value : r.value > prev.value
  })
}

export function isFirstOfFormat(formatRuns: PowerRun[], runId: string): boolean {
  const run = formatRuns.find((r) => r.id === runId)
  return !!run && !formatRuns.some((r) => r.id !== runId && r.startedAt < run.startedAt)
}

/** 1-based rank of a run within its format by a metric (higher is better). */
export function rankOf(formatRuns: PowerRun[], runId: string, metric: (r: PowerRun) => number): { rank: number; of: number } {
  const sorted = [...formatRuns].sort((a, b) => metric(b) - metric(a) || a.startedAt - b.startedAt)
  return { rank: sorted.findIndex((r) => r.id === runId) + 1, of: sorted.length }
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${s}`
}

// ---------- tables ----------

export type TopRun = { ref: string; day: string; score: number; puzzles: number; combo: number }
export type TopSolve = { ref: string; day: string; n: number; timeMs: number }

export function topRuns(formatRuns: PowerRun[], limit = 5): TopRun[] {
  return [...formatRuns]
    .filter((r) => r.solves.length)
    .sort((a, b) => b.score - a.score || a.startedAt - b.startedAt)
    .slice(0, limit)
    .map((r) => ({ ref: r.id, day: r.day, score: r.score, puzzles: r.solves.length, combo: r.bestCombo }))
}

export function topSolves(formatRuns: PowerRun[], limit = 5): TopSolve[] {
  return formatRuns
    .flatMap((r) => r.solves.filter((s) => !hintedSolve(s)).map((s) => ({ ref: r.id, day: r.day, n: s.n, timeMs: s.timeMs })))
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, limit)
}

// ---------- this week ----------

/** Monday 00:00 (local) of the week containing `now`. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Runs from this week only: the weekly tables reset every Monday, so there's always something to beat. */
export function thisWeek(runs: PowerRun[], now = Date.now()): PowerRun[] {
  const from = weekStart(now)
  return runs.filter((r) => r.startedAt >= from)
}

/** Records this run set within this week (only when it isn't also an all-time record). */
export function newWeeklyRecords(formatRuns: PowerRun[], runId: string, now = Date.now()): Rec[] {
  const allTime = new Set(newRecords(formatRuns, runId).map((r) => r.id))
  return newRecords(thisWeek(formatRuns, now), runId).filter((r) => !allTime.has(r.id))
}

// ---------- formats ----------

export type FormatKey = string

export function formatKey(run: PowerRun): FormatKey {
  return `${Math.round((run.durationMs ?? 3_600_000) / 60_000)}-${run.mode ?? 'normal'}`
}

export function formatLabel(key: FormatKey): string {
  const [min, mode] = key.split('-')
  return `${min}-min ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
}

/** Formats she has played, most recent first. */
export function formatsPlayed(runs: PowerRun[]): FormatKey[] {
  const seen: FormatKey[] = []
  for (const r of [...runs].sort((a, b) => b.startedAt - a.startedAt)) {
    const k = formatKey(r)
    if (!seen.includes(k)) seen.push(k)
  }
  return seen
}

// ---------- breaks ----------

/** Speed records for normal breaks and daily puzzles of one board size. */
export function breakRecords(solves: SolveRecord[], n: number): Rec[] {
  const games: Game[] = solves
    .filter((s) => s.n === n && s.mode !== 'extra')
    .map((s) => ({
      ref: String(s.id ?? s.at),
      at: s.at,
      n: s.n,
      timeMs: s.timeMs,
      firstTapMs: s.firstTapMs,
      picks: s.picks,
      hinted: s.hints > 0,
    }))
  return sortRecs(speedRecords(games))
}

/** "0:07" for sub-minute times, "1:42" above. */
export function formatSecs(ms: number): string {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatTime(ms)
}

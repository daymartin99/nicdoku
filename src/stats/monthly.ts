// Month card: one shareable summary of her month, her against past-her only. Pure, tested.

import type { SolveRecord } from '../db'
import type { PowerRun } from '../power/state'
import { pbSet, sessionSummaries } from './metrics'
import { colourName, formatKey, formatLabel } from './records'
import { comebacks } from './comeback'

export type MonthSummary = {
  /** YYYY-MM */
  month: string
  label: string
  daysPlayed: number
  puzzles: number
  breaks: number
  dailies: number
  powerRuns: number
  powerMinutes: number
  cleanPct: number | null
  pbs: number
  /** her most-played size and fastest time on it this month */
  fastest: { n: number; timeMs: number } | null
  bestRun: { score: number; format: string } | null
  /** the colour she spots first most often */
  firstColour: { name: string; hex: string; times: number } | null
  comebacks: number
  /** puzzles solved vs the month before (null if nothing then) */
  vsLastMonth: number | null
}

export const monthOf = (day: string) => day.slice(0, 7)

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Months she has played in, newest first. */
export function monthsPlayed(solves: SolveRecord[], runs: PowerRun[]): string[] {
  const set = new Set([...solves.map((s) => monthOf(s.day)), ...runs.filter((r) => r.solves.length).map((r) => monthOf(r.day))])
  return [...set].sort().reverse()
}

export function monthSummary(solves: SolveRecord[], runs: PowerRun[], month: string): MonthSummary {
  const ms = solves.filter((s) => monthOf(s.day) === month)
  const counted = ms.filter((s) => s.mode !== 'extra')
  const mr = runs.filter((r) => monthOf(r.day) === month && r.solves.length)
  const days = new Set([...ms.map((s) => s.day), ...mr.map((r) => r.day)])

  // most-played size, then her fastest clean-or-not solve on it
  const bySize = new Map<number, SolveRecord[]>()
  for (const s of counted) bySize.set(s.n, [...(bySize.get(s.n) ?? []), s])
  let fastest: MonthSummary['fastest'] = null
  const top = [...bySize.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0]
  if (top) fastest = { n: top[0], timeMs: Math.min(...top[1].map((s) => s.timeMs)) }

  const best = mr.reduce<PowerRun | null>((b, r) => (!b || r.score > b.score ? r : b), null)

  const firsts = new Map<string, { hex: string; times: number }>()
  const firstPicks = [
    ...ms.map((s) => s.picks),
    ...mr.flatMap((r) => r.solves.map((s) => s.picks)),
  ]
  for (const picks of firstPicks) {
    const p = [...(picks ?? [])].sort((a, b) => a.t - b.t)[0]
    if (!p || p.h || !p.c) continue
    const name = colourName(p.c)
    const cur = firsts.get(name)
    firsts.set(name, { hex: cur?.hex ?? p.c, times: (cur?.times ?? 0) + 1 })
  }
  const fc = [...firsts.entries()].sort((a, b) => b[1].times - a[1].times)[0]

  const pbs = [...pbSet(solves)].filter((s) => monthOf(s.day) === month).length
  const lastCount = solves.filter((s) => monthOf(s.day) === prevMonth(month)).length +
    runs.filter((r) => monthOf(r.day) === prevMonth(month)).reduce((a, r) => a + r.solves.length, 0)
  const puzzles = ms.length + mr.reduce((a, r) => a + r.solves.length, 0)

  return {
    month,
    label: monthLabel(month),
    daysPlayed: days.size,
    puzzles,
    breaks: sessionSummaries(ms).length,
    dailies: ms.filter((s) => s.mode === 'daily').length,
    powerRuns: mr.length,
    powerMinutes: Math.round(mr.reduce((a, r) => a + Math.min(r.durationMs ?? 3_600_000, (r.endedAt ?? r.startedAt) - r.startedAt), 0) / 60_000),
    cleanPct: counted.length ? Math.round((100 * counted.filter((s) => s.clean).length) / counted.length) : null,
    pbs,
    fastest,
    bestRun: best ? { score: best.score, format: formatLabel(formatKey(best)) } : null,
    firstColour: fc ? { name: fc[0], hex: fc[1].hex, times: fc[1].times } : null,
    comebacks: comebacks(solves, runs).filter((c) => monthOf(c.day) === month).length,
    vsLastMonth: lastCount ? puzzles - lastCount : null,
  }
}

// Comebacks: coming back after a few days away is the hard part with ADHD, so it gets
// noticed and celebrated, never guilt-tripped. Pure, tested.

import type { SolveRecord } from '../db'
import type { PowerRun } from '../power/state'
import { daysBetween, formatTime, median } from './metrics'

export const COMEBACK_GAP_DAYS = 3

export type Comeback = {
  day: string
  /** whole days since she last played */
  gapDays: number
  /** first counted puzzle that day, and her usual time for that size just before */
  first: SolveRecord | null
  usualMs: number | null
}

function playDays(solves: SolveRecord[], runs: PowerRun[]): string[] {
  const days = new Set<string>()
  for (const s of solves) days.add(s.day)
  for (const r of runs) if (r.solves.length || r.endedAt) days.add(r.day)
  return [...days].sort()
}

/** Days since she last played before `day` (null if she never had). */
export function gapBefore(solves: SolveRecord[], runs: PowerRun[], day: string): number | null {
  const prev = playDays(solves, runs).filter((d) => d < day)
  return prev.length ? daysBetween(prev[prev.length - 1], day) : null
}

function usualBefore(solves: SolveRecord[], n: number, at: number): number | null {
  const prior = solves.filter((s) => s.n === n && s.mode !== 'extra' && s.at < at).slice(-10)
  return prior.length >= 3 ? median(prior.map((s) => s.timeMs)) : null
}

/** Every day she came back after COMEBACK_GAP_DAYS+ away, oldest first. */
export function comebacks(solves: SolveRecord[], runs: PowerRun[]): Comeback[] {
  const days = playDays(solves, runs)
  const sorted = [...solves].sort((a, b) => a.at - b.at)
  const out: Comeback[] = []
  for (let i = 1; i < days.length; i++) {
    const gapDays = daysBetween(days[i - 1], days[i])
    if (gapDays < COMEBACK_GAP_DAYS) continue
    const first = sorted.find((s) => s.day === days[i] && s.mode !== 'extra') ?? null
    out.push({ day: days[i], gapDays, first, usualMs: first ? usualBefore(sorted, first.n, first.at) : null })
  }
  return out
}

/** How much faster than usual the first puzzle back was (negative = slower). */
export function vsUsualPct(c: Comeback): number | null {
  if (!c.first || !c.usualMs) return null
  return Math.round(((c.usualMs - c.first.timeMs) / c.usualMs) * 100)
}

export type ComebackStats = {
  count: number
  longestGap: Comeback | null
  /** first puzzle back that beat her usual by the most */
  sharpest: Comeback | null
}

export function comebackStats(list: Comeback[]): ComebackStats {
  let longestGap: Comeback | null = null
  let sharpest: Comeback | null = null
  for (const c of list) {
    if (!longestGap || c.gapDays > longestGap.gapDays) longestGap = c
    const p = vsUsualPct(c)
    if (p !== null && p > 0 && (!sharpest || p > (vsUsualPct(sharpest) ?? 0))) sharpest = c
  }
  return { count: list.length, longestGap, sharpest }
}

/** Welcome-back card for today's comeback (null if today isn't one). */
export function welcomeBack(
  solves: SolveRecord[],
  runs: PowerRun[],
  day: string,
): { title: string; lines: string[] } | null {
  const all = comebacks(solves, runs)
  const today = all.find((c) => c.day === day)
  if (!today) return null
  const lines: string[] = []
  const earlier = all.filter((c) => c.day < day)
  const p = vsUsualPct(today)
  if (today.first && today.usualMs !== null && p !== null) {
    const size = `${today.first.n}×${today.first.n}`
    lines.push(
      p >= 0
        ? `First puzzle back: ${formatTime(today.first.timeMs)}. Your usual ${size} is ${formatTime(today.usualMs)}.`
        : `First puzzle back: ${formatTime(today.first.timeMs)} (usual ${size} ${formatTime(today.usualMs)}). A slower start after time off is normal.`,
    )
    const best = comebackStats(earlier).sharpest
    if (p > 0 && earlier.length && (!best || p > (vsUsualPct(best) ?? 0))) lines.push('Your sharpest comeback yet.')
  }
  // one record line at most: short enough to take in at a glance
  const hasRecord = lines.length > 1
  if (!hasRecord && earlier.length && today.gapDays > Math.max(...earlier.map((c) => c.gapDays))) {
    lines.push(`Your longest time away, and you still came back.`)
  }
  lines.push(`Coming back is the hard part. You did it.`)
  return { title: `Welcome back: first play in ${today.gapDays} days`, lines }
}

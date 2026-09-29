// Ghost race: during a Power run she races her own best run of the same format.
// Pure helpers; the ghost is stored on the run so it survives a reload.

import type { PowerRun } from './state'
import { formatKey } from '../stats/records'

export type Ghost = {
  /** the run being raced */
  id: string
  day: string
  score: number
  puzzles: number
  /** cumulative progress: real ms into the run → puzzles solved and score so far */
  marks: { at: number; puzzles: number; score: number }[]
}

/** Her best run (by score) of this format, or null if there isn't one yet. */
export function pickGhost(history: PowerRun[], run: PowerRun): Ghost | null {
  const key = formatKey(run)
  const best = history
    .filter((r) => r.id !== run.id && r.endedAt && formatKey(r) === key && r.solves.length > 0)
    .sort((a, b) => b.score - a.score || a.startedAt - b.startedAt)[0]
  if (!best) return null
  let score = 0
  const marks = best.solves.map((s, i) => {
    score += s.score
    return { at: s.at, puzzles: i + 1, score }
  })
  return { id: best.id, day: best.day, score: best.score, puzzles: best.solves.length, marks }
}

/** Where the ghost was at a moment of the run. */
export function ghostAt(ghost: Ghost, atMs: number): { puzzles: number; score: number } {
  let last = { puzzles: 0, score: 0 }
  for (const m of ghost.marks) {
    if (m.at > atMs) break
    last = m
  }
  return last
}

export type Race = { you: number; ghost: number; lead: number; youScore: number; ghostScore: number }

/** Puzzle-count race (score breaks ties), at a moment of the run. */
export function race(ghost: Ghost, run: PowerRun, atMs: number): Race {
  const g = ghostAt(ghost, atMs)
  const youScore = run.solves.filter((s) => s.at <= atMs).reduce((a, s) => a + s.score, 0)
  const you = run.solves.filter((s) => s.at <= atMs).length
  return { you, ghost: g.puzzles, lead: you - g.puzzles, youScore, ghostScore: g.score }
}

/** One line for the results screen. */
export function raceVerdict(ghost: Ghost, run: PowerRun): string {
  const you = run.solves.length
  const d = you - ghost.puzzles
  const ds = run.score - ghost.score
  if (d > 0) return `You beat your ghost by ${d} puzzle${d === 1 ? '' : 's'}.`
  if (d < 0) return `Your ghost edged it by ${-d} puzzle${d === -1 ? '' : 's'}. Next time.`
  if (ds > 0) return `Level on puzzles, but you beat your ghost on points (+${ds.toLocaleString('en-GB')}).`
  if (ds < 0) return 'Level on puzzles; your ghost just had the points.'
  return 'Dead heat with your ghost.'
}

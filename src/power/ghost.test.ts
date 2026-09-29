import { describe, expect, it } from 'vitest'
import type { PowerRun, PowerSolve } from './state'
import { pickGhost, ghostAt, race, raceVerdict } from './ghost'

const s = (at: number, score = 500): PowerSolve => ({
  at, n: 9, difficulty: 'medium', timeMs: 60_000, clean: true, score, combo: 1, stage: 'warm', boss: false,
})

function run(id: string, over: Partial<PowerRun> = {}): PowerRun {
  return {
    id, day: '2026-09-30', startedAt: 1000, durationMs: 600_000, mode: 'wild', baseN: 9, solves: [], started: 0,
    bossDone: false, currentBoss: false, combo: 0, bestCombo: 0, peakAt: 0, score: 0, mistakes: 0, awayMs: 0,
    switches: 0, longestFocusMs: 0, focusSince: 0, sound: false, endedAt: 700_000, ...over,
  }
}

describe('ghost race', () => {
  const best = run('best', { solves: [s(60_000), s(120_000), s(200_000)], score: 1500 })
  const weaker = run('weak', { solves: [s(90_000)], score: 500 })
  const otherFormat = run('calm', { mode: 'calm', solves: [s(10_000), s(20_000), s(30_000), s(40_000)], score: 9000 })
  const now = run('now', { startedAt: 800_000, endedAt: undefined })

  it('races the best run of the same format only', () => {
    const g = pickGhost([best, weaker, otherFormat, now], now)!
    expect(g.id).toBe('best')
    expect(g.marks.map((m) => m.puzzles)).toEqual([1, 2, 3])
    expect(g.marks[2].score).toBe(1500)
  })

  it('has no ghost for a format played for the first time', () => {
    expect(pickGhost([otherFormat], now)).toBeNull()
  })

  it('knows where the ghost was at any moment', () => {
    const g = pickGhost([best], now)!
    expect(ghostAt(g, 0)).toEqual({ puzzles: 0, score: 0 })
    expect(ghostAt(g, 130_000)).toMatchObject({ puzzles: 2 })
    expect(ghostAt(g, 999_000)).toMatchObject({ puzzles: 3, score: 1500 })
  })

  it('reports the lead and the final verdict', () => {
    const g = pickGhost([best], now)!
    const me = run('now', { solves: [s(50_000), s(100_000)], score: 1000 })
    expect(race(g, me, 110_000).lead).toBe(1)
    expect(race(g, me, 130_000).lead).toBe(0)
    expect(raceVerdict(g, me)).toMatch(/edged it by 1 puzzle/)
    const win = run('now', { solves: [s(1), s(2), s(3), s(4)], score: 2000 })
    expect(raceVerdict(g, win)).toBe('You beat your ghost by 1 puzzle.')
    const tieWin = run('now', { solves: [s(1), s(2), s(3)], score: 1600 })
    expect(raceVerdict(g, tieWin)).toMatch(/beat your ghost on points/)
  })
})

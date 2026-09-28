import { describe, expect, it } from 'vitest'
import type { SolveRecord } from '../db'
import type { PowerRun, PowerSolve } from '../power/state'
import type { MoodPair } from '../mood'
import {
  crescendo,
  focusStats,
  moodLift,
  peakEnd,
  powerBests,
  realLife,
  settlingMs,
  steadyBlocks,
  vsLastTime,
  warmUp,
  weekMinutes,
} from './psych'

const MIN = 60_000
let seq = 0
function rec(p: Partial<SolveRecord>): SolveRecord {
  seq++
  return {
    at: seq * 1000, day: '2026-09-28', mode: 'session', level: 1, n: 7, difficulty: 'easy', grade: 1,
    timeMs: 60_000, firstTapMs: 1000, mistakes: 0, hints: 0, assists: 0, undos: 0, clean: true, score: 100,
    themeId: 't', ...p,
  }
}
function ps(p: Partial<PowerSolve>): PowerSolve {
  return { at: 0, n: 7, difficulty: 'easy', timeMs: 120_000, clean: true, score: 100, combo: 1, stage: 'warm', boss: false, ...p }
}
function run(p: Partial<PowerRun>): PowerRun {
  return {
    id: 'p', day: '2026-09-28', startedAt: 0, endedAt: 60 * MIN, endReason: 'time', baseN: 7, solves: [], started: 0,
    bossDone: false, currentBoss: false, combo: 0, bestCombo: 0, peakAt: 0, score: 0, mistakes: 0, awayMs: 0,
    switches: 0, longestFocusMs: 0, focusSince: 0, sound: false, ...p,
  }
}
const pair = (kind: 'break' | 'power', before: number, after: number): MoodPair =>
  ({ kind, ref: String(Math.random()), day: 'd', before, after }) as MoodPair

describe('moodLift', () => {
  it('needs at least 3 pairs of that kind', () => {
    expect(moodLift([pair('break', 2, 4), pair('break', 2, 4), pair('power', 1, 5)], 'break')).toBeNull()
  })
  it('leads with better, mentions same', () => {
    const m = moodLift([pair('break', 2, 4), pair('break', 3, 3), pair('break', 3, 4), pair('break', 4, 3)], 'break')!
    expect(m.line).toBe('After breaks you felt better 2 of 4 times')
    expect(m.sub).toBe('About the same 1 time')
  })
  it('stays neutral when nothing improved', () => {
    const m = moodLift([pair('power', 3, 3), pair('power', 3, 3), pair('power', 4, 3)], 'power')!
    expect(m.line).toBe('After Power Hours you felt about the same 2 of 3 times')
    expect(m.line).not.toMatch(/worse/)
  })
})

describe('warmUp', () => {
  const session = (id: string, first: number, rest: number[], n = 7) => [
    rec({ sessionId: id, timeMs: first, n }),
    ...rest.map((t) => rec({ sessionId: id, timeMs: t, n })),
  ]
  it('reports the median paired speed-up', () => {
    const solves = [
      ...session('a', 100_000, [80_000, 80_000, 80_000, 80_000]),
      ...session('b', 100_000, [80_000, 80_000]),
      ...session('c', 50_000, [40_000, 40_000, 40_000, 40_000]),
    ]
    const w = warmUp(solves)!
    expect(w.pct).toBe(20)
    expect(w.sessions).toBe(3)
    expect(w.line).toBe("You're 20% quicker after your first puzzle")
  })
  it('ignores other sizes, other modes and puzzles past the 5th', () => {
    const solves = [
      rec({ sessionId: 'a', timeMs: 100_000, n: 8 }), // first is 8×8, none of 2–5 match → skipped
      rec({ sessionId: 'a', timeMs: 50_000, n: 7 }),
      ...session('b', 100_000, [90_000]),
      ...session('c', 100_000, [90_000]),
      rec({ sessionId: 'x', mode: 'daily', timeMs: 1 }),
    ]
    expect(warmUp(solves)).toBeNull() // only 2 usable breaks
  })
  it('stays quiet when not quicker', () => {
    const solves = ['a', 'b', 'c'].flatMap((id) => session(id, 60_000, [62_000, 61_000]))
    expect(warmUp(solves)).toBeNull()
  })
})

describe('Power Hour metrics', () => {
  const solves = [
    ps({ at: 4 * MIN, clean: false }),
    ps({ at: 7 * MIN, clean: true }),
    ps({ at: 12 * MIN }),
    ps({ at: 17 * MIN }),
    ps({ at: 58 * MIN, n: 9, timeMs: 200_000, boss: true }),
  ]
  const r = run({ solves, bestCombo: 4, peakAt: 58 * MIN, switches: 2, longestFocusMs: 30 * MIN, awayMs: 90_000 })

  it('settling = first clean solve', () => {
    expect(settlingMs(r)).toBe(7 * MIN)
    expect(settlingMs(run({ solves: [ps({ clean: false })] }))).toBeNull()
  })
  it('focus stats pass through, capped by the hour', () => {
    expect(focusStats(r)).toEqual({ longestMs: 30 * MIN, switches: 2, awayMs: 90_000 })
    expect(focusStats(run({ endedAt: 10 * MIN, longestFocusMs: 99 * MIN })).longestMs).toBe(10 * MIN)
  })
  it('crescendo counts per 5-minute block', () => {
    expect(crescendo(r)).toEqual([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(crescendo(run({ solves: [ps({ at: 60 * MIN })] }))[11]).toBe(1)
  })
  it('peak–end', () => {
    const pe = peakEnd(r)
    expect(pe.peak).toEqual({ combo: 4, at: 58 * MIN })
    expect(pe.end.kind).toBe('boss')
    expect(peakEnd(run({ solves: [ps({ at: 59.5 * MIN })] })).end.kind).toBe('bell')
    expect(peakEnd(run({ solves: [ps({ at: 40 * MIN })] })).end.text).toBe('Time ran out mid-puzzle')
    expect(peakEnd(run({ solves: [ps({ at: 5 * MIN })], endReason: 'early', endedAt: 20 * MIN })).end.text).toBe('You called it at 20 min')
    expect(peakEnd(run({ bestCombo: 1 })).peak).toBeNull()
  })
  it('steady blocks use pace per cell against the run median', () => {
    // pace: 7×7 at 120s ≈ 2449 ms/cell; 9×9 at 200s ≈ 2469 → all within ±35%
    expect(steadyBlocks(r)).toEqual({ steady: 5, total: 12 })
    const wild = run({ solves: [ps({ at: 1 * MIN, timeMs: 30_000 }), ps({ at: 6 * MIN }), ps({ at: 11 * MIN })], endedAt: 15 * MIN, endReason: 'early' })
    expect(steadyBlocks(wild)).toEqual({ steady: 2, total: 3 })
  })
  it('bests and vs last time (gains only)', () => {
    const a = run({ id: 'a', startedAt: 1, solves: [ps({}), ps({})], score: 500, bestCombo: 3 })
    const b = run({ id: 'b', startedAt: 2, solves: [ps({}), ps({}), ps({})], score: 400, bestCombo: 3 })
    expect(powerBests([a, b])).toEqual({ puzzles: 3, score: 500, combo: 3 })
    expect(vsLastTime([b, a])).toEqual({ lines: ['+1 puzzle vs last time'], neutral: null })
    const worse = vsLastTime([b, run({ id: 'c', startedAt: 3, score: 1 })])!
    expect(worse.lines).toEqual([])
    expect(worse.neutral).toBeTruthy()
    expect(vsLastTime([a])).toBeNull()
  })
})

describe('real-life framing', () => {
  it('week minutes counts solves and power hours in the ISO week only', () => {
    // 2026-09-28 is a Monday
    const s = [rec({ day: '2026-09-28', timeMs: 10 * MIN }), rec({ day: '2026-09-27', timeMs: 99 * MIN })]
    expect(weekMinutes(s, [run({ day: '2026-09-29', endedAt: 60 * MIN })], '2026-09-30')).toBe(70)
  })
  it('picks accurate comparisons', () => {
    expect(realLife(1)).toBeNull()
    expect(realLife(7)).toBe('about as long as 2 songs')
    expect(realLife(24)).toBe('about half an episode of telly')
    expect(realLife(45)).toBe('about one episode of telly')
    expect(realLife(70)).toBe('about 1.5 episodes of telly')
    expect(realLife(240)).toBe('about 2 films')
  })
})

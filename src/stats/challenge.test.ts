import { describe, expect, it } from 'vitest'
import type { PowerRun, PowerSolve } from '../power/state'
import type { SolveRecord } from '../db'
import { pickChallenge, checkChallenge } from './challenge'

const WEEK = '2026-09-28'
const NOW = new Date(2026, 8, 28, 9).getTime()

const s = (at: number, over: Partial<PowerSolve> = {}): PowerSolve => ({
  at, n: 9, difficulty: 'medium', timeMs: 80_000, clean: true, score: 800, combo: 1, stage: 'warm', boss: false,
  firstTapMs: 2500, picks: [{ t: 3000, c: '#00F0FF' }, { t: 7000, c: '#FF2BD6' }, { t: 11_000, c: '#FFE600' }], ...over,
})

function run(id: string, startedAt: number, over: Partial<PowerRun> = {}): PowerRun {
  return {
    id, day: WEEK, startedAt, durationMs: 600_000, mode: 'wild', baseN: 9, solves: [s(60_000), s(150_000), s(240_000)],
    started: 3, bossDone: false, currentBoss: false, combo: 0, bestCombo: 3, peakAt: 0, score: 2400, mistakes: 1,
    awayMs: 0, switches: 0, longestFocusMs: 0, focusSince: 0, sound: false, endedAt: startedAt + 600_000, endReason: 'time',
    ...over,
  }
}

describe('weekly challenge', () => {
  const history = [run('a', NOW - 5 * 86_400_000)]

  it('is picked from her own records and stays the same for the week', () => {
    const a = pickChallenge(history, [], WEEK, NOW, 'salt')
    const b = pickChallenge(history, [], WEEK, NOW + 3600_000, 'salt')
    expect(a.kind).toBe('power')
    expect(a.key).toBe('10-wild')
    expect(a.title).toMatch(/in 10-min Wild$/)
    expect(a.sub).toMatch(/to beat$/)
    expect({ ...a, setAt: 0 }).toEqual({ ...b, setAt: 0 })
  })

  it('changes with the week', () => {
    const titles = new Set(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((w) => pickChallenge(history, [], w, NOW, 'salt').recId))
    expect(titles.size).toBeGreaterThan(1)
  })

  it('offers a starter when there is nothing to beat yet', () => {
    const c = pickChallenge([], [], WEEK, NOW)
    expect(c.kind).toBe('starter')
    expect(checkChallenge(c, [], [])).toBeNull()
    expect(checkChallenge(c, [run('x', NOW + 1000)], [])).not.toBeNull()
  })

  it('only play after it was set can complete it, and only by beating the target', () => {
    const c = { ...pickChallenge(history, [], WEEK, NOW, 'salt'), recId: 'colour-Cyan', target: 3000, better: 'low' as const }
    // the old run that set the record doesn't count
    expect(checkChallenge(c, history, [])).toBeNull()
    // matching isn't beating
    expect(checkChallenge(c, [...history, run('same', NOW + 1000)], [])).toBeNull()
    // beating it does
    const faster = run('fast', NOW + 2000, { solves: [s(60_000, { picks: [{ t: 1800, c: '#00F0FF' }] })] })
    expect(checkChallenge(c, [...history, faster], [])).toEqual({ display: '1.8s' })
  })

  it('works for break records too', () => {
    const base = { day: WEEK, mode: 'session', level: 1, difficulty: 'easy', grade: 1, mistakes: 0, hints: 0, assists: 0, undos: 0, clean: true, score: 1, themeId: 'x', n: 9 } as const
    const solves: SolveRecord[] = [{ ...base, id: 1, at: NOW - 1000, timeMs: 70_000, firstTapMs: 2000, picks: [{ t: 4000, c: '#8E7BDB' }] }]
    const c = pickChallenge([], solves, WEEK, NOW, 'salt')
    expect(c.kind).toBe('break')
    expect(c.title).toMatch(/9×9 breaks$/)
  })
})

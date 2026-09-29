import { describe, expect, it } from 'vitest'
import type { SolveRecord } from '../db'
import type { PowerRun } from '../power/state'
import { archiveDays, replayLine } from './archive'
import { comebacks, comebackStats, gapBefore, welcomeBack } from './comeback'
import { monthSummary, monthsPlayed, prevMonth } from './monthly'

const spec = () => ({ n: 9, difficulty: 'medium' as const })

function solve(day: string, over: Partial<SolveRecord> = {}): SolveRecord {
  return {
    at: new Date(day + 'T10:00:00').getTime(), day, mode: 'session', sessionId: `s-${day}`, level: 1, n: 9,
    difficulty: 'medium', grade: 2, timeMs: 100_000, firstTapMs: 2000, mistakes: 0, hints: 0, assists: 0,
    undos: 0, clean: true, score: 500, themeId: 'x', ...over,
  }
}

function run(day: string, over: Partial<PowerRun> = {}): PowerRun {
  const startedAt = new Date(day + 'T18:00:00').getTime()
  return {
    id: `r-${day}`, day, startedAt, durationMs: 600_000, mode: 'wild', endedAt: startedAt + 600_000, endReason: 'time',
    baseN: 8, started: 2, bossDone: false, currentBoss: false, combo: 0, bestCombo: 2, peakAt: 0, score: 1500,
    mistakes: 0, awayMs: 0, switches: 0, longestFocusMs: 0, focusSince: 0, sound: false,
    solves: [{ at: 60_000, n: 8, difficulty: 'easy', timeMs: 50_000, clean: true, score: 750, combo: 1, stage: 'warm', boss: false, picks: [{ t: 1500, c: '#FF2BD6' }] }],
    ...over,
  }
}

describe('daily archive', () => {
  it('lists past days newest first with the time on the day and the best replay', () => {
    const solves = [
      solve('2026-09-27', { mode: 'daily', timeMs: 120_000 }),
      solve('2026-09-28', { mode: 'extra', replayOf: '2026-09-27', timeMs: 90_000 }),
      solve('2026-09-28', { mode: 'extra', replayOf: '2026-09-27', timeMs: 95_000 }),
    ]
    const days = archiveDays(solves, '2026-09-29', spec, 5)
    expect(days.map((d) => d.day)).toEqual(['2026-09-28', '2026-09-27', '2026-09-26', '2026-09-25', '2026-09-24'])
    expect(days[1].onDay?.timeMs).toBe(120_000)
    expect(days[1].bestReplay?.timeMs).toBe(90_000)
    expect(days[1].replays).toBe(2)
    expect(days[0].onDay).toBeNull()
  })

  it('says how a replay compares with the day, honestly', () => {
    expect(replayLine(90_000, 120_000, null)).toBe('30s faster than on the day (2:00)')
    expect(replayLine(130_000, 120_000, null)).toMatch(/On the day you took 2:00/)
    expect(replayLine(120_400, 120_000, null)).toMatch(/Level with/)
    expect(replayLine(80_000, null, 100_000)).toBe('Faster than your last go by 20s')
    expect(replayLine(80_000, null, null)).toMatch(/Missed it on the day/)
  })
})

describe('comebacks', () => {
  const regular = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map((d) => solve(d))
  it('finds days after 3+ days away, with the first puzzle vs her usual', () => {
    const back = solve('2026-09-10', { timeMs: 80_000 })
    const list = comebacks([...regular, back], [])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ day: '2026-09-10', gapDays: 6, usualMs: 100_000 })
    expect(list[0].first?.timeMs).toBe(80_000)
    expect(gapBefore([...regular, back], [], '2026-09-10')).toBe(6)
  })

  it('counts Power runs as play, so a run in between is not a gap', () => {
    const list = comebacks([...regular, solve('2026-09-09')], [run('2026-09-07')])
    expect(list.map((c) => c.day)).toEqual(['2026-09-07'])
  })

  it('keeps the longest gap and the sharpest comeback', () => {
    const solves = [...regular, solve('2026-09-08', { timeMs: 90_000 }), solve('2026-09-20', { timeMs: 99_000 })]
    const st = comebackStats(comebacks(solves, []))
    expect(st.count).toBe(2)
    expect(st.longestGap?.day).toBe('2026-09-20')
    expect(st.sharpest?.day).toBe('2026-09-08')
  })

  it('welcomes her back warmly, never guilt', () => {
    const w = welcomeBack([...regular, solve('2026-09-10', { timeMs: 130_000 })], [], '2026-09-10')!
    expect(w.title).toBe('Welcome back: first play in 6 days')
    expect(w.lines.join(' ')).toMatch(/slower start after time off is normal/)
    expect(w.lines.at(-1)).toBe('Coming back is the hard part. You did it.')
    expect(welcomeBack(regular, [], '2026-09-04')).toBeNull()
  })
})

describe('month card', () => {
  it('sums a month across breaks, dailies and Power', () => {
    const solves = [
      solve('2026-08-30'),
      solve('2026-09-01'), solve('2026-09-01', { timeMs: 70_000, picks: [{ t: 900, c: '#FF2BD6' }] }),
      solve('2026-09-02', { mode: 'daily', sessionId: undefined, clean: false }),
      solve('2026-09-03', { mode: 'extra', sessionId: undefined }),
    ]
    const m = monthSummary(solves, [run('2026-09-05')], '2026-09')
    expect(m).toMatchObject({
      label: 'September 2026', daysPlayed: 4, puzzles: 5, breaks: 1, dailies: 1, powerRuns: 1, powerMinutes: 10,
      cleanPct: 67, fastest: { n: 9, timeMs: 70_000 }, bestRun: { score: 1500, format: '10-min Wild' }, vsLastMonth: 4,
    })
    expect(m.firstColour).toMatchObject({ name: 'Magenta', times: 2 })
    expect(monthsPlayed(solves, [])).toEqual(['2026-09', '2026-08'])
    expect(prevMonth('2026-01')).toBe('2025-12')
  })
})

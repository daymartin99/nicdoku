import { describe, expect, it } from 'vitest'
import type { PowerRun, PowerSolve } from '../power/state'
import {
  colourName, formatRecords, newRecords, newWeeklyRecords, isFirstOfFormat, rankOf, topRuns, topSolves,
  formatKey, formatLabel, formatsPlayed, breakRecords, weekStart, thisWeek, ordinal,
} from './records'
import type { SolveRecord } from '../db'

const DAY = 86_400_000
const WED = new Date(2026, 8, 30, 12).getTime() // Wed 30 Sep 2026

function solve(at: number, over: Partial<PowerSolve> = {}): PowerSolve {
  return {
    at, n: 9, difficulty: 'medium', timeMs: 90_000, clean: true, score: 800, combo: 1, stage: 'warm', boss: false,
    firstTapMs: 3000,
    picks: [
      { t: 4000, c: '#F5A2DE' }, // pink
      { t: 9000, c: '#2E8A56' }, // dark green
      { t: 15000, c: '#8E7BDB' }, // purple
    ],
    ...over,
  }
}

function run(id: string, startedAt: number, over: Partial<PowerRun> = {}): PowerRun {
  return {
    id, day: '2026-09-30', startedAt, durationMs: 600_000, mode: 'wild', baseN: 9,
    solves: [solve(60_000), solve(150_000), solve(240_000)], started: 3, bossDone: false, currentBoss: false,
    combo: 0, bestCombo: 3, peakAt: 0, score: 2400, mistakes: 1, awayMs: 0, switches: 0, longestFocusMs: 0,
    focusSince: 0, sound: false, endedAt: startedAt + 600_000, endReason: 'time',
    ...over,
  }
}

describe('colour names', () => {
  it('names the classic palette distinctly', () => {
    const names = ['#8E7BDB', '#A86E4E', '#F7A05E', '#2E8A56', '#8DD67E', '#F5A2DE', '#A8C8E6', '#D5718E', '#D7B03A', '#4FB3B0', '#F07B6B'].map(colourName)
    expect(names).toEqual(['Purple', 'Brown', 'Orange', 'Dark green', 'Green', 'Pink', 'Light blue', 'Rose', 'Yellow', 'Teal', 'Coral'])
    expect(new Set(names).size).toBe(names.length)
  })
  it('names neon colours', () => {
    expect(colourName('#FF2BD6')).toBe('Magenta')
    expect(colourName('#00F0FF')).toBe('Cyan')
    expect(colourName('#FF9EF5')).toBe('Pink')
    expect(colourName('#C6FF00')).toBe('Lime')
    expect(colourName('nope')).toBe('Colour')
  })
})

describe('format record book', () => {
  it('collects run, speed and colour records', () => {
    const recs = formatRecords([run('a', WED)])
    const ids = recs.map((r) => r.id)
    for (const id of ['score', 'puzzles', 'combo', 'clean', 'mistakes', 'to-3', 'first-tap', 'piece-1', 'piece-2', 'piece-3', 'solve-9', 'colour-Pink', 'colour-Dark green', 'colour-Purple']) {
      expect(ids).toContain(id)
    }
    expect(recs.find((r) => r.id === 'piece-2')?.display).toBe('9.0s')
    expect(recs.find((r) => r.id === 'colour-Pink')?.label).toBe('Fastest pink')
  })

  it('hinted pieces never set speed records', () => {
    const hinted = run('h', WED, { solves: [solve(60_000, { picks: [{ t: 500, c: '#F5A2DE', h: true }, { t: 900, c: '#8E7BDB' }], timeMs: 10_000 })] })
    const recs = formatRecords([hinted])
    expect(recs.find((r) => r.id === 'piece-1')).toBeUndefined()
    expect(recs.find((r) => r.id === 'colour-Pink')).toBeUndefined()
    expect(recs.find((r) => r.id === 'solve-9')).toBeUndefined()
    expect(recs.find((r) => r.id === 'colour-Purple')?.value).toBe(900)
  })

  it('early-ended or tiny runs do not count for fewest mistakes', () => {
    const early = run('e', WED, { endReason: 'early', mistakes: 0 })
    expect(formatRecords([early]).find((r) => r.id === 'mistakes')).toBeUndefined()
  })
})

describe('new records after a run', () => {
  const a = run('a', WED - 2 * DAY)
  const b = run('b', WED, {
    score: 3000,
    solves: [solve(40_000, { picks: [{ t: 2500, c: '#F5A2DE' }, { t: 9500, c: '#2E8A56' }, { t: 12_000, c: '#00F0FF' }] }), solve(100_000), solve(200_000)],
  })

  it('reports what the run beat, not what it merely matched', () => {
    const ids = newRecords([a, b], 'b').map((r) => r.id)
    expect(ids).toContain('score')
    expect(ids).toContain('colour-Pink')
    expect(ids).toContain('piece-1')
    expect(ids).toContain('colour-Cyan') // a first-ever colour counts
    expect(ids).toContain('to-3')
    expect(ids).not.toContain('puzzles') // same count, not beaten
    expect(ids).not.toContain('colour-Dark green') // slower than before
  })

  it("a format's first run has no 'new records', just a first", () => {
    expect(newRecords([a], 'a')).toEqual([])
    expect(isFirstOfFormat([a, b], 'a')).toBe(true)
    expect(isFirstOfFormat([a, b], 'b')).toBe(false)
  })

  it('weekly records are the ones that beat this week but not all time', () => {
    const old = run('old', WED - 14 * DAY, { score: 9999 })
    const mon = run('mon', weekStart(WED) + 3600_000, { score: 1000 })
    const now = run('now', WED, { score: 2000 })
    const weekly = newWeeklyRecords([old, mon, now], 'now', WED).map((r) => r.id)
    expect(weekly).toContain('score')
    expect(newRecords([old, mon, now], 'now').map((r) => r.id)).not.toContain('score')
  })
})

describe('tables, ranks and formats', () => {
  const runs = [run('a', WED - DAY, { score: 1000 }), run('b', WED, { score: 3000 }), run('c', WED - 3 * DAY, { score: 2000 })]
  it('ranks and top tables', () => {
    expect(rankOf(runs, 'c', (r) => r.score)).toEqual({ rank: 2, of: 3 })
    expect(topRuns(runs).map((r) => r.ref)).toEqual(['b', 'c', 'a'])
    expect(topSolves(runs, 2)).toHaveLength(2)
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(23)).toBe('23rd')
  })
  it('format keys and labels', () => {
    expect(formatKey(runs[0])).toBe('10-wild')
    expect(formatLabel('10-wild')).toBe('10-min Wild')
    expect(formatKey(run('x', 0, { durationMs: undefined, mode: undefined }))).toBe('60-normal')
    expect(formatsPlayed([run('p', 1, { mode: 'calm' }), run('q', 2)])).toEqual(['10-wild', '10-calm'])
  })
  it('weeks start on Monday', () => {
    const mon = new Date(weekStart(WED))
    expect(mon.getDay()).toBe(1)
    expect(thisWeek([run('old', WED - 9 * DAY), run('new', WED)], WED).map((r) => r.id)).toEqual(['new'])
  })
})

describe('break records by size', () => {
  it('uses only this size and skips hinted solves for solve time', () => {
    const base = { day: '2026-09-30', mode: 'session', level: 1, difficulty: 'easy', grade: 1, mistakes: 0, assists: 0, undos: 0, clean: true, score: 1, themeId: 'x' } as const
    const solves: SolveRecord[] = [
      { ...base, id: 1, at: 1, n: 9, timeMs: 60_000, firstTapMs: 2000, hints: 0, picks: [{ t: 3000, c: '#F5A2DE' }] },
      { ...base, id: 2, at: 2, n: 9, timeMs: 30_000, firstTapMs: 1000, hints: 1, picks: [{ t: 2000, c: '#F5A2DE', h: true }] },
      { ...base, id: 3, at: 3, n: 8, timeMs: 10_000, firstTapMs: 500, hints: 0 },
    ]
    const recs = breakRecords(solves, 9)
    expect(recs.find((r) => r.id === 'solve-9')?.value).toBe(60_000)
    expect(recs.find((r) => r.id === 'first-tap')?.value).toBe(1000)
    expect(recs.find((r) => r.id === 'colour-Pink')?.value).toBe(3000)
    expect(recs.find((r) => r.id === 'solve-8')).toBeUndefined()
  })
})

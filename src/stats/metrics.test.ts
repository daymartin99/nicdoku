import { describe, expect, it } from 'vitest'
import type { SolveRecord } from '../db'
import {
  addDays,
  cleanPersonalBests,
  cleanRun,
  dailySeries,
  daysBetween,
  fasterThanLine,
  fasterThanPct,
  formatDuration,
  formatTime,
  headline,
  heatmap,
  isNewPB,
  isoWeekStart,
  median,
  medianTime,
  pbSet,
  personalBests,
  sessionSummaries,
  sizeStats,
  sizesPlayed,
  streak,
  totals,
  trend,
} from './metrics'

let seq = 0
function rec(p: Partial<SolveRecord> & { day: string }): SolveRecord {
  seq++
  const [y, m, d] = p.day.split('-').map(Number)
  return {
    id: seq,
    at: new Date(y, m - 1, d, 12, 0, 0).getTime() + seq * 1000,
    mode: 'session',
    sessionId: `s-${p.day}`,
    level: 1,
    n: 9,
    difficulty: 'medium',
    grade: 3,
    timeMs: 120_000,
    firstTapMs: 3000,
    mistakes: 0,
    hints: 0,
    assists: 0,
    undos: 0,
    clean: true,
    score: 100,
    themeId: 'default',
    ...p,
  }
}

// 2026-09-27 is a Sunday; its ISO week starts Monday 2026-09-21.
const TODAY = '2026-09-27'

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-20', '2026-09-27')).toBe(7)
  })
  it('finds ISO week Monday', () => {
    expect(isoWeekStart('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(isoWeekStart('2026-09-21')).toBe('2026-09-21') // Monday
    expect(isoWeekStart('2026-09-24')).toBe('2026-09-21')
  })
})

describe('formatting', () => {
  it('formatTime', () => {
    expect(formatTime(102_000)).toBe('1:42')
    expect(formatTime(5_400)).toBe('0:05')
    expect(formatTime(3_723_000)).toBe('1:02:03')
  })
  it('formatDuration', () => {
    expect(formatDuration(3 * 3600_000 + 12 * 60_000)).toBe('3h 12m')
    expect(formatDuration(2 * 3600_000)).toBe('2h')
    expect(formatDuration(12 * 60_000 + 30_000)).toBe('12m')
    expect(formatDuration(42_000)).toBe('42s')
  })
})

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
  it('medianTime uses only the last K solves of that size, ignoring extra', () => {
    const s = [
      rec({ day: '2026-09-01', timeMs: 900_000 }), // old outlier, dropped by lastK=3
      rec({ day: '2026-09-02', timeMs: 100_000 }),
      rec({ day: '2026-09-03', timeMs: 200_000 }),
      rec({ day: '2026-09-04', timeMs: 300_000 }),
      rec({ day: '2026-09-05', timeMs: 1_000, mode: 'extra' }),
      rec({ day: '2026-09-05', timeMs: 5_000, n: 8 }),
    ]
    expect(medianTime(s, 9, 3)).toBe(200_000)
    expect(medianTime(s, 9)).toBe(250_000)
    expect(medianTime(s, 10)).toBeNull()
  })
})

describe('personal bests', () => {
  const s = [
    rec({ day: '2026-09-01', n: 9, timeMs: 150_000 }),
    rec({ day: '2026-09-02', n: 9, timeMs: 110_000, clean: false }),
    rec({ day: '2026-09-03', n: 9, timeMs: 130_000 }),
    rec({ day: '2026-09-03', n: 10, timeMs: 300_000 }),
    rec({ day: '2026-09-04', n: 9, timeMs: 50_000, mode: 'extra' }),
  ]
  it('keeps one best per size and ignores extra', () => {
    const pb = personalBests(s)
    expect(pb.get(9)!.timeMs).toBe(110_000)
    expect(pb.get(10)!.timeMs).toBe(300_000)
    expect(pb.size).toBe(2)
    expect(cleanPersonalBests(s).get(9)!.timeMs).toBe(130_000)
    expect(sizesPlayed(s)).toEqual([9, 10])
  })
  it('isNewPB needs 3 earlier solves of that size and must be strictly faster', () => {
    const first = rec({ day: '2026-09-01', n: 8, timeMs: 90_000 })
    expect(isNewPB([], first)).toBe(false)
    const faster = rec({ day: '2026-09-10', n: 9, timeMs: 100_000 })
    expect(isNewPB(s, faster)).toBe(true)
    const tie = rec({ day: '2026-09-10', n: 9, timeMs: 110_000 })
    expect(isNewPB(s, tie)).toBe(false)
    // only one earlier 10×10, so no "best" yet (and 9×9 times don't count toward it)
    const big = rec({ day: '2026-09-10', n: 10, timeMs: 299_000 })
    expect(isNewPB(s, big)).toBe(false)
    const tens = [310_000, 305_000].map((t, i) => rec({ day: `2026-09-0${i + 5}`, n: 10, timeMs: t }))
    expect(isNewPB([...s, ...tens], big)).toBe(true)
    // ignores rec if present in the list
    expect(isNewPB([...s, faster], faster)).toBe(true)
    // second-ever solve is never a best, however fast
    expect(isNewPB([first], rec({ day: '2026-09-02', n: 8, timeMs: 10_000 }))).toBe(false)
  })
  it('pbSet marks solves that were bests at the time (after 3 earlier solves)', () => {
    expect(pbSet(s).size).toBe(0) // 110k was only the 2nd 9×9
    const later = rec({ day: '2026-09-05', n: 9, timeMs: 105_000 })
    const set = pbSet([...s, later])
    expect([...set].map((x) => x.timeMs)).toEqual([105_000])
  })
})

describe('fasterThanPct', () => {
  const prior = [100, 110, 120, 130, 140, 150].map((t, i) =>
    rec({ day: `2026-09-0${i + 1}`, timeMs: t * 1000 }),
  )
  it('is null with fewer than 5 earlier solves', () => {
    const r = rec({ day: '2026-09-20', timeMs: 90_000 })
    expect(fasterThanPct(prior.slice(0, 4), r)).toBeNull()
  })
  it('counts strictly slower earlier solves of same size', () => {
    const r = rec({ day: '2026-09-20', timeMs: 125_000 })
    expect(fasterThanPct(prior, r)).toBe(50) // 130,140,150 of 6
    expect(fasterThanLine(prior, r)).toBe('Faster than 50% of your 9×9 solves')
  })
  it('stays quiet when under 50%', () => {
    const r = rec({ day: '2026-09-20', timeMs: 145_000 })
    expect(fasterThanPct(prior, r)).toBe(17)
    expect(fasterThanLine(prior, r)).toBeNull()
  })
  it('ignores later solves and other sizes', () => {
    const r = rec({ day: '2026-09-03', timeMs: 105_000 })
    const others = [...prior, rec({ day: '2026-09-01', n: 10, timeMs: 999_000 })]
    expect(fasterThanPct(others, r)).toBeNull() // only 2 earlier 9×9
  })
})

describe('streak', () => {
  it('counts active days in the last 7 and shows 14 days', () => {
    const s = ['2026-09-27', '2026-09-25', '2026-09-24', '2026-09-10'].map((day) => rec({ day }))
    const st = streak(s, TODAY)
    expect(st.activeLast7).toBe(3)
    expect(st.days).toHaveLength(14)
    expect(st.days[13]).toMatchObject({ day: TODAY, played: true })
    expect(st.days[0].day).toBe('2026-09-14')
  })

  it('does not break because today has not been played yet', () => {
    const s = ['2026-09-24', '2026-09-25', '2026-09-26'].map((day) => rec({ day }))
    const st = streak(s, TODAY)
    expect(st.current).toBe(3)
    expect(st.freezesLeftThisWeek).toBe(2)
    expect(st.days[13]).toMatchObject({ played: false, frozen: false })
  })

  it('bridges up to 2 missed days per week with freezes', () => {
    // Mon 21, Tue 22 played; Wed 23, Thu 24 missed; Fri 25 played
    const s = ['2026-09-21', '2026-09-22', '2026-09-25', '2026-09-26'].map((day) => rec({ day }))
    const st = streak(s, TODAY)
    expect(st.current).toBe(4)
    expect(st.best).toBe(4)
    expect(st.freezesLeftThisWeek).toBe(0)
    const frozen = st.days.filter((d) => d.frozen).map((d) => d.day)
    expect(frozen).toEqual(['2026-09-23', '2026-09-24'])
  })

  it('a third miss in the week resets the run but keeps best', () => {
    const s = ['2026-09-21', '2026-09-22', '2026-09-25'].map((day) => rec({ day }))
    const st = streak(s, TODAY) // 23, 24 frozen; Sat 26 has no freeze left
    expect(st.current).toBe(0)
    expect(st.best).toBe(3)
  })

  it('resets after a third miss in the same week', () => {
    // Thu 17 played; Fri 18, Sat 19 frozen; Sun 20 missed (week of 14th exhausted)
    const s = ['2026-09-16', '2026-09-17', '2026-09-22'].map((day) => rec({ day }))
    const st = streak(s, TODAY)
    // run: 16,17 (2) → frozen 18,19 → reset 20 → 21 (current 0, no freeze) → 22 → 1
    // then 23, 24 frozen (week of 21st), 25 resets
    expect(st.best).toBe(2)
    expect(st.current).toBe(0)
  })

  it('gets a fresh allowance across the ISO week boundary', () => {
    // Fri 18 played; Sat 19, Sun 20 frozen (week of 14th); Mon 21 frozen (week of 21st); Tue 22 played
    const s = ['2026-09-18', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', TODAY].map(
      (day) => rec({ day }),
    )
    const st = streak(s, TODAY)
    expect(st.current).toBe(7)
    expect(st.best).toBe(7)
    expect(st.freezesLeftThisWeek).toBe(1)
    expect(st.days.filter((d) => d.frozen).map((d) => d.day)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21'])
  })

  it('empty history is harmless', () => {
    const st = streak([], TODAY)
    expect(st).toMatchObject({ activeLast7: 0, current: 0, best: 0, freezesLeftThisWeek: 2 })
    expect(st.days.every((d) => !d.played && !d.frozen)).toBe(true)
  })
})

describe('series', () => {
  const s = [
    rec({ day: '2026-09-27', timeMs: 60_000, score: 50 }),
    rec({ day: '2026-09-27', timeMs: 120_000, score: 70 }),
    rec({ day: '2026-09-27', timeMs: 300_000, n: 10, score: 90, mode: 'extra' }),
    rec({ day: '2026-09-20', timeMs: 180_000 }),
    rec({ day: '2026-07-01', timeMs: 180_000 }),
  ]
  it('dailySeries fills every day, oldest first', () => {
    const d = dailySeries(s, 30, TODAY)
    expect(d).toHaveLength(30)
    expect(d[0].day).toBe('2026-08-29')
    const last = d[29]
    expect(last).toMatchObject({ day: TODAY, solves: 3, score: 210, minutes: 8 })
    expect(last.medianTimeByN).toEqual({ 9: 90_000 }) // extra excluded from medians
    expect(d[22]).toMatchObject({ day: '2026-09-20', solves: 1, minutes: 3 })
    expect(d[1].solves).toBe(0)
  })
  it('heatmap starts on a Monday and ends today', () => {
    const h = heatmap(s, 12, TODAY)
    expect(h[0].day).toBe(addDays('2026-09-21', -77))
    expect(h[h.length - 1]).toEqual({ day: TODAY, count: 3 })
    expect(h).toHaveLength(84)
  })
})

describe('trend', () => {
  it('computes weekly medians and only surfaces improvement', () => {
    const s = [
      rec({ day: '2026-08-03', timeMs: 200_000 }), // first week in range (8 weeks back from 21 Sep = 3 Aug)
      rec({ day: '2026-08-04', timeMs: 220_000 }),
      rec({ day: '2026-08-05', timeMs: 230_000 }),
      rec({ day: '2026-09-22', timeMs: 150_000 }),
      rec({ day: '2026-09-23', timeMs: 170_000 }),
    ]
    const t = trend(s, 9, 8, TODAY)
    expect(t.points).toHaveLength(8)
    expect(t.points[0]).toMatchObject({ week: '2026-08-03', median: 220_000, count: 3 })
    expect(t.points[7]).toMatchObject({ week: '2026-09-21', median: 160_000, hasPB: true })
    expect(t.points[3].median).toBeNull()
    expect(t.improvementPct).toBe(27)
    expect(t.baselineWeek).toBe('2026-08-03')
  })
  it('returns null improvement when slower', () => {
    const s = [rec({ day: '2026-08-03', timeMs: 100_000 }), rec({ day: '2026-09-22', timeMs: 150_000 })]
    expect(trend(s, 9, 8, TODAY).improvementPct).toBeNull()
  })
})

describe('totals & sessions', () => {
  const s = [
    rec({ day: '2026-09-26', sessionId: 'a', timeMs: 90_000, score: 100, firstTapMs: 2000 }),
    rec({ day: '2026-09-26', sessionId: 'a', timeMs: 80_000, score: 120, firstTapMs: 4000, clean: false }),
    rec({ day: '2026-09-27', sessionId: 'b', timeMs: 70_000, score: 300, firstTapMs: 0 }),
    rec({ day: '2026-09-27', sessionId: undefined, mode: 'extra', timeMs: 60_000, score: 10 }),
  ]
  it('totals', () => {
    const t = totals(s)
    expect(t.puzzles).toBe(4)
    expect(t.cleanRate).toBeCloseTo(2 / 3)
    expect(t.totalTimeMs).toBe(300_000)
    expect(t.totalScore).toBe(530)
    expect(t.bestSessionScore).toBe(300)
    expect(t.avgFirstTapMs).toBe(3000) // 0 = unknown, skipped
    expect(t.avgMsPerPlacement).toBeCloseTo(80_000 / 9)
  })
  it('totals of nothing', () => {
    expect(totals([])).toMatchObject({ puzzles: 0, cleanRate: null, avgFirstTapMs: null })
  })
  it('sessionSummaries groups by session and counts PBs', () => {
    // three earlier unsessioned 9×9s so the PB rule (3 prior) can fire
    const warm = [1, 2, 3].map((d) => rec({ day: `2026-09-0${d}`, sessionId: undefined, mode: 'daily', timeMs: 100_000 }))
    const sums = sessionSummaries([...warm, ...s])
    expect(sums.map((x) => x.sessionId)).toEqual(['a', 'b'])
    expect(sums[0]).toMatchObject({ count: 2, totalTimeMs: 170_000, score: 220, cleanCount: 1, pbCount: 2 })
    expect(sums[1]).toMatchObject({ count: 1, pbCount: 1 })
  })
  it('sizeStats', () => {
    const st = sizeStats(s, 9)
    expect(st.count).toBe(3)
    expect(st.fastest.map((x) => x.timeMs)).toEqual([70_000, 80_000, 90_000])
  })
  it('cleanRun counts back from most recent non-extra solve', () => {
    expect(cleanRun(s)).toBe(1)
  })
})

describe('headline', () => {
  it('says nothing when empty', () => {
    expect(headline([], TODAY)).toBe('')
  })
  it('prefers a fresh PB', () => {
    const s = [
      ...['2026-09-18', '2026-09-19', '2026-09-20'].map((day) => rec({ day, timeMs: 120_000 })),
      rec({ day: '2026-09-26', timeMs: 102_000 }),
    ]
    expect(headline(s, TODAY)).toBe('New 9×9 best yesterday: 1:42')
  })
  it('ignores PBs older than yesterday', () => {
    const s = [rec({ day: '2026-09-01', timeMs: 120_000 }), rec({ day: '2026-09-02', timeMs: 100_000 })]
    expect(headline(s, TODAY)).not.toMatch(/best/)
  })
  it('reports a big monthly median drop', () => {
    const s = [
      ...[200, 210, 220].map((t, i) => rec({ day: `2026-08-1${i}`, timeMs: t * 1000, clean: false })),
      // this month: slower than the Aug PB so no fresh-PB headline, but median well down
      ...[150, 160, 170].map((t, i) => rec({ day: `2026-09-1${i}`, timeMs: t * 1000, clean: false })),
      rec({ day: '2026-09-26', timeMs: 175_000, clean: false }),
    ]
    // Aug 10–12 median 210 vs last 30 days median 165 → 21%
    expect(headline(s, TODAY)).toBe('Your 9×9 median is down 21% this month')
  })
  it('reports clean runs', () => {
    const s = [
      rec({ day: '2026-09-01', timeMs: 100_000 }),
      ...[1, 2, 3].map((i) => rec({ day: `2026-09-0${i + 1}`, timeMs: 120_000 })),
    ]
    expect(headline(s, TODAY)).toBe('4 clean solves in a row')
  })
  it('falls back to active days', () => {
    const s = ['2026-09-23', '2026-09-24', '2026-09-26'].map((day) => rec({ day, clean: false, timeMs: 100_000 }))
    expect(headline(s, TODAY)).toBe("You've played 3 of the last 7 days")
  })
})

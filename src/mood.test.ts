import { describe, expect, it } from 'vitest'
import { moodPairs, moodSummary, moodsFromRuns, isMoodValue, type MoodEntry } from './mood'

const e = (p: Partial<MoodEntry> & Pick<MoodEntry, 'ref' | 'when' | 'v'>): MoodEntry => ({
  at: 1000,
  day: '2026-09-28',
  kind: 'break',
  ...p,
})

describe('moodPairs', () => {
  it('pairs only where both before and after exist', () => {
    const pairs = moodPairs([
      e({ ref: 'a', when: 'before', v: 2, at: 1 }),
      e({ ref: 'a', when: 'after', v: 4, at: 2 }),
      e({ ref: 'b', when: 'before', v: 3, at: 3 }),
      e({ ref: 'c', when: 'after', v: 5, at: 4 }),
    ])
    expect(pairs).toEqual([{ kind: 'break', ref: 'a', day: '2026-09-28', before: 2, after: 4 }])
  })

  it('keeps break and power apart even with the same ref', () => {
    const pairs = moodPairs([
      e({ ref: 'x', when: 'before', v: 1 }),
      e({ ref: 'x', when: 'after', v: 2 }),
      e({ ref: 'x', kind: 'power', when: 'before', v: 3 }),
      e({ ref: 'x', kind: 'power', when: 'after', v: 5 }),
    ])
    expect(pairs.map((p) => [p.kind, p.after - p.before])).toEqual(
      expect.arrayContaining([['break', 1], ['power', 2]]),
    )
    expect(pairs).toHaveLength(2)
  })

  it('latest tap wins and duplicates collapse', () => {
    const pairs = moodPairs([
      e({ ref: 'a', when: 'before', v: 2, at: 1 }),
      e({ ref: 'a', when: 'before', v: 3, at: 5 }),
      e({ ref: 'a', when: 'after', v: 4, at: 6 }),
      e({ ref: 'a', when: 'after', v: 4, at: 6 }),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].before).toBe(3)
  })

  it('drops invalid rows and sorts oldest first', () => {
    const bad = { ...e({ ref: 'z', when: 'before', v: 3 }), v: 9 } as unknown as MoodEntry
    const pairs = moodPairs([
      bad,
      e({ ref: 'z', when: 'after', v: 3 }),
      e({ ref: 'late', when: 'before', v: 1, at: 50 }),
      e({ ref: 'late', when: 'after', v: 1, at: 60 }),
      e({ ref: 'early', when: 'before', v: 2, at: 10 }),
      e({ ref: 'early', when: 'after', v: 2, at: 20 }),
    ])
    expect(pairs.map((p) => p.ref)).toEqual(['early', 'late'])
  })
})

describe('moodSummary', () => {
  it('counts better/same/worse and average change', () => {
    const s = moodSummary([
      { kind: 'break', ref: 'a', day: 'd', before: 2, after: 4 },
      { kind: 'break', ref: 'b', day: 'd', before: 3, after: 3 },
      { kind: 'break', ref: 'c', day: 'd', before: 4, after: 3 },
    ])
    expect(s).toEqual({ n: 3, better: 1, same: 1, worse: 1, avgChange: 0.33 })
  })
  it('is empty-safe', () => {
    expect(moodSummary([])).toEqual({ n: 0, better: 0, same: 0, worse: 0, avgChange: null })
  })
})

describe('moodsFromRuns', () => {
  it('turns run moods into power entries, skipping missing/invalid', () => {
    const out = moodsFromRuns([
      { id: 'p1', day: '2026-09-27', startedAt: 10, endedAt: 20, moodBefore: 2, moodAfter: 4 },
      { id: 'p2', day: '2026-09-28', startedAt: 30, moodBefore: 7 },
    ])
    expect(out).toHaveLength(2)
    expect(moodPairs(out)).toEqual([{ kind: 'power', ref: 'p1', day: '2026-09-27', before: 2, after: 4 }])
  })
  it('isMoodValue', () => {
    expect([0, 1, 3.5, 5, 6].map(isMoodValue)).toEqual([false, true, false, true, false])
  })
})

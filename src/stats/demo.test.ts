import { describe, expect, it } from 'vitest'
import { makeDemoSolves } from './demo'
import { headline, medianTime, sizesPlayed } from './metrics'

describe('demo data', () => {
  it('is deterministic, spans sizes 8–10 and gets faster', () => {
    const end = new Date(2026, 8, 27)
    const a = makeDemoSolves(end)
    expect(makeDemoSolves(end)).toEqual(a)
    expect(a.length).toBeGreaterThan(40)
    expect(sizesPlayed(a)).toEqual([8, 9, 10])
    const half = a.length >> 1
    const early = medianTime(a.slice(0, half), 8, 50)!
    const late = medianTime(a, 8, 10)!
    expect(late).toBeLessThan(early)
    expect(headline(a, '2026-09-27')).not.toBe('Welcome back')
  })
})

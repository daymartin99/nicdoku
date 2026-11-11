import { describe, expect, it } from 'vitest'
import { DAILY_SLOTS, TRIO_FROM, classicSeed, classicSpec, dailyLineup, dailyPlan, slotOf } from './dailies'
import { generatePuzzle } from './engine/generate'
import { minDistance, widenPalette } from './engine/colours'
import { PALETTES } from './themes/palettes'
import { NEON } from './power/palette'
import { addDays } from './stats/metrics'

describe('three dailies', () => {
  it('days before the switch keep the single classic daily, same puzzle as before', () => {
    const day = addDays(TRIO_FROM, -3)
    const lineup = dailyLineup(day)
    expect(lineup).toHaveLength(1)
    expect(lineup[0]).toMatchObject({ slot: 'special', kind: 'classic', seed: classicSeed(day), ...classicSpec(day) })
  })

  it('from the switch: Calm, Wild and a wildcard, each its own puzzle', () => {
    const lineup = dailyLineup(TRIO_FROM)
    expect(lineup.map((p) => p.slot)).toEqual(DAILY_SLOTS)
    expect(new Set(lineup.map((p) => p.seed)).size).toBe(3)
  })

  it('the wildcard covers giant, mini, stripes and classic through a week', () => {
    const kinds = Array.from({ length: 7 }, (_, k) => dailyPlan(addDays(TRIO_FROM, k), 'special').kind)
    expect(new Set(kinds)).toEqual(new Set(['giant', 'mini', 'stripes', 'classic']))
    const giants = Array.from({ length: 7 }, (_, k) => dailyPlan(addDays(TRIO_FROM, k), 'special')).filter((p) => p.kind === 'giant')
    for (const g of giants) expect(g.n).toBeGreaterThanOrEqual(12)
  })

  it('a classic wildcard is the exact puzzle the old daily would have been', () => {
    const wed = '2026-11-11' // a Wednesday
    const p = dailyPlan(wed, 'special')
    expect(p.kind).toBe('classic')
    expect(p.seed).toBe(classicSeed(wed))
  })

  it('old solves without a slot count as the wildcard', () => {
    expect(slotOf({})).toBe('special')
    expect(slotOf({ dailySlot: 'calm' })).toBe('calm')
  })

  it('every daily in a week builds a puzzle of the right size', () => {
    for (let k = 0; k < 7; k++) {
      for (const plan of dailyLineup(addDays(TRIO_FROM, k))) {
        const p = generatePuzzle(plan.n, plan.seed, { difficulty: plan.difficulty, style: plan.style, maxAttempts: plan.maxAttempts })
        expect(p.regions.length, `${plan.day} ${plan.slot}`).toBe(plan.n * plan.n)
        expect(new Set(p.regions).size).toBe(plan.n)
      }
    }
  }, 120_000)

  it('the old classic generator is unchanged by the new styles', () => {
    const a = generatePuzzle(8, 'same-seed', { difficulty: 'medium' })
    const b = generatePuzzle(8, 'same-seed', { difficulty: 'medium', style: 'classic' })
    expect(b.regions).toEqual(a.regions)
    expect(b.id).toBe(a.id)
  })
})

describe('colours for giant boards', () => {
  it('every palette tops up to 13 distinct colours', () => {
    for (const [name, pal] of Object.entries({ ...PALETTES, neon: NEON })) {
      const wide = widenPalette(pal, 13)
      expect(wide, name).toHaveLength(13)
      expect(new Set(wide).size, name).toBe(13)
      expect(wide.slice(0, pal.length)).toEqual(pal)
      expect(minDistance(wide), name).toBeGreaterThan(8)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { POWER_MS, SPINS, stageAt, orientationAt, nextSpin, puzzleSpec, comboMultiplier, bpmAt, winWord } from './timeline'

const MIN = 60_000

describe('power hour timeline', () => {
  it('moves through the four stages', () => {
    expect(stageAt(0).stage).toBe('warm')
    expect(stageAt(14.9 * MIN).stage).toBe('warm')
    expect(stageAt(15 * MIN).stage).toBe('build')
    expect(stageAt(35 * MIN).stage).toBe('surge')
    expect(stageAt(50 * MIN).stage).toBe('crescendo')
    expect(stageAt(POWER_MS).stage).toBe('crescendo')
  })

  it('intensity only ever rises, 0 → 1', () => {
    let prev = -1
    for (let m = 0; m <= 60; m++) {
      const i = stageAt(m * MIN).intensity
      expect(i).toBeGreaterThanOrEqual(prev)
      prev = i
    }
    expect(stageAt(0).intensity).toBe(0)
    expect(stageAt(POWER_MS).intensity).toBe(1)
    expect(bpmAt(0)).toBeLessThan(bpmAt(POWER_MS))
  })

  it('first spin at 10 minutes, then they come closer together', () => {
    expect(SPINS[0].at).toBe(10 * MIN)
    expect(orientationAt(9.9 * MIN).deg).toBe(0)
    expect(orientationAt(10 * MIN).deg).toBe(90)
    const gaps = SPINS.slice(1).map((e, i) => e.at - SPINS[i].at)
    // gaps in the last quarter are all shorter than the first gap
    for (const g of gaps.slice(-6)) expect(g).toBeLessThan(gaps[0])
    expect(SPINS[SPINS.length - 1].at).toBeLessThan(POWER_MS)
  })

  it('escalates from plain turns to rocking, flips and mirrors', () => {
    const kinds = SPINS.map((s) => s.kind)
    expect(kinds.slice(0, 3)).toEqual(['cw', 'cw', 'cw'])
    const firstRock = kinds.indexOf('rock')
    const firstMirror = kinds.indexOf('mirror')
    expect(firstRock).toBeGreaterThan(2)
    expect(firstMirror).toBeGreaterThan(firstRock)
    expect(kinds).toContain('flip')
  })

  it('orientation is a whole number of quarter turns and mirrors pair up', () => {
    for (let m = 0; m <= 60; m += 0.25) {
      const o = orientationAt(m * MIN)
      expect(o.deg % 90).toBe(0)
    }
    expect(nextSpin(59.5 * MIN)).toBeNull()
  })

  it('plans puzzles that grow through the hour, with one boss', () => {
    expect(puzzleSpec(2 * MIN, 9, false)).toMatchObject({ n: 8, difficulty: 'easy' })
    expect(puzzleSpec(30 * MIN, 9, false)).toMatchObject({ n: 9, difficulty: 'hard' })
    expect(puzzleSpec(51 * MIN, 9, false)).toMatchObject({ n: 11, difficulty: 'expert', boss: true })
    expect(puzzleSpec(55 * MIN, 9, true).boss).toBe(false)
    // sizes stay playable at the extremes
    expect(puzzleSpec(51 * MIN, 11, false).n).toBe(11)
    expect(puzzleSpec(2 * MIN, 5, false).n).toBe(6)
  })

  it('combo multiplier grows then caps', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(2)).toBeCloseTo(1.2)
    expect(comboMultiplier(50)).toBeCloseTo(3)
  })

  it('win words turn abstract in the crescendo', () => {
    expect(winWord(55 * MIN, 0, 0)).toMatch(/^[A-Z∞]+$/)
  })
})

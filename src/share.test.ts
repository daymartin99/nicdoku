import { describe, expect, it } from 'vitest'
import { dailyLineup } from './dailies'
import { dailyShareText } from './share'
import type { DailyResult } from './state/progress'

const day = '2026-11-16' // a Monday: Calm 8×8, Wild 9×9, Mini 6×6

describe('dailyShareText', () => {
  it('lists every daily with its time, and "not yet" for the rest', () => {
    const done: Record<string, DailyResult> = {
      calm: { timeMs: 62_000, clean: true, score: 900 },
      wild: { timeMs: 134_400, clean: false, score: 700 },
    }
    expect(dailyShareText(day, dailyLineup(day), (s) => done[s] ?? null)).toBe(
      [
        'Nicdoku · Mon 16 Nov',
        '🌿 Calm 8×8 · 1:02 ✨',
        '🌀 Wild 9×9 · 2:14',
        '🐭 Mini 6×6 · not yet',
        '✨ = no mistakes, no hints',
      ].join('\n'),
    )
  })

  it('leaves out the ✨ key when nothing was clean', () => {
    const text = dailyShareText(day, dailyLineup(day), (s) => (s === 'wild' ? { timeMs: 5_000, clean: false, score: 1 } : null))
    expect(text).not.toContain('✨')
    expect(text.split('\n')).toHaveLength(4)
  })
})

import { describe, expect, it } from 'vitest'
import { generatePuzzle } from './generate'
import { computeHint, tidyCells, M_EMPTY, M_PIECE, M_X } from './hints'

function playWithHints(n: number, seed: string, sabotage = false) {
  const p = generatePuzzle(n, seed)
  const marks = new Array(n * n).fill(M_EMPTY)
  if (sabotage) marks[0 * n + p.solution[0]] = M_X // wrong X over a real piece
  for (let guard = 0; guard < 500; guard++) {
    if (marks.filter((m) => m === M_PIECE).length === n) break
    const h = computeHint(p, marks)
    expect(h, 'hint should always exist before solved').not.toBeNull()
    expect(h!.text.length).toBeGreaterThan(10)
    for (const i of h!.apply.clear) marks[i] = M_EMPTY
    for (const i of h!.apply.cross) {
      // a hint must never cross out a solution cell
      expect(p.solution[(i / n) | 0] === i % n).toBe(false)
      if (marks[i] === M_EMPTY) marks[i] = M_X
    }
    for (const i of h!.apply.place) {
      expect(p.solution[(i / n) | 0]).toBe(i % n)
      marks[i] = M_PIECE
    }
  }
  expect(marks.filter((m) => m === M_PIECE).length).toBe(n)
}

describe('hints', () => {
  for (const n of [5, 7, 9, 11]) {
    it(`hint-by-hint solves ${n}x${n} correctly`, () => {
      for (let k = 0; k < 4; k++) playWithHints(n, `hint-${n}-${k}`)
    })
  }
  it('detects and clears a wrong X', () => playWithHints(8, 'sabotage', true))

  it('tidy never crosses a solution cell', () => {
    const p = generatePuzzle(9, 'tidy')
    const marks = new Array(81).fill(M_EMPTY)
    marks[4 * 9 + p.solution[4]] = M_PIECE
    for (const i of tidyCells(p, marks)) expect(p.solution[(i / 9) | 0] === i % 9).toBe(false)
  })
})

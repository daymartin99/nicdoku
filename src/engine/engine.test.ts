import { describe, expect, it } from 'vitest'
import { generatePuzzle } from './generate'
import { countSolutions } from './solver'
import { solveLogically, PIECE } from './logic'
import { makeRng } from './rng'
import type { Difficulty } from './types'

function assertValid(p: ReturnType<typeof generatePuzzle>) {
  const { n, regions, solution } = p
  expect(regions.length).toBe(n * n)
  // one piece per column
  expect(new Set(solution).size).toBe(n)
  // one piece per region
  expect(new Set(solution.map((c, r) => regions[r * n + c])).size).toBe(n)
  // no touching
  for (let r = 1; r < n; r++) expect(Math.abs(solution[r] - solution[r - 1])).toBeGreaterThan(1)
  // regions connected
  for (let g = 0; g < n; g++) {
    const cells = regions.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0)
    const seen = new Set([cells[0]])
    const st = [cells[0]]
    while (st.length) {
      const i = st.pop()!
      const r = (i / n) | 0, c = i % n
      for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1]) {
        if (j >= 0 && regions[j] === g && !seen.has(j)) { seen.add(j); st.push(j) }
      }
    }
    expect(seen.size).toBe(cells.length)
  }
  // unique
  expect(countSolutions(n, regions, 2)).toBe(1)
  // logic solver reaches the same solution without guessing
  const logic = solveLogically(n, regions)
  expect(logic.solved).toBe(true)
  for (let r = 0; r < n; r++) expect(logic.state[r * n + solution[r]]).toBe(PIECE)
}

describe('rng', () => {
  it('is deterministic', () => {
    const a = makeRng('x'), b = makeRng('x')
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next())
  })
})

describe('generator', () => {
  it('same seed gives the same puzzle', () => {
    const a = generatePuzzle(8, 'daily:2026-09-27')
    const b = generatePuzzle(8, 'daily:2026-09-27')
    expect(a).toEqual(b)
  })

  for (const n of [5, 6, 7, 8, 9, 10, 11]) {
    it(`produces valid unique logic-solvable ${n}x${n} puzzles`, () => {
      for (let k = 0; k < 6; k++) assertValid(generatePuzzle(n, `test-${n}-${k}`))
    })
  }

  it('benchmark + difficulty spread', () => {
    const rows: string[] = []
    for (const n of [5, 7, 9, 10, 11]) {
      for (const d of ['easy', 'medium', 'hard', 'expert'] as Difficulty[]) {
        const t0 = performance.now()
        const got: number[] = []
        let worst = 0
        for (let k = 0; k < 4; k++) {
          const s = performance.now()
          got.push(generatePuzzle(n, `bench-${n}-${d}-${k}`, { difficulty: d }).grade)
          worst = Math.max(worst, performance.now() - s)
        }
        rows.push(`${n}x${n} ${d.padEnd(6)} avg ${((performance.now() - t0) / 4).toFixed(0)}ms worst ${worst.toFixed(0)}ms grades ${got.join(',')}`)
      }
    }
    console.log(rows.join('\n'))
  }, 120_000)
})

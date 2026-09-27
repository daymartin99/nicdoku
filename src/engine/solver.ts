// Exact backtracking solver used to prove a puzzle has exactly one solution.
// Units: rows [0,n), cols [n,2n), regions [2n,3n). Always branches on the unit
// with the fewest remaining candidates.

import { neighbors8 } from './types'

export function findSolutions(n: number, regions: ArrayLike<number>, limit = 2): number[][] {
  const N = n * n
  const U = 3 * n
  const unitCells: number[][] = Array.from({ length: U }, () => [])
  for (let i = 0; i < N; i++) {
    unitCells[(i / n) | 0].push(i)
    unitCells[n + (i % n)].push(i)
    unitCells[2 * n + regions[i]].push(i)
  }
  const nb = Array.from({ length: N }, (_, i) => neighbors8(n, i))
  const results: number[][] = []
  const placed: number[] = []

  const search = (cand: Uint8Array, done: Uint8Array): boolean => {
    if (placed.length === n) {
      const sol = new Array<number>(n)
      for (const i of placed) sol[(i / n) | 0] = i % n
      results.push(sol)
      return results.length >= limit
    }
    let best = -1, bestCount = Infinity
    for (let u = 0; u < U; u++) {
      if (done[u]) continue
      let cnt = 0
      for (const i of unitCells[u]) cnt += cand[i]
      if (cnt < bestCount) {
        bestCount = cnt
        best = u
        if (cnt <= 1) break
      }
    }
    if (bestCount === 0) return false
    for (const i of unitCells[best]) {
      if (!cand[i]) continue
      const c2 = cand.slice()
      const d2 = done.slice()
      const r = (i / n) | 0, c = i % n, g = regions[i]
      d2[r] = 1; d2[n + c] = 1; d2[2 * n + g] = 1
      for (const j of unitCells[r]) c2[j] = 0
      for (const j of unitCells[n + c]) c2[j] = 0
      for (const j of unitCells[2 * n + g]) c2[j] = 0
      for (const j of nb[i]) c2[j] = 0
      placed.push(i)
      if (search(c2, d2)) return true
      placed.pop()
    }
    return false
  }

  search(new Uint8Array(N).fill(1), new Uint8Array(U))
  return results
}

export function countSolutions(n: number, regions: ArrayLike<number>, limit = 2): number {
  return findSolutions(n, regions, limit).length
}

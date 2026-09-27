// Puzzle generator: place a valid solution, grow connected colour regions around it,
// repair until the solution is unique, then grade with the human-logic solver.
// Puzzles that need guessing (logic solver gets stuck) are rejected.

import { makeRng, type Rng } from './rng'
import { findSolutions } from './solver'
import { solveLogically } from './logic'
import { DIFFICULTY_BY_GRADE, GRADE_RANGE, neighbors4, type Difficulty, type Puzzle } from './types'

function randomSolution(n: number, rng: Rng): number[] {
  const sol: number[] = []
  const used = new Array<boolean>(n).fill(false)
  const go = (r: number): boolean => {
    if (r === n) return true
    const cols = rng.shuffle([...Array(n).keys()])
    for (const c of cols) {
      if (used[c]) continue
      if (r > 0 && Math.abs(sol[r - 1] - c) <= 1) continue
      used[c] = true
      sol.push(c)
      if (go(r + 1)) return true
      sol.pop()
      used[c] = false
    }
    return false
  }
  go(0)
  return sol
}

function growRegions(n: number, sol: number[], rng: Rng): number[] {
  const N = n * n
  const regions = new Array<number>(N).fill(-1)
  const sizes = new Array<number>(n).fill(1)
  // uneven appetites give the mix of big snaking regions and small pockets
  const appetite = Array.from({ length: n }, () => 0.25 + rng.next() * rng.next() * 3)
  for (let r = 0; r < n; r++) regions[r * n + sol[r]] = r
  let left = N - n
  while (left > 0) {
    // weighted pick of a region that can still grow
    const frontier: number[][] = Array.from({ length: n }, () => [])
    for (let i = 0; i < N; i++) {
      if (regions[i] !== -1) continue
      for (const j of neighbors4(n, i)) {
        if (regions[j] !== -1) frontier[regions[j]].push(i)
      }
    }
    let total = 0
    for (let g = 0; g < n; g++) if (frontier[g].length) total += appetite[g]
    let x = rng.next() * total
    let g = 0
    for (; g < n; g++) {
      if (!frontier[g].length) continue
      x -= appetite[g]
      if (x <= 0) break
    }
    if (g >= n) g = frontier.findIndex((f) => f.length)
    const cell = rng.pick(frontier[g])
    regions[cell] = g
    sizes[g]++
    left--
  }
  return regions
}

function regionConnectedWithout(n: number, regions: number[], g: number, removed: number): boolean {
  const cells: number[] = []
  for (let i = 0; i < regions.length; i++) if (regions[i] === g && i !== removed) cells.push(i)
  if (!cells.length) return false
  const seen = new Set<number>([cells[0]])
  const stack = [cells[0]]
  while (stack.length) {
    const i = stack.pop()!
    for (const j of neighbors4(n, i)) {
      if (j !== removed && regions[j] === g && !seen.has(j)) {
        seen.add(j)
        stack.push(j)
      }
    }
  }
  return seen.size === cells.length
}

/** Move cells between regions until only the intended solution remains. */
function makeUnique(n: number, regions: number[], sol: number[], rng: Rng, maxIter = 60): boolean {
  const solCells = new Set(sol.map((c, r) => r * n + c))
  for (let it = 0; it < maxIter; it++) {
    const found = findSolutions(n, regions, 2)
    if (found.length === 1) return true
    const alt = found.find((s) => s.some((c, r) => c !== sol[r]))
    if (!alt) return false
    const candidates = rng.shuffle(
      alt.map((c, r) => r * n + c).filter((i) => !solCells.has(i)),
    )
    let moved = false
    for (const x of candidates) {
      const g = regions[x]
      const targets = rng.shuffle(
        [...new Set(neighbors4(n, x).map((j) => regions[j]))].filter((h) => h !== g),
      )
      if (!targets.length) continue
      if (!regionConnectedWithout(n, regions, g, x)) continue
      regions[x] = targets[0]
      moved = true
      break
    }
    if (!moved) return false
  }
  return findSolutions(n, regions, 2).length === 1
}

export type GenerateOptions = {
  difficulty?: Difficulty
  maxAttempts?: number
}

/** Try to build one unique, logic-solvable puzzle from a seed. */
function attempt(n: number, rng: Rng): { regions: number[]; solution: number[]; grade: number } | null {
  const solution = randomSolution(n, rng)
  const regions = growRegions(n, solution, rng)
  if (!makeUnique(n, regions, solution, rng)) return null
  const logic = solveLogically(n, regions)
  if (!logic.solved) return null
  return { regions, solution, grade: Math.max(1, logic.maxLevel) }
}

export function generatePuzzle(n: number, seed: string, opts: GenerateOptions = {}): Puzzle {
  const rng = makeRng(`${seed}|n${n}`)
  const maxAttempts = opts.maxAttempts ?? 80
  const target = opts.difficulty
  const [lo, hi] = target ? GRADE_RANGE[target] : [1, 5]
  const mid = (lo + hi) / 2
  let best: { regions: number[]; solution: number[]; grade: number } | null = null
  for (let a = 0; a < maxAttempts; a++) {
    const res = attempt(n, rng)
    if (!res) continue
    if (res.grade >= lo && res.grade <= hi) {
      best = res
      break
    }
    if (!best || Math.abs(res.grade - mid) < Math.abs(best.grade - mid)) best = res
  }
  // extremely unlikely: fall back to any unique puzzle without the logic filter
  while (!best) {
    const solution = randomSolution(n, rng)
    const regions = growRegions(n, solution, rng)
    if (makeUnique(n, regions, solution, rng, 200)) best = { regions, solution, grade: 5 }
  }
  return {
    id: `${seed}|n${n}`,
    n,
    regions: best.regions,
    solution: best.solution,
    grade: best.grade,
    difficulty: DIFFICULTY_BY_GRADE[best.grade],
  }
}

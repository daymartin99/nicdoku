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

/** How the colour areas grow. 'classic' is the original look (and keeps old seeds identical). */
export type PuzzleStyle = 'classic' | 'calm' | 'wild' | 'stripes'

function growRegions(n: number, sol: number[], rng: Rng, style: PuzzleStyle = 'classic'): number[] {
  if (style !== 'classic') return growStyled(n, sol, rng, style)
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

/**
 * Styled growth:
 *  calm    – even appetites, compact round-ish shapes
 *  wild    – very uneven appetites, long thin snakes next to tiny pockets
 *  stripes – each colour grows mostly along its own row or column
 */
function growStyled(n: number, sol: number[], rng: Rng, style: Exclude<PuzzleStyle, 'classic'>): number[] {
  const N = n * n
  const regions = new Array<number>(N).fill(-1)
  const appetite = Array.from({ length: n }, () =>
    style === 'calm' ? 0.9 + rng.next() * 0.2
    : style === 'wild' ? 0.06 + Math.pow(rng.next(), 3) * 6
    : 0.6 + rng.next() * 0.8,
  )
  // stripes: mostly one direction, a few going the other way for interest
  const across = Array.from({ length: n }, () => rng.next() < 0.75)
  for (let r = 0; r < n; r++) regions[r * n + sol[r]] = r
  let left = N - n
  while (left > 0) {
    const cand: Set<number>[] = Array.from({ length: n }, () => new Set())
    for (let i = 0; i < N; i++) {
      if (regions[i] !== -1) continue
      for (const j of neighbors4(n, i)) if (regions[j] !== -1) cand[regions[j]].add(i)
    }
    let total = 0
    for (let g = 0; g < n; g++) if (cand[g].size) total += appetite[g]
    let x = rng.next() * total
    let g = 0
    for (; g < n; g++) {
      if (!cand[g].size) continue
      x -= appetite[g]
      if (x <= 0) break
    }
    if (g >= n) g = cand.findIndex((f) => f.size)
    const cells = [...cand[g]]
    const weights = cells.map((i) => {
      let h = 0, v = 0
      for (const j of neighbors4(n, i)) {
        if (regions[j] !== g) continue
        if (Math.abs(j - i) === 1) h++
        else v++
      }
      const k = h + v
      if (style === 'calm') return k * k * k
      if (style === 'wild') return k === 1 ? 4 : 0.15
      return across[g] ? h * 10 + v * 0.25 : v * 10 + h * 0.25
    })
    let w = rng.next() * weights.reduce((a, b) => a + b, 0)
    let pick = cells[cells.length - 1]
    for (let k = 0; k < cells.length; k++) {
      w -= weights[k]
      if (w <= 0) { pick = cells[k]; break }
    }
    regions[pick] = g
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
  style?: PuzzleStyle
}

/** Try to build one unique, logic-solvable puzzle from a seed. */
function attempt(n: number, rng: Rng, style: PuzzleStyle): { regions: number[]; solution: number[]; grade: number } | null {
  const solution = randomSolution(n, rng)
  const regions = growRegions(n, solution, rng, style)
  if (!makeUnique(n, regions, solution, rng)) return null
  const logic = solveLogically(n, regions)
  if (!logic.solved) return null
  return { regions, solution, grade: Math.max(1, logic.maxLevel) }
}

export function generatePuzzle(n: number, seed: string, opts: GenerateOptions = {}): Puzzle {
  const style = opts.style ?? 'classic'
  // classic keeps the original seed string so existing puzzles never change
  const rng = makeRng(style === 'classic' ? `${seed}|n${n}` : `${seed}|n${n}|${style}`)
  const maxAttempts = opts.maxAttempts ?? 80
  const target = opts.difficulty
  const [lo, hi] = target ? GRADE_RANGE[target] : [1, 5]
  const mid = (lo + hi) / 2
  let best: { regions: number[]; solution: number[]; grade: number } | null = null
  for (let a = 0; a < maxAttempts; a++) {
    const res = attempt(n, rng, style)
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
    const regions = growRegions(n, solution, rng, style)
    if (makeUnique(n, regions, solution, rng, 200)) best = { regions, solution, grade: 5 }
  }
  return {
    id: style === 'classic' ? `${seed}|n${n}` : `${seed}|n${n}|${style}`,
    n,
    regions: best.regions,
    solution: best.solution,
    grade: best.grade,
    difficulty: DIFFICULTY_BY_GRADE[best.grade],
  }
}

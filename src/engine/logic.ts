// Human-style deduction solver. Drives hints (explainable steps) and difficulty grading.
// Cell state: 0 = unknown, 1 = crossed out (X), 2 = piece.
// Levels: 0 cleanup around a piece · 1 last spot · 2 confinement · 3 pigeonhole
//         4 blocking · 5 short contradiction

import { neighbors8 } from './types'

export const UNKNOWN = 0, CROSS = 1, PIECE = 2

export type UnitType = 'row' | 'col' | 'region'
export type UnitRef = { type: UnitType; index: number }

export type StepKind =
  | 'around'
  | 'single'
  | 'confine'
  | 'pigeonhole'
  | 'blocking'
  | 'contradiction'

export type Step = {
  kind: StepKind
  level: number
  place: number[]
  eliminate: number[]
  /** units that cause the deduction (e.g. the confined region) */
  sources: UnitRef[]
  /** units being cleared (e.g. the row the region sits in) */
  targets: UnitRef[]
  /** the hypothetical cell for blocking/contradiction */
  cell?: number
}

export type Board = {
  n: number
  regions: ArrayLike<number>
  rows: number[][]
  cols: number[][]
  regs: number[][]
  nb: number[][]
}

export function makeBoard(n: number, regions: ArrayLike<number>): Board {
  const rows: number[][] = Array.from({ length: n }, () => [])
  const cols: number[][] = Array.from({ length: n }, () => [])
  const regs: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n * n; i++) {
    rows[(i / n) | 0].push(i)
    cols[i % n].push(i)
    regs[regions[i]].push(i)
  }
  const nb = Array.from({ length: n * n }, (_, i) => neighbors8(n, i))
  return { n, regions, rows, cols, regs, nb }
}

function unitCells(b: Board, u: UnitRef): number[] {
  return u.type === 'row' ? b.rows[u.index] : u.type === 'col' ? b.cols[u.index] : b.regs[u.index]
}

function allUnits(b: Board): UnitRef[] {
  const out: UnitRef[] = []
  for (let i = 0; i < b.n; i++) out.push({ type: 'region', index: i })
  for (let i = 0; i < b.n; i++) out.push({ type: 'row', index: i })
  for (let i = 0; i < b.n; i++) out.push({ type: 'col', index: i })
  return out
}

const hasPiece = (s: ArrayLike<number>, cells: number[]) => cells.some((i) => s[i] === PIECE)
const unknownsOf = (s: ArrayLike<number>, cells: number[]) => cells.filter((i) => s[i] === UNKNOWN)

/** Cells a piece at i rules out (same row/col/region + touching). */
function attackSet(b: Board, i: number): Set<number> {
  const n = b.n
  const set = new Set<number>()
  for (const j of b.rows[(i / n) | 0]) set.add(j)
  for (const j of b.cols[i % n]) set.add(j)
  for (const j of b.regs[b.regions[i]]) set.add(j)
  for (const j of b.nb[i]) set.add(j)
  set.delete(i)
  return set
}

/** True if the state can no longer be completed (a unit has no piece and no open cell). */
export function isContradiction(b: Board, s: ArrayLike<number>): boolean {
  for (const u of allUnits(b)) {
    const cells = unitCells(b, u)
    let pieces = 0, open = 0
    for (const i of cells) {
      if (s[i] === PIECE) pieces++
      else if (s[i] === UNKNOWN) open++
    }
    if (pieces > 1) return true
    if (pieces === 0 && open === 0) return true
  }
  // touching pieces
  for (let i = 0; i < b.n * b.n; i++) {
    if (s[i] !== PIECE) continue
    for (const j of b.nb[i]) if (s[j] === PIECE) return true
  }
  return false
}

function ruleAround(b: Board, s: ArrayLike<number>): Step | null {
  for (let i = 0; i < b.n * b.n; i++) {
    if (s[i] !== PIECE) continue
    const elim = [...attackSet(b, i)].filter((j) => s[j] === UNKNOWN)
    if (elim.length) {
      return { kind: 'around', level: 0, place: [], eliminate: elim, sources: [], targets: [], cell: i }
    }
  }
  return null
}

function ruleSingle(b: Board, s: ArrayLike<number>): Step | null {
  for (const u of allUnits(b)) {
    const cells = unitCells(b, u)
    if (hasPiece(s, cells)) continue
    const open = unknownsOf(s, cells)
    if (open.length === 1) {
      return { kind: 'single', level: 1, place: open, eliminate: [], sources: [u], targets: [] }
    }
  }
  return null
}

function ruleConfine(b: Board, s: ArrayLike<number>): Step | null {
  const n = b.n
  const lineOf = (t: 'row' | 'col', i: number) => (t === 'row' ? (i / n) | 0 : i % n)
  // region -> single line
  for (let g = 0; g < n; g++) {
    if (hasPiece(s, b.regs[g])) continue
    const open = unknownsOf(s, b.regs[g])
    if (!open.length) continue
    for (const t of ['row', 'col'] as const) {
      const line = lineOf(t, open[0])
      if (open.every((i) => lineOf(t, i) === line)) {
        const lineCells = t === 'row' ? b.rows[line] : b.cols[line]
        const elim = lineCells.filter((i) => s[i] === UNKNOWN && b.regions[i] !== g)
        if (elim.length) {
          return {
            kind: 'confine', level: 2, place: [], eliminate: elim,
            sources: [{ type: 'region', index: g }], targets: [{ type: t, index: line }],
          }
        }
      }
    }
  }
  // line -> single region
  for (const t of ['row', 'col'] as const) {
    for (let k = 0; k < n; k++) {
      const cells = t === 'row' ? b.rows[k] : b.cols[k]
      if (hasPiece(s, cells)) continue
      const open = unknownsOf(s, cells)
      if (!open.length) continue
      const g = b.regions[open[0]]
      if (open.every((i) => b.regions[i] === g)) {
        const elim = b.regs[g].filter((i) => s[i] === UNKNOWN && lineOf(t, i) !== k)
        if (elim.length) {
          return {
            kind: 'confine', level: 2, place: [], eliminate: elim,
            sources: [{ type: t, index: k }], targets: [{ type: 'region', index: g }],
          }
        }
      }
    }
  }
  return null
}

function popcount(x: number): number {
  let c = 0
  while (x) { x &= x - 1; c++ }
  return c
}

function rulePigeonhole(b: Board, s: ArrayLike<number>): Step | null {
  const n = b.n
  type Dir = { from: UnitType; to: UnitType }
  const dirs: Dir[] = [
    { from: 'region', to: 'row' },
    { from: 'region', to: 'col' },
    { from: 'row', to: 'region' },
    { from: 'col', to: 'region' },
  ]
  const idxOf = (t: UnitType, i: number) => (t === 'row' ? (i / n) | 0 : t === 'col' ? i % n : b.regions[i])
  const cellsOf = (t: UnitType, k: number) => (t === 'row' ? b.rows[k] : t === 'col' ? b.cols[k] : b.regs[k])

  for (const d of dirs) {
    // open "from" units and the mask of "to" units their open cells touch
    const units: number[] = []
    const masks: number[] = []
    for (let k = 0; k < n; k++) {
      const cells = cellsOf(d.from, k)
      if (hasPiece(s, cells)) continue
      let m = 0
      for (const i of cells) if (s[i] === UNKNOWN) m |= 1 << idxOf(d.to, i)
      if (!m) continue
      units.push(k)
      masks.push(m)
    }
    const m = units.length
    if (m < 3) continue
    // smallest subsets first so the hint explanation stays simple
    for (let k = 2; k < m; k++) {
      for (let sub = 1; sub < 1 << m; sub++) {
        if (popcount(sub) !== k) continue
        let union = 0, fromMask = 0
        for (let j = 0; j < m; j++) {
          if (sub & (1 << j)) {
            union |= masks[j]
            fromMask |= 1 << units[j]
          }
        }
        if (popcount(union) !== k) continue
        // the k "from" units fill the k "to" units: clear everything else in those "to" units
        const elim: number[] = []
        for (let t = 0; t < n; t++) {
          if (!(union & (1 << t))) continue
          for (const i of cellsOf(d.to, t)) {
            if (s[i] === UNKNOWN && !(fromMask & (1 << idxOf(d.from, i)))) elim.push(i)
          }
        }
        if (elim.length) {
          const sources: UnitRef[] = []
          const targets: UnitRef[] = []
          for (let t = 0; t < n; t++) {
            if (fromMask & (1 << t)) sources.push({ type: d.from, index: t })
            if (union & (1 << t)) targets.push({ type: d.to, index: t })
          }
          return { kind: 'pigeonhole', level: 3, place: [], eliminate: elim, sources, targets }
        }
      }
    }
  }
  return null
}

function ruleBlocking(b: Board, s: ArrayLike<number>): Step | null {
  const N = b.n * b.n
  for (let c = 0; c < N; c++) {
    if (s[c] !== UNKNOWN) continue
    const hit = attackSet(b, c)
    for (const u of allUnits(b)) {
      const cells = unitCells(b, u)
      if (cells.includes(c)) continue
      if (hasPiece(s, cells)) continue
      const open = unknownsOf(s, cells)
      if (open.length && open.every((i) => hit.has(i))) {
        return { kind: 'blocking', level: 4, place: [], eliminate: [c], sources: [], targets: [u], cell: c }
      }
    }
  }
  return null
}

const SIMPLE_RULES = [ruleAround, ruleSingle, ruleConfine, rulePigeonhole]

/** Propagate simple rules on a scratch copy; returns true if it hits a contradiction. */
function leadsToContradiction(b: Board, s0: ArrayLike<number>, cell: number, budget = 60): boolean {
  const s = Uint8Array.from(s0)
  s[cell] = PIECE
  for (let it = 0; it < budget; it++) {
    if (isContradiction(b, s)) return true
    let step: Step | null = null
    for (const r of SIMPLE_RULES) {
      step = r(b, s)
      if (step) break
    }
    if (!step) return false
    for (const i of step.place) s[i] = PIECE
    for (const i of step.eliminate) s[i] = CROSS
  }
  return isContradiction(b, s)
}

function ruleContradiction(b: Board, s: ArrayLike<number>): Step | null {
  const N = b.n * b.n
  for (let c = 0; c < N; c++) {
    if (s[c] !== UNKNOWN) continue
    if (leadsToContradiction(b, s, c)) {
      return { kind: 'contradiction', level: 5, place: [], eliminate: [c], sources: [], targets: [], cell: c }
    }
  }
  return null
}

const RULES = [ruleAround, ruleSingle, ruleConfine, rulePigeonhole, ruleBlocking, ruleContradiction]

export function nextStep(b: Board, s: ArrayLike<number>, maxLevel = 5): Step | null {
  for (let r = 0; r <= maxLevel && r < RULES.length; r++) {
    const step = RULES[r](b, s)
    if (step) return step
  }
  return null
}

export function applyStep(s: Uint8Array, step: Step): void {
  for (const i of step.place) s[i] = PIECE
  for (const i of step.eliminate) s[i] = CROSS
}

export type LogicResult = { solved: boolean; maxLevel: number; steps: number; state: Uint8Array }

export function solveLogically(n: number, regions: ArrayLike<number>, maxLevel = 5): LogicResult {
  const b = makeBoard(n, regions)
  const s = new Uint8Array(n * n)
  let hardest = 0, steps = 0
  for (let guard = 0; guard < n * n * 4; guard++) {
    let pieces = 0
    for (let i = 0; i < s.length; i++) if (s[i] === PIECE) pieces++
    if (pieces === n) {
      // finish cleanup so the state is complete
      return { solved: !isContradiction(b, s), maxLevel: hardest, steps, state: s }
    }
    const step = nextStep(b, s, maxLevel)
    if (!step) break
    applyStep(s, step)
    steps++
    if (step.level > hardest) hardest = step.level
    if (isContradiction(b, s)) break
  }
  return { solved: false, maxLevel: hardest, steps, state: s }
}

// Turns the player's board into a human-readable hint, using the logic solver.

import { makeBoard, nextStep, CROSS, PIECE, UNKNOWN, type Step, type UnitRef } from './logic'
import type { Puzzle } from './types'

/** Player marks: 0 empty, 1 X, 2 piece, 3 wrong (orange X – a known non-piece) */
export const M_EMPTY = 0, M_X = 1, M_PIECE = 2, M_WRONG = 3

export type Hint = {
  text: string
  /** cells to glow */
  focus: number[]
  /** units to outline */
  units: UnitRef[]
  /** the placed piece that causes an 'around' step (outlined, not dimmed) */
  source?: number
  /** what "Do it for me" does */
  apply: { place: number[]; cross: number[]; clear: number[] }
}

// The board has no row numbers, so hints point at the highlight instead of making her count.
const unitName = (u: UnitRef) =>
  u.type === 'row' ? 'this row' : u.type === 'col' ? 'this column' : 'this colour'

const plural = (u: UnitRef) => (u.type === 'row' ? 'rows' : u.type === 'col' ? 'columns' : 'colours')

function listUnits(us: UnitRef[]): string {
  if (!us.length) return ''
  if (us.length === 1) return unitName(us[0])
  return `the highlighted ${plural(us[0])}`
}

export function knowledgeState(p: Puzzle, marks: ArrayLike<number>): Uint8Array {
  const s = new Uint8Array(p.n * p.n)
  for (let i = 0; i < s.length; i++) {
    s[i] = marks[i] === M_PIECE ? PIECE : marks[i] === M_X || marks[i] === M_WRONG ? CROSS : UNKNOWN
  }
  return s
}

export function describeStep(step: Step, n: number): string {
  switch (step.kind) {
    case 'around':
      return 'This piece rules out every other cell in its row, column and colour, plus the cells touching it. Cross these out.'
    case 'single': {
      const u = step.sources[0]
      return u.type === 'region'
        ? 'This colour has only one open cell left, so the piece must go there.'
        : `${cap(unitName(u))} has only one open cell left, so the piece must go there.`
    }
    case 'confine': {
      const s = step.sources[0], t = step.targets[0]
      if (s.type === 'region') {
        return `Every open cell of this colour sits in the highlighted ${t.type === 'row' ? 'row' : 'column'}. Its piece will use up that line, so the other cells there can be crossed out.`
      }
      return `All the open cells in ${unitName(s)} are one colour. So that colour's piece is in ${unitName(s)}, and the rest of the colour can be crossed out.`
    }
    case 'pigeonhole': {
      const k = step.sources.length
      if (step.sources[0].type === 'region') {
        const lines = plural(step.targets[0])
        return `These ${k} colours can only go in ${listUnits(step.targets)}, so they fill them. Nothing else in those ${lines} can have a piece.`
      }
      return `${cap(listUnits(step.sources))} can only be filled by these ${k} colours. So those colours are used up there, and their other cells can be crossed out.`
    }
    case 'blocking':
      return `A piece here would block every open cell in ${unitName(step.targets[0])}. So this cell can't hold a piece.`
    case 'contradiction':
      return "Imagine a piece in this cell: soon a row, column or colour would have no room left. So this cell can't hold a piece."
  }
  void n
  return ''
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function computeHint(p: Puzzle, marks: ArrayLike<number>): Hint | null {
  const { n, regions, solution } = p
  // 1. an X hiding a real piece?
  for (let r = 0; r < n; r++) {
    const i = r * n + solution[r]
    if (marks[i] === M_X) {
      return {
        text: "One of your X's is covering a spot that needs a piece. Let's clear it.",
        focus: [i],
        units: [],
        apply: { place: [], cross: [], clear: [i] },
      }
    }
  }
  const b = makeBoard(n, regions)
  const s = knowledgeState(p, marks)
  const step = nextStep(b, s)
  if (!step) return null
  const focus = step.place.length ? step.place : step.eliminate
  const units: UnitRef[] = [...step.sources, ...step.targets]
  if (step.kind === 'blocking' || step.kind === 'contradiction') {
    if (step.cell !== undefined && !focus.includes(step.cell)) focus.push(step.cell)
  }
  return {
    text: describeStep(step, n),
    focus,
    units,
    source: step.kind === 'around' ? step.cell : undefined,
    apply: { place: step.place, cross: step.eliminate, clear: [] },
  }
}

/** Cells ruled out purely by placed pieces (the "tidy up" helper). */
export function tidyCells(p: Puzzle, marks: ArrayLike<number>): number[] {
  const { n, regions } = p
  const out = new Set<number>()
  for (let i = 0; i < n * n; i++) {
    if (marks[i] !== M_PIECE) continue
    const r = (i / n) | 0, c = i % n
    for (let j = 0; j < n * n; j++) {
      if (marks[j] !== M_EMPTY) continue
      const rj = (j / n) | 0, cj = j % n
      if (rj === r || cj === c || regions[j] === regions[i] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) out.add(j)
    }
  }
  return [...out]
}

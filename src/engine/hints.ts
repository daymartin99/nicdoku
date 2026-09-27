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
  /** what "Show me" does */
  apply: { place: number[]; cross: number[]; clear: number[] }
}

const unitName = (u: UnitRef) =>
  u.type === 'row' ? `row ${u.index + 1}` : u.type === 'col' ? `column ${u.index + 1}` : 'this colour'

function listUnits(us: UnitRef[]): string {
  if (!us.length) return ''
  const type = us[0].type
  if (type === 'region') return us.length === 1 ? 'this colour' : `these ${us.length} colours`
  const word = type === 'row' ? 'rows' : 'columns'
  if (us.length === 1) return unitName(us[0])
  const nums = us.map((u) => u.index + 1)
  return `${word} ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
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
      return 'A piece rules out every cell in its row, column and colour, plus the cells touching it. Cross these out.'
    case 'single': {
      const u = step.sources[0]
      return u.type === 'region'
        ? 'This colour has only one open cell left, so the piece must go there.'
        : `${cap(unitName(u))} has only one open cell left, so the piece must go there.`
    }
    case 'confine': {
      const s = step.sources[0], t = step.targets[0]
      if (s.type === 'region') {
        return `Every open cell of this colour sits in ${unitName(t)}. Its piece will use up ${unitName(t)}, so the other cells there can be crossed out.`
      }
      return `All the open cells in ${unitName(s)} are this colour. So this colour's piece is in ${unitName(s)}, and the rest of the colour can be crossed out.`
    }
    case 'pigeonhole': {
      const k = step.sources.length
      if (step.sources[0].type === 'region') {
        return `These ${k} colours only fit inside ${listUnits(step.targets)}. They fill those ${k} lines, so nothing else there can hold a piece.`
      }
      return `${cap(listUnits(step.sources))} can only use these ${k} colours. Those colours' pieces are used up there, so their other cells can be crossed out.`
    }
    case 'blocking':
      return `A piece here would block every open cell in ${unitName(step.targets[0])}. So this cell can't hold a piece.`
    case 'contradiction':
      return 'Try imagining a piece here: it quickly leads to a line or colour with no room left. So this cell must be an X.'
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

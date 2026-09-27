// The live puzzle: marks, lives, timer, undo, hints. Saved to localStorage on every
// move so she can close the app mid-puzzle and reopen straight into it.

import { signal, computed } from '@preact/signals'
import { lsGet, lsSet, addSolve, allSolves, localDay, type SolveRecord } from '../db'
import { LIVES } from '../config'
import { M_EMPTY, M_PIECE, M_WRONG, M_X, computeHint, tidyCells, type Hint } from '../engine/hints'
import type { Puzzle } from '../engine/types'
import { settings } from './settings'
import { progress, patchProgress, type SessionResult } from './progress'
import { medianTime, fasterThanPct, isNewPB } from '../stats/metrics'
import { feedback } from '../feedback'

export type GameMode = 'session' | 'daily' | 'extra'

export type GameState = {
  puzzle: Puzzle
  mode: GameMode
  level: number
  sessionId?: string
  themeId: string
  marks: number[]
  /** pencil layer (0 none, 1 X, 2 piece) or null when pencil is off */
  drafts: number[] | null
  lives: number
  mistakes: number
  hints: number
  assists: number
  undos: number
  elapsedMs: number
  firstTapMs: number
  history: number[][]
  hintCells: number[]
  done: boolean
}

export type WinInfo = {
  timeMs: number
  score: number
  clean: boolean
  pb: boolean
  fasterPct: number | null
  median: number | null
  mode: GameMode
}

const saved = lsGet<GameState | null>('nd:game', null)
export const game = signal<GameState | null>(saved && !saved.done ? saved : null)
export const win = signal<WinInfo | null>(null)
export const activeHint = signal<Hint | null>(null)
export const lastEvent = signal<{ type: 'wrong' | 'place' | 'region' | 'none'; cell: number; t: number }>({
  type: 'none', cell: -1, t: 0,
})

let runStart = 0 // epoch ms when the clock last resumed (0 = paused)

function persist(g: GameState | null) {
  lsSet('nd:game', g)
}

function commit(g: GameState) {
  game.value = g
  persist(g)
}

export function elapsed(g = game.value): number {
  if (!g) return 0
  return g.elapsedMs + (runStart && !g.done ? Date.now() - runStart : 0)
}

export function pauseClock() {
  const g = game.value
  if (!g || !runStart) return
  const e = elapsed(g)
  runStart = 0
  commit({ ...g, elapsedMs: e })
}

export function resumeClock() {
  const g = game.value
  if (!g || g.done || runStart) return
  runStart = Date.now()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseClock()
    else resumeClock()
  })
  window.addEventListener('pagehide', pauseClock)
}

export function startGame(p: {
  puzzle: Puzzle
  mode: GameMode
  level: number
  sessionId?: string
  themeId: string
}) {
  const g: GameState = {
    ...p,
    marks: new Array(p.puzzle.n * p.puzzle.n).fill(M_EMPTY),
    drafts: null,
    lives: LIVES,
    mistakes: 0,
    hints: 0,
    assists: 0,
    undos: 0,
    elapsedMs: 0,
    firstTapMs: -1,
    history: [],
    hintCells: [],
    done: false,
  }
  win.value = null
  activeHint.value = null
  runStart = Date.now()
  commit(g)
}

export function abandonGame() {
  runStart = 0
  game.value = null
  activeHint.value = null
  persist(null)
}

export const piecesPlaced = computed(() => game.value?.marks.filter((m) => m === M_PIECE).length ?? 0)

/** regions that already hold their piece */
export const solvedRegions = computed(() => {
  const g = game.value
  const out = new Set<number>()
  if (!g) return out
  g.marks.forEach((m, i) => {
    if (m === M_PIECE) out.add(g.puzzle.regions[i])
  })
  return out
})

function snapshot(g: GameState): number[][] {
  const h = [...g.history, g.marks.slice()]
  return h.length > 200 ? h.slice(-200) : h
}

function withFirstTap(g: GameState): GameState {
  if (g.firstTapMs >= 0) return g
  return { ...g, firstTapMs: elapsed(g) }
}

const isSolutionCell = (g: GameState, i: number) => {
  const n = g.puzzle.n
  return g.puzzle.solution[(i / n) | 0] === i % n
}

/** Begin a gesture (tap or drag): records one undo step. */
export function beginGesture() {
  const g = game.value
  if (!g || g.done) return
  activeHint.value = null
  commit({ ...withFirstTap(g), history: snapshot(g) })
}

/** Set a cell to X or empty (drag + tap). Pieces and orange X's are untouched. */
export function setCross(i: number, on: boolean) {
  const g = game.value
  if (!g || g.done) return
  if (g.drafts) {
    const d = g.drafts.slice()
    if (g.marks[i] !== M_EMPTY) return
    d[i] = on ? 1 : 0
    commit({ ...g, drafts: d })
    return
  }
  const m = g.marks[i]
  if (m === M_PIECE || m === M_WRONG) return
  const next = on ? M_X : M_EMPTY
  if (m === next) return
  const marks = g.marks.slice()
  marks[i] = next
  commit({ ...g, marks })
}

export function removePiece(i: number) {
  const g = game.value
  if (!g || g.done) return
  if (g.drafts) {
    const d = g.drafts.slice()
    d[i] = 0
    commit({ ...g, drafts: d })
    return
  }
  if (g.marks[i] !== M_PIECE) return
  const marks = g.marks.slice()
  marks[i] = M_EMPTY
  commit({ ...g, marks, hintCells: g.hintCells.filter((c) => c !== i) })
}

/** Place a piece: checked instantly against the unique solution. */
export function placePiece(i: number, fromHint = false) {
  const g = game.value
  if (!g || g.done) return
  if (g.drafts && !fromHint) {
    if (g.marks[i] !== M_EMPTY && g.marks[i] !== M_X) return
    const d = g.drafts.slice()
    d[i] = 2
    commit({ ...g, drafts: d })
    return
  }
  const m = g.marks[i]
  if (m === M_PIECE || m === M_WRONG) return
  const marks = g.marks.slice()
  if (!isSolutionCell(g, i)) {
    marks[i] = M_WRONG
    const lives = Math.max(0, g.lives - 1)
    commit({ ...g, marks, lives, mistakes: g.mistakes + 1 })
    lastEvent.value = { type: 'wrong', cell: i, t: Date.now() }
    feedback('wrong')
    return
  }
  marks[i] = M_PIECE
  let next: GameState = { ...g, marks }
  if (settings.value.autoX) {
    for (const j of tidyCells(g.puzzle, marks)) marks[j] = M_X
  }
  if (fromHint) next = { ...next, hintCells: [...g.hintCells, i] }
  commit(next)
  lastEvent.value = { type: 'place', cell: i, t: Date.now() }
  feedback('place')
  checkWin()
}

export function undo() {
  const g = game.value
  if (!g || g.done || !g.history.length) return
  const prev = g.history[g.history.length - 1]
  // orange X's are facts she already paid for: keep them through undo
  const marks = prev.map((m, i) => (g.marks[i] === M_WRONG ? M_WRONG : m))
  activeHint.value = null
  commit({ ...g, marks, history: g.history.slice(0, -1), undos: g.undos + 1 })
}

export function resetBoard() {
  const g = game.value
  if (!g || g.done) return
  const marks = g.marks.map((m) => (m === M_WRONG ? M_WRONG : M_EMPTY))
  activeHint.value = null
  commit({ ...g, marks, history: snapshot(g), drafts: g.drafts ? marks.map(() => 0) : null, hintCells: [] })
}

export function togglePencil() {
  const g = game.value
  if (!g || g.done) return
  commit({ ...g, drafts: g.drafts ? null : new Array(g.marks.length).fill(0) })
}

/** Commit pencil marks: X's become X's, pieces are checked one by one. */
export function applyDrafts() {
  const g = game.value
  if (!g || !g.drafts) return
  const d = g.drafts
  commit({ ...g, drafts: null, history: snapshot(g) })
  d.forEach((v, i) => {
    if (v === 1) setCross(i, true)
  })
  d.forEach((v, i) => {
    if (v === 2) placePiece(i)
  })
}

// ---- helpers (all free, forever) ----

export function showHint() {
  const g = game.value
  if (!g || g.done) return
  activeHint.value = computeHint(g.puzzle, g.marks)
}

export function applyHint() {
  const g = game.value
  const h = activeHint.value
  if (!g || !h) return
  const marks = g.marks.slice()
  for (const i of h.apply.clear) marks[i] = M_EMPTY
  for (const i of h.apply.cross) if (marks[i] === M_EMPTY) marks[i] = M_X
  commit({ ...g, marks, history: snapshot(g), hints: g.hints + 1, drafts: null })
  activeHint.value = null
  for (const i of h.apply.place) placePiece(i, true)
}

/** Reveal one piece (gold). Picks the colour with the fewest open cells. */
export function revealPiece() {
  const g = game.value
  if (!g || g.done) return
  const { n, regions, solution } = g.puzzle
  let best = -1, bestOpen = Infinity
  for (let r = 0; r < n; r++) {
    const i = r * n + solution[r]
    if (g.marks[i] === M_PIECE) continue
    const reg = regions[i]
    let open = 0
    for (let j = 0; j < n * n; j++) if (regions[j] === reg && (g.marks[j] === M_EMPTY)) open++
    if (open < bestOpen) { bestOpen = open; best = i }
  }
  if (best < 0) return
  const marks = g.marks.slice()
  if (marks[best] === M_X) marks[best] = M_EMPTY
  commit({ ...g, marks, history: snapshot(g), hints: g.hints + 1, drafts: null })
  activeHint.value = null
  placePiece(best, true)
}

/** Cross out everything the placed pieces already rule out. */
export function tidyUp(): number {
  const g = game.value
  if (!g || g.done) return 0
  let cells = tidyCells(g.puzzle, g.marks)
  if (!cells.length) {
    const h = computeHint(g.puzzle, g.marks)
    cells = h?.apply.cross ?? []
  }
  if (!cells.length) return 0
  const marks = g.marks.slice()
  for (const i of cells) if (marks[i] === M_EMPTY) marks[i] = M_X
  commit({ ...g, marks, history: snapshot(g), assists: g.assists + 1 })
  activeHint.value = null
  return cells.length
}

// ---- scoring & finishing ----

const MULT = { easy: 1, medium: 1.3, hard: 1.6, expert: 2 } as const

export function computeScore(p: Puzzle, timeMs: number, clean: boolean, hints: number, median: number | null) {
  const base = p.n * p.n * 10 * MULT[p.difficulty]
  const speed = median ? Math.max(0, Math.min(1, median / timeMs - 1)) * base * 0.6 : 0
  const cleanBonus = clean ? base * 0.25 : 0
  const hintFactor = 1 - Math.min(0.5, hints * 0.1)
  return Math.round(((base + speed + cleanBonus) * hintFactor) / 5) * 5
}

async function checkWin() {
  const g = game.value
  if (!g || g.done) return
  const placed = g.marks.filter((m) => m === M_PIECE).length
  if (placed < g.puzzle.n) return
  const timeMs = elapsed(g)
  runStart = 0
  // cross out the rest so the finished board looks complete
  const marks = g.marks.map((m) => (m === M_EMPTY ? M_X : m))
  const done: GameState = { ...g, marks, done: true, elapsedMs: timeMs, drafts: null }
  commit(done)
  activeHint.value = null
  feedback('win')

  const clean = g.mistakes === 0 && g.hints === 0
  let history: SolveRecord[] = []
  try {
    history = await allSolves()
  } catch {
    /* IndexedDB unavailable – still celebrate */
  }
  const counted = history.filter((s) => s.mode !== 'extra')
  const median = medianTime(counted, g.puzzle.n)
  const score = computeScore(g.puzzle, timeMs, clean, g.hints, median)
  const rec: SolveRecord = {
    at: Date.now(),
    day: localDay(),
    mode: g.mode,
    sessionId: g.sessionId,
    level: g.level,
    n: g.puzzle.n,
    difficulty: g.puzzle.difficulty,
    grade: g.puzzle.grade,
    timeMs,
    firstTapMs: Math.max(0, g.firstTapMs),
    mistakes: g.mistakes,
    hints: g.hints,
    assists: g.assists,
    undos: g.undos,
    clean,
    score,
    themeId: g.themeId,
  }
  const pb = g.mode !== 'extra' && isNewPB(counted, rec)
  const fasterPct = g.mode !== 'extra' ? fasterThanPct(counted, rec) : null
  try {
    await addSolve(rec)
  } catch {
    /* keep going */
  }

  const pr = progress.value
  if (g.mode === 'session' && pr.session) {
    const result: SessionResult = {
      level: g.level, n: g.puzzle.n, difficulty: g.puzzle.difficulty, timeMs, score, clean, pb, fasterPct,
    }
    patchProgress({
      level: pr.level + 1,
      totalScore: pr.totalScore + score,
      session: { ...pr.session, index: pr.session.index + 1, results: [...pr.session.results, result] },
    })
  } else if (g.mode === 'daily') {
    patchProgress({ daily: { day: localDay(), timeMs, clean, score }, totalScore: pr.totalScore + score })
  } else {
    patchProgress({ extrasUsed: pr.extrasUsed + 1 })
  }
  win.value = { timeMs, score, clean, pb, fasterPct, median, mode: g.mode }
}

export function clearFinishedGame() {
  win.value = null
  game.value = null
  persist(null)
}

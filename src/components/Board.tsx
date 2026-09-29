import { useRef, useState } from 'preact/hooks'
import { DOUBLE_TAP_MS } from '../config'
import { M_EMPTY, M_PIECE, M_WRONG, M_X } from '../engine/hints'
import {
  game, activeHint, lastEvent, beginGesture, setCross, setCrossMany, placePiece, removePiece,
} from '../state/game'
import { settings } from '../state/settings'
import { theme, pieceArt } from '../state/theme'
import { unlockAudio, feedback } from '../feedback'
import { Piece } from './Piece'
import { assignColours } from '../engine/colours'
import { unspinPoint } from '../power/spin'
import { boardMode, powerPalette, powerPiece } from '../power/palette'

const X_PATH = 'M4.7 4.7l14.6 14.6M19.3 4.7 4.7 19.3'

/** White X; `wrong` = red X with a dark outline (readable on orange/coral); `draft` = pencil/preview. */
const XMark = ({ wrong = false, draft = false }: { wrong?: boolean; draft?: boolean }) => (
  <svg class={`xmark${draft ? ' draft' : ''}${wrong ? ' wrong' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
    {wrong && <path d={X_PATH} stroke="#5C1D2A" stroke-width={6.2} stroke-linecap="round" fill="none" />}
    <path
      class="x-main"
      d={X_PATH}
      stroke={wrong ? '#FF4F4F' : '#fff'}
      stroke-width={draft ? 3 : 3.85}
      stroke-linecap="round"
      fill="none"
    />
  </svg>
)

/** a finger rolling this far (px) is still a tap, not a drag */
const DRAG_SLOP = 8

type Gesture = {
  id: number
  start: number
  last: number
  startMark: number
  dragging: boolean
  on: boolean
  x: number
  y: number
}

export function Board() {
  const g = game.value
  const gridRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ cell: number; t: number } | null>(null)
  const [pressed, setPressed] = useState(-1)
  if (!g) return null
  const { n, regions } = g.puzzle
  const palette = powerPalette(g.mode === 'power' ? boardMode.value : null, theme.value.palette)
  const colourOf = assignColours(n, regions, palette)
  const hint = activeHint.value
  const focus = new Set(hint?.focus ?? [])
  const clearCells = new Set(hint?.apply.clear ?? [])
  const previewX = new Set(hint?.apply.cross ?? [])
  const unitCells = new Set<number>()
  for (const u of hint?.units ?? []) {
    for (let i = 0; i < n * n; i++) {
      const hit = u.type === 'row' ? ((i / n) | 0) === u.index : u.type === 'col' ? i % n === u.index : regions[i] === u.index
      if (hit) unitCells.add(i)
    }
  }
  const ev = lastEvent.value
  const fresh = Date.now() - ev.t < 700
  const gap = n <= 6 ? 6 : n <= 8 ? 5 : n <= 10 ? 4 : 3.5

  const markAt = (i: number) => {
    const cur = game.value!
    if (cur.drafts && cur.marks[i] === M_EMPTY) return cur.drafts[i] === 2 ? M_PIECE : cur.drafts[i] === 1 ? M_X : M_EMPTY
    return cur.marks[i]
  }

  const cellAt = (e: PointerEvent): number => {
    // exact hit first (robust to any layout quirk), geometry as fallback for gaps
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('.cell')
    if (hit?.dataset.i) return Number(hit.dataset.i)
    const el = gridRef.current!
    // a quarter-turned board has the same bounding box, so undo the spin/mirror then do plain geometry
    const r = el.getBoundingClientRect()
    const p = unspinPoint(e.clientX, e.clientY, r)
    const c = Math.floor(((p.x - r.left) / r.width) * n)
    const rr = Math.floor(((p.y - r.top) / r.height) * n)
    if (c < 0 || c >= n || rr < 0 || rr >= n) return -1
    return rr * n + c
  }

  const handleTap = (i: number) => {
    const m = markAt(i)
    const drafting = !!game.value!.drafts
    const now = performance.now()
    if (settings.value.inputMode === 'cycle') {
      if (m === M_EMPTY) setCross(i, true)
      else if (m === M_X) placePiece(i)
      // a real piece is always correct: only pencil pieces cycle away
      else if (m === M_PIECE && drafting) removePiece(i)
      feedback('tap')
      return
    }
    const lt = lastTap.current
    if (lt && lt.cell === i && now - lt.t < DOUBLE_TAP_MS) {
      lastTap.current = null
      // the first tap toggled an X and recorded the undo step: one Undo goes piece → empty
      if (m === M_EMPTY || m === M_X) placePiece(i, false, !drafting)
      else if (m === M_PIECE) removePiece(i)
      return
    }
    lastTap.current = { cell: i, t: now }
    if (m === M_EMPTY) setCross(i, true)
    else if (m === M_X) setCross(i, false)
    // outside pencil mode a single tap on a piece does nothing (a stray brush can't erase progress)
    else if (m === M_PIECE && drafting) removePiece(i)
    if (m !== M_WRONG) feedback('tap')
  }

  const onDown = (e: PointerEvent) => {
    if (game.value?.done || e.button > 0) return
    const i = cellAt(e)
    if (i < 0) return
    unlockAudio()
    try {
      gridRef.current?.setPointerCapture(e.pointerId)
    } catch { /* ignore */ }
    beginGesture()
    setPressed(i)
    gesture.current = {
      id: e.pointerId, start: i, last: i, startMark: markAt(i), dragging: false, on: true, x: e.clientX, y: e.clientY,
    }
  }

  const lineCells = (from: number, to: number): number[] => {
    // Bresenham between cells so fast swipes don't skip any
    const out: number[] = []
    let r0 = (from / n) | 0, c0 = from % n
    const r1 = (to / n) | 0, c1 = to % n
    const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0)
    const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1
    let err = dc - dr
    for (;;) {
      out.push(r0 * n + c0)
      if (r0 === r1 && c0 === c1) break
      const e2 = 2 * err
      if (e2 > -dr) { err -= dr; c0 += sc }
      if (e2 < dc) { err += dc; r0 += sr }
    }
    return out
  }

  const onMove = (e: PointerEvent) => {
    const gs = gesture.current
    if (!gs || gs.id !== e.pointerId) return
    const i = cellAt(e)
    if (i < 0 || i === gs.last) return
    const first = !gs.dragging
    if (first) {
      if (Math.hypot(e.clientX - gs.x, e.clientY - gs.y) <= DRAG_SLOP) return
      gs.dragging = true
      setPressed(-1)
      // start on an X → drag erases; otherwise drag marks
      gs.on = gs.startMark !== M_X
      lastTap.current = null
    }
    // one commit per move; the first step also marks the starting cell
    const cells = lineCells(gs.last, i)
    setCrossMany(first ? cells : cells.slice(1), gs.on)
    gs.last = i
  }

  const onUp = (e: PointerEvent) => {
    const gs = gesture.current
    if (!gs || gs.id !== e.pointerId) return
    gesture.current = null
    setPressed(-1)
    if (!gs.dragging) handleTap(gs.start)
  }

  const cells = []
  for (let i = 0; i < n * n; i++) {
    const m = g.marks[i]
    const d = g.drafts && m === M_EMPTY ? g.drafts[i] : 0
    const reg = regions[i]
    const cls = ['cell']
    if (settings.value.patterns) cls.push(`pat-${reg % 6}`)
    // resolved hint cells stop glowing
    const glowing = focus.has(i) && (clearCells.has(i) ? m === M_X : m === M_EMPTY)
    if (glowing) cls.push('focus')
    else if (hint && i === hint.source) cls.push('source')
    else if (unitCells.size && !unitCells.has(i) && !focus.has(i)) cls.push('dim')
    if (m === M_PIECE && g.hintCells.includes(i)) cls.push('gold')
    if (fresh && ev.cell === i) cls.push(ev.type === 'wrong' ? 'shake' : 'pop')
    if (pressed === i) cls.push('press')
    cells.push(
      <div
        key={i}
        data-i={i}
        class={cls.join(' ')}
        style={{ background: palette[colourOf[reg]], '--k': (i / n) | 0 } as never}
      >
        {m === M_X && <XMark />}
        {m === M_WRONG && <XMark wrong />}
        {m === M_PIECE && <Piece art={powerPiece(g.mode === 'power' ? boardMode.value : null, pieceArt.value)} />}
        {d === 1 && <XMark draft />}
        {d === 2 && (
          <span class="draft-piece">
            <Piece art={powerPiece(g.mode === 'power' ? boardMode.value : null, pieceArt.value)} />
          </span>
        )}
        {m === M_EMPTY && d !== 1 && previewX.has(i) && <XMark draft />}
      </div>,
    )
  }

  return (
    <div class={`board-card${g.drafts ? ' pencil' : ''}`}>
      <div
        ref={gridRef}
        class={`board${g.done ? ' solved' : ''}`}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`, gap: `${gap}px`, '--n': n } as never}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="grid"
        aria-label={`${n} by ${n} puzzle`}
      >
        {cells}
      </div>
    </div>
  )
}

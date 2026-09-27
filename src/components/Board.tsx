import { useRef } from 'preact/hooks'
import { DOUBLE_TAP_MS } from '../config'
import { M_EMPTY, M_PIECE, M_WRONG, M_X } from '../engine/hints'
import {
  game, activeHint, lastEvent, beginGesture, setCross, placePiece, removePiece,
} from '../state/game'
import { settings } from '../state/settings'
import { theme, pieceArt } from '../state/theme'
import { unlockAudio, feedback } from '../feedback'
import { Piece } from './Piece'

const XMark = ({ color = '#fff', dashed = false }: { color?: string; dashed?: boolean }) => (
  <svg class="xmark" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6 6 18"
      stroke={color}
      stroke-width={dashed ? 3 : 4.2}
      stroke-linecap="round"
      stroke-dasharray={dashed ? '3 3.5' : undefined}
      fill="none"
    />
  </svg>
)

type Gesture = {
  id: number
  start: number
  last: number
  startMark: number
  dragging: boolean
  on: boolean
}

export function Board() {
  const g = game.value
  const gridRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ cell: number; t: number } | null>(null)
  if (!g) return null
  const { n, regions } = g.puzzle
  const palette = theme.value.palette
  const hint = activeHint.value
  const focus = new Set(hint?.focus ?? [])
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
    const r = el.getBoundingClientRect()
    const c = Math.floor(((e.clientX - r.left) / r.width) * n)
    const rr = Math.floor(((e.clientY - r.top) / r.height) * n)
    if (c < 0 || c >= n || rr < 0 || rr >= n) return -1
    return rr * n + c
  }

  const handleTap = (i: number) => {
    const m = markAt(i)
    const now = performance.now()
    if (settings.value.inputMode === 'cycle') {
      if (m === M_EMPTY) setCross(i, true)
      else if (m === M_X) placePiece(i)
      else if (m === M_PIECE) removePiece(i)
      feedback('tap')
      return
    }
    const lt = lastTap.current
    if (lt && lt.cell === i && now - lt.t < DOUBLE_TAP_MS) {
      lastTap.current = null
      if (m === M_EMPTY || m === M_X) placePiece(i)
      return
    }
    lastTap.current = { cell: i, t: now }
    if (m === M_EMPTY) setCross(i, true)
    else if (m === M_X) setCross(i, false)
    else if (m === M_PIECE) removePiece(i)
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
    gesture.current = { id: e.pointerId, start: i, last: i, startMark: markAt(i), dragging: false, on: true }
  }

  const visitLine = (from: number, to: number, on: boolean) => {
    // Bresenham between cells so fast swipes don't skip any
    let r0 = (from / n) | 0, c0 = from % n
    const r1 = (to / n) | 0, c1 = to % n
    const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0)
    const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1
    let err = dc - dr
    for (;;) {
      setCross(r0 * n + c0, on)
      if (r0 === r1 && c0 === c1) break
      const e2 = 2 * err
      if (e2 > -dr) { err -= dr; c0 += sc }
      if (e2 < dc) { err += dc; r0 += sr }
    }
  }

  const onMove = (e: PointerEvent) => {
    const gs = gesture.current
    if (!gs || gs.id !== e.pointerId) return
    const i = cellAt(e)
    if (i < 0 || i === gs.last) return
    if (!gs.dragging) {
      gs.dragging = true
      // start on an X → drag erases; otherwise drag marks
      gs.on = gs.startMark !== M_X
      setCross(gs.start, gs.on)
      lastTap.current = null
    }
    visitLine(gs.last, i, gs.on)
    gs.last = i
  }

  const onUp = (e: PointerEvent) => {
    const gs = gesture.current
    if (!gs || gs.id !== e.pointerId) return
    gesture.current = null
    if (!gs.dragging) handleTap(gs.start)
  }

  const cells = []
  for (let i = 0; i < n * n; i++) {
    const m = g.marks[i]
    const d = g.drafts && m === M_EMPTY ? g.drafts[i] : 0
    const reg = regions[i]
    const cls = ['cell']
    if (settings.value.patterns) cls.push(`pat-${reg % 6}`)
    if (focus.has(i)) cls.push('focus')
    else if (unitCells.size && !unitCells.has(i)) cls.push('dim')
    if (g.hintCells.includes(i)) cls.push('gold')
    if (fresh && ev.cell === i) cls.push(ev.type === 'wrong' ? 'shake' : 'pop')
    cells.push(
      <div key={i} data-i={i} class={cls.join(' ')} style={{ background: palette[reg % palette.length] }}>
        {m === M_X && <XMark />}
        {m === M_WRONG && <XMark color="var(--bad)" />}
        {m === M_PIECE && <Piece art={pieceArt.value} />}
        {d === 1 && <XMark dashed />}
        {d === 2 && (
          <span class="draft-piece">
            <Piece art={pieceArt.value} />
          </span>
        )}
      </div>,
    )
  }

  return (
    <div class={`board-card${g.drafts ? ' pencil' : ''}`}>
      <div
        ref={gridRef}
        class="board"
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

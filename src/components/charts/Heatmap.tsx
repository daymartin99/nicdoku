import { useState } from 'preact/hooks'
import { Tip } from './Tooltip'
import './charts.css'

type Props = {
  /** consecutive days starting on a Monday (see metrics.heatmap) */
  data: { day: string; count: number }[]
  ariaLabel: string
  /** days before this (YYYY-MM-DD, e.g. her first solve) draw nothing, not empty squares */
  startDay?: string
}

const CELL = 18, GAP = 4, LEFT = 18, TOP = 34
const ROWS = ['M', '', 'W', '', 'F', '', '']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function level(count: number, max: number): number {
  if (!count) return 0
  return Math.min(4, Math.ceil((count / Math.max(max, 1)) * 4))
}
const OPACITY = [0, 0.3, 0.52, 0.76, 1]

function nice(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** GitHub-style calendar: columns are weeks, rows Mon→Sun, warm orange scale. */
export function Heatmap({ data, ariaLabel, startDay }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  if (!data.length) return null
  const weeks = Math.ceil(data.length / 7)
  const W = LEFT + weeks * (CELL + GAP)
  const H = TOP + 7 * (CELL + GAP)
  const max = Math.max(...data.map((d) => d.count))
  const pos = (i: number) => ({ x: LEFT + Math.floor(i / 7) * (CELL + GAP), y: TOP + (i % 7) * (CELL + GAP) })
  const s = sel !== null ? data[sel] : null

  return (
    // cap the width so a short (4-week) calendar doesn't blow up to giant squares
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ maxWidth: `${Math.round(W * 1.3)}px` }}>
      <title>{ariaLabel}</title>
      {ROWS.map((r, i) => r && (
        <text key={r} x={0} y={TOP + i * (CELL + GAP) + CELL - 4}>{r}</text>
      ))}
      {data.map((d, i) => {
        // month label above the first column that starts a month
        if (i % 7 !== 0) return null
        const dd = Number(d.day.slice(8, 10))
        if (i !== 0 && dd > 7) return null
        // the first column's label would collide with a month starting in the next column
        if (i === 0 && data[7] && Number(data[7].day.slice(8, 10)) <= 7) return null
        return <text key={'m' + i} x={pos(i).x} y={TOP - 10}>{MONTHS[Number(d.day.slice(5, 7)) - 1]}</text>
      })}
      {data.map((d, i) => {
        if (startDay && d.day < startDay) return null
        const { x, y } = pos(i)
        const lv = level(d.count, max)
        return (
          <g key={d.day} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y} width={CELL} height={CELL} rx={5} fill="var(--line)" />
            {lv > 0 && <rect x={x} y={y} width={CELL} height={CELL} rx={5} fill="var(--accent)" fill-opacity={OPACITY[lv]} />}
            {sel === i && <rect x={x - 1.5} y={y - 1.5} width={CELL + 3} height={CELL + 3} rx={6} fill="none" stroke="var(--ink)" stroke-width={2} />}
            <title>{`${nice(d.day)}: ${d.count} puzzle${d.count === 1 ? '' : 's'}`}</title>
          </g>
        )
      })}
      {s && (
        <Tip x={pos(sel!).x + CELL / 2} y={pos(sel!).y} width={W}
          text={`${nice(s.day)} · ${s.count} puzzle${s.count === 1 ? '' : 's'}`} />
      )}
    </svg>
  )
}

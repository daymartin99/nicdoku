import { useState } from 'preact/hooks'
import { Tip } from './Tooltip'
import './charts.css'

export type LinePoint = { label: string; value: number | null; highlight?: boolean }
type Props = {
  points: LinePoint[]
  format: (v: number) => string
  ariaLabel: string
  /** small axis note; defaults to "faster ↓" because lower times are better */
  axisNote?: string
}

const W = 320, H = 170, PL = 8, PR = 8, PT = 30, PB = 22

/** Line chart of times; lower = faster, drawn lower on the chart. PB points gold. */
export function LineChart({ points, format, ariaLabel, axisNote = 'faster ↓' }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null)
  if (!vals.length) return null
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo) * 0.15 || hi * 0.1 || 1
  lo = Math.max(0, lo - pad)
  hi += pad
  const step = points.length > 1 ? (W - PL - PR) / (points.length - 1) : 0
  const x = (i: number) => (points.length > 1 ? PL + i * step : W / 2)
  // smaller (faster) times sit lower on the chart
  const yy = (v: number) => H - PB - (H - PT - PB) * ((v - lo) / (hi - lo))

  // Connected segments between non-null points (gaps are skipped over, not dropped to zero)
  let d = ''
  points.forEach((p, i) => {
    if (p.value === null) return
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${yy(p.value).toFixed(1)}`
  })
  const s = sel !== null ? points[sel] : null

  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onClick={(e) => {
      if (e.target === e.currentTarget) setSel(null)
    }}>
      <title>{ariaLabel}</title>
      <line class="grid" x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} />
      <line class="grid" x1={PL} x2={W - PR} y1={PT} y2={PT} />
      <text x={W - PR} y={12} text-anchor="end">{axisNote}</text>
      <text x={PL} y={12}>{format(hi)}</text>
      <path d={d} fill="none" stroke="var(--accent)" stroke-width={3} stroke-linecap="round" stroke-linejoin="round" />
      {points.map((p, i) => (
        <text key={'l' + i} x={x(i)} y={H - 6} text-anchor="middle" font-size="10">
          {points.length <= 8 || i % 2 === points.length % 2 ? p.label : ''}
        </text>
      ))}
      {sel !== null && s?.value != null && (
        <line class="sel" x1={x(sel)} x2={x(sel)} y1={PT} y2={H - PB} />
      )}
      {points.map((p, i) =>
        p.value === null ? null : (
          <g key={i}>
            <circle
              cx={x(i)} cy={yy(p.value)} r={p.highlight ? 6 : 4.5}
              fill={p.highlight ? 'var(--gold)' : 'var(--card)'}
              stroke={p.highlight ? 'var(--gold)' : 'var(--accent)'} stroke-width={2.5}
            />
            <rect
              class="hit" x={x(i) - Math.max(step, 24) / 2} y={0} width={Math.max(step, 24)} height={H}
              onClick={() => setSel(sel === i ? null : i)}
            >
              <title>{`${p.label}: ${format(p.value)}${p.highlight ? ' (new best)' : ''}`}</title>
            </rect>
          </g>
        ),
      )}
      {s?.value != null && (
        <Tip x={x(sel!)} y={yy(s.value)} width={W} text={`${s.label} · ${format(s.value)}${s.highlight ? ' ★' : ''}`} />
      )}
    </svg>
  )
}

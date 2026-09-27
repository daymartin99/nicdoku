import { Tip } from './Tooltip'
import { useScrub } from './scrub'
import './charts.css'

export type LinePoint = { label: string; value: number | null; highlight?: boolean }
type Props = {
  points: LinePoint[]
  format: (v: number) => string
  ariaLabel: string
  /** small axis note; defaults to "faster ↓" because lower times are better */
  axisNote?: string
}

const W = 320, H = 170, PL = 8, PR = 8, PT = 30, PB = 26

/**
 * Line chart of times; lower = faster, drawn lower on the chart. PB points gold.
 * The first and last real points carry their value directly, so there is no
 * y-axis to decode. Tap or drag along the chart for the rest.
 */
export function LineChart({ points, format, ariaLabel, axisNote = 'faster ↓' }: Props) {
  const step = points.length > 1 ? (W - PL - PR) / (points.length - 1) : 0
  const x = (i: number) => (points.length > 1 ? PL + i * step : W / 2)
  const { sel, handlers } = useScrub(W, (vx) => {
    if (!points.length) return null
    const i = step ? Math.min(points.length - 1, Math.max(0, Math.round((vx - PL) / step))) : 0
    return points[i].value === null ? null : i
  })

  const real = points.map((p, i) => (p.value === null ? -1 : i)).filter((i) => i >= 0)
  if (!real.length) return null
  const vals = real.map((i) => points[i].value!)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo) * 0.15 || hi * 0.1 || 1
  lo = Math.max(0, lo - pad)
  hi += pad
  // smaller (faster) times sit lower on the chart
  const yy = (v: number) => H - PB - (H - PT - PB) * ((v - lo) / (hi - lo))

  // Connected segments between non-null points (gaps are skipped over, not dropped to zero)
  let d = ''
  points.forEach((p, i) => {
    if (p.value === null) return
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${yy(p.value).toFixed(1)}`
  })
  const s = sel !== null ? points[sel] : null
  const first = real[0], last = real[real.length - 1]
  const direct = first === last ? [first] : [first, last]

  return (
    <svg class="chart scrub" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} {...handlers}>
      <title>{ariaLabel}</title>
      <line class="grid" x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} />
      <line class="grid" x1={PL} x2={W - PR} y1={PT} y2={PT} />
      <text x={W - PR} y={14} text-anchor="end">{axisNote}</text>
      <path d={d} fill="none" stroke="var(--accent)" stroke-width={3} stroke-linecap="round" stroke-linejoin="round" />
      {points.map((p, i) => (
        <text key={'l' + i} x={x(i)} y={H - 5} text-anchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}>
          {points.length <= 5 || (points.length - 1 - i) % 2 === 0 ? p.label : ''}
        </text>
      ))}
      {sel !== null && s?.value != null && (
        <line class="sel" x1={x(sel)} x2={x(sel)} y1={PT} y2={H - PB} />
      )}
      {points.map((p, i) =>
        p.value === null ? null : (
          <g key={i}>
            <circle
              cx={x(i)} cy={yy(p.value)} r={p.highlight ? 6 : 4}
              fill={p.highlight ? 'var(--gold)' : 'var(--accent)'}
              stroke={p.highlight ? 'var(--card)' : 'none'} stroke-width={p.highlight ? 2 : 0}
            />
            <rect class="hit" x={x(i) - Math.max(step, 24) / 2} y={0} width={Math.max(step, 24)} height={H}>
              <title>{`${p.label}: ${format(p.value)}${p.highlight ? ' (new best)' : ''}`}</title>
            </rect>
          </g>
        ),
      )}
      {sel === null &&
        direct.map((i) => (
          <text
            key={'v' + i}
            class="direct"
            x={x(i)}
            y={yy(points[i].value!) < PT + 12 ? yy(points[i].value!) + 22 : yy(points[i].value!) - 11}
            text-anchor={i === first && direct.length > 1 ? 'start' : i === last && direct.length > 1 ? 'end' : 'middle'}
          >
            {format(points[i].value!)}
          </text>
        ))}
      {s?.value != null && (
        <Tip x={x(sel!)} y={yy(s.value)} width={W} text={`${s.label} · ${format(s.value)}${s.highlight ? ' ★' : ''}`} />
      )}
    </svg>
  )
}

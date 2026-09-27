import './charts.css'

type Props = {
  values: (number | null)[]
  ariaLabel: string
  width?: number
  height?: number
  color?: string
  /** draw a dot on the last point */
  dot?: boolean
}

/** Tiny non-interactive line for Home / SessionDone. */
export function Sparkline({ values, ariaLabel, width = 96, height = 28, color = 'var(--accent)', dot = true }: Props) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (pts.length < 2) return null
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v))
  const span = hi - lo || 1
  const pad = 3
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad)
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - 2 * pad)
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel} style={{ overflow: 'visible' }}>
      <title>{ariaLabel}</title>
      <path d={d} fill="none" stroke={color} stroke-width={2.2} stroke-linecap="round" stroke-linejoin="round" />
      {dot && <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />}
    </svg>
  )
}

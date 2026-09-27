import { useState } from 'preact/hooks'
import { Tip } from './Tooltip'
import './charts.css'

export type Bar = { label: string; value: number; /** optional short axis label */ tick?: string }
type Props = {
  data: Bar[]
  format: (v: number) => string
  ariaLabel: string
  color?: string
}

const W = 320, H = 150, PT = 30, PB = 20

/** Simple vertical bars (e.g. minutes played per day). Tap a bar to see its value. */
export function BarChart({ data, format, ariaLabel, color = 'var(--accent)' }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  if (!data.length) return null
  const max = Math.max(1, ...data.map((d) => d.value))
  const slot = W / data.length
  const bw = Math.max(2, slot * 0.68)
  const h = (v: number) => (H - PT - PB) * (v / max)
  const s = sel !== null ? data[sel] : null

  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <line class="grid" x1={0} x2={W} y1={H - PB} y2={H - PB} />
      <text x={0} y={12}>{format(max)}</text>
      <line class="grid" x1={0} x2={W} y1={PT} y2={PT} stroke-dasharray="2 4" />
      {data.map((d, i) => {
        const bh = d.value > 0 ? Math.max(3, h(d.value)) : 0
        const x = i * slot + (slot - bw) / 2
        return (
          <g key={i}>
            {bh > 0 && (
              <rect
                x={x} y={H - PB - bh} width={bw} height={bh} rx={Math.min(4, bw / 2)}
                fill={color} opacity={sel === null || sel === i ? 1 : 0.45}
              />
            )}
            {d.tick && <text x={i * slot + slot / 2} y={H - 5} text-anchor="middle" font-size="10">{d.tick}</text>}
            <rect class="hit" x={i * slot} y={0} width={slot} height={H} onClick={() => setSel(sel === i ? null : i)}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          </g>
        )
      })}
      {s && (
        <Tip x={sel! * slot + slot / 2} y={H - PB - h(s.value)} width={W} text={`${s.label} · ${format(s.value)}`} />
      )}
    </svg>
  )
}

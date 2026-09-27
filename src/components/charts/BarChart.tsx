import { Tip } from './Tooltip'
import { useScrub } from './scrub'
import './charts.css'

export type Bar = { label: string; value: number; /** optional short axis label */ tick?: string }
type Props = {
  data: Bar[]
  format: (v: number) => string
  ariaLabel: string
  color?: string
}

const W = 320, H = 150, PT = 30, PB = 22

/** Round the top of the scale up to a tidy number (1, 2 … 5, then 10, 15, 20 …). */
function niceMax(v: number): number {
  if (v <= 5) return Math.max(1, Math.ceil(v))
  return Math.ceil(v / 5) * 5
}

/** Simple vertical bars (e.g. minutes played per day). Tap or drag along it to see values. */
export function BarChart({ data, format, ariaLabel, color = 'var(--accent)' }: Props) {
  const slot = W / Math.max(1, data.length)
  const { sel, handlers } = useScrub(W, (vx) =>
    data.length ? Math.min(data.length - 1, Math.max(0, Math.floor(vx / slot))) : null,
  )
  if (!data.length) return null
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const bw = Math.max(2, slot * 0.68)
  const h = (v: number) => (H - PT - PB) * (v / max)
  const s = sel !== null ? data[sel] : null

  return (
    <svg class="chart scrub" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} {...handlers}>
      <title>{ariaLabel}</title>
      <line class="grid" x1={0} x2={W} y1={H - PB} y2={H - PB} />
      <text x={0} y={16}>{format(max)}</text>
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
            {d.tick && <text x={i * slot + slot / 2} y={H - 4} text-anchor="middle">{d.tick}</text>}
            <rect class="hit" x={i * slot} y={0} width={slot} height={H}>
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

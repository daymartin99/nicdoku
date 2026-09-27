// SVG tooltip bubble shared by the charts. Keeps itself inside [0, width].
type Props = { x: number; y: number; text: string; width: number }

export function Tip({ x, y, text, width }: Props) {
  const w = Math.max(36, text.length * 7 + 16)
  const h = 22
  const left = Math.min(Math.max(0, x - w / 2), width - w)
  const top = Math.max(0, y - h - 8)
  return (
    <g class="tip" pointer-events="none">
      <rect x={left} y={top} width={w} height={h} rx={11} />
      <text x={left + w / 2} y={top + 15} text-anchor="middle">{text}</text>
    </g>
  )
}

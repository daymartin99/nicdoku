import { signal } from '@preact/signals'
import type { SpinKind } from './timeline'

/** How the board is turned right now (Power Hour only). `pulse` is a short-lived rock/wobble animation. */
export const spin = signal<{ deg: number; mirror: boolean; pulse: { kind: SpinKind; t: number } | null }>({
  deg: 0,
  mirror: false,
  pulse: null,
})

/** When the last Wild colour swap landed (drives a short glitch on the board). */
export const swapPulse = signal(0)

export function resetSpin() {
  spin.value = { deg: 0, mirror: false, pulse: null }
}

/**
 * Map a screen point back to board coordinates when the board is rotated/mirrored.
 * Board transform is `rotate(deg) scaleX(m)` about its centre, so the inverse is scaleX(m)·rotate(−deg).
 */
export function unspinPoint(x: number, y: number, rect: DOMRect): { x: number; y: number } {
  const { deg, mirror } = spin.value
  if (!deg && !mirror) return { x, y }
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
  const a = (-deg * Math.PI) / 180
  let dx = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a)
  const dy = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)
  if (mirror) dx = -dx
  return { x: cx + dx, y: cy + dy }
}

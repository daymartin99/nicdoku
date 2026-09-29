// Board colours for Power modes. Normal keeps today's theme; calm goes soft; wild goes neon.
import { computed } from '@preact/signals'
import { PALETTES } from '../themes/palettes'
import { swapCountAt, type PowerMode } from './timeline'
import { power, runMode, powerArc, powerNow } from './state'
import { makeRng } from '../engine/rng'
import type { PieceArt } from '../themes/types'

/** Neon for wild mode: bright on near-black. X marks switch to dark ink on these (see power.css). */
export const NEON = [
  '#FF2BD6', // magenta
  '#00F0FF', // cyan
  '#39FF14', // acid green
  '#FFE600', // laser yellow
  '#FF6A00', // hazard orange
  '#B026FF', // ultraviolet
  '#00FF9C', // mint
  '#FF3860', // hot red
  '#4D7CFF', // electric blue
  '#FF9EF5', // bubblegum
  '#C6FF00', // lime
]

/** The mode of the Power run in progress (read on the very first frame, so no colour flicker). */
export const boardMode = computed<PowerMode | null>(() => (power.value && !power.value.seen ? runMode(power.value) : null))

export function powerPalette(mode: PowerMode | null, themePalette: string[]): string[] {
  if (mode === 'wild') return NEON
  if (mode === 'calm') return PALETTES.pastel ?? themePalette
  return themePalette
}

/** Wild mode's own piece: a neon lightning bolt in a glowing ring. */
export const NEON_PIECE: PieceArt = {
  kind: 'svg',
  svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#07000f" stroke="#00F0FF" stroke-width="7"/><circle cx="50" cy="50" r="40" fill="none" stroke="#FF2BD6" stroke-width="2.5" stroke-dasharray="10 8"/><path d="M56 16 30 55h17l-6 29 28-41H51l5-27z" fill="#FFE600" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>',
}

/** The piece to draw: wild swaps in the neon bolt, other modes keep today's piece. */
export function powerPiece(mode: PowerMode | null, art: PieceArt): PieceArt {
  return mode === 'wild' ? NEON_PIECE : art
}

// ---- wild colour swaps ----

/** How many colour swaps the running Wild board has had (0 outside Wild). */
export const swapCount = computed(() => {
  const r = power.value
  if (!r || r.seen || runMode(r) !== 'wild') return 0
  void powerNow.value
  return swapCountAt(powerArc(r), 'wild')
})

/** A fresh order of the palette for swap k (same run, same k → same colours, e.g. after a reload). */
export function swapPalette(palette: string[], k: number, seed: string): string[] {
  if (!k) return palette
  return makeRng(`${seed}:swap:${k}`).shuffle([...palette])
}

/** The palette actually on the board right now: theme/mode colours, reshuffled by Wild swaps. */
export function livePalette(isPower: boolean, themePalette: string[]): string[] {
  const mode = isPower ? boardMode.value : null
  const base = powerPalette(mode, themePalette)
  return mode === 'wild' ? swapPalette(base, swapCount.value, power.value?.id ?? '') : base
}

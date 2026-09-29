// Power Hour: a bounded, intense run that builds to a crescendo and then stops.
// Runs can be 10, 30, 45 or 60 minutes. Everything here works in "arc time": 0–60 minutes
// of shape (stages, spins, tempo, intensity). A shorter run moves through the same arc
// faster, so every feature keeps the same proportions. Pure logic, unit-tested.

import type { Difficulty } from '../engine/types'

/** The full arc. A run of any length is mapped onto it. */
export const POWER_MS = 60 * 60_000
const MIN = 60_000

export type PowerMode = 'calm' | 'normal' | 'wild'
export const DURATIONS_MIN = [5, 10, 30, 45, 60] as const
/** Power minutes per day; after using them, everything rests until tomorrow */
export const DAILY_POWER_MIN = 60

/** Convert real run time to arc time. */
export function arcMs(realMs: number, durationMs: number) {
  return Math.min(POWER_MS, Math.max(0, realMs) * (POWER_MS / durationMs))
}

/** Convert arc time back to real run time. */
export function realMs(arc: number, durationMs: number) {
  return arc * (durationMs / POWER_MS)
}

export type Stage = 'warm' | 'build' | 'surge' | 'crescendo'

export const STAGES: { id: Stage; name: string; from: number; to: number }[] = [
  { id: 'warm', name: 'Warm up', from: 0, to: 15 * MIN },
  { id: 'build', name: 'Build', from: 15 * MIN, to: 35 * MIN },
  { id: 'surge', name: 'Surge', from: 35 * MIN, to: 50 * MIN },
  { id: 'crescendo', name: 'Crescendo', from: 50 * MIN, to: POWER_MS },
]

const STAGE_NAMES: Record<PowerMode, Record<Stage, string>> = {
  calm: { warm: 'Settle in', build: 'Easy flow', surge: 'Steady', crescendo: 'Home stretch' },
  normal: { warm: 'Warm up', build: 'Build', surge: 'Surge', crescendo: 'Crescendo' },
  wild: { warm: 'BOOT', build: 'OVERCLOCK', surge: 'MELTDOWN', crescendo: 'SINGULARITY' },
}

export function stageName(stage: Stage, mode: PowerMode = 'normal') {
  return STAGE_NAMES[mode][stage]
}

export function stageAt(ms: number, mode: PowerMode = 'normal') {
  const t = Math.max(0, Math.min(POWER_MS, ms))
  const index = Math.max(0, STAGES.findIndex((s) => t >= s.from && t < s.to))
  const s = t >= POWER_MS ? STAGES[3] : STAGES[index]
  const raw = Math.pow(t / POWER_MS, 1.7)
  return {
    stage: s.id,
    name: stageName(s.id, mode),
    index: t >= POWER_MS ? 3 : index,
    /** 0..1 through the current stage */
    progress: (t - s.from) / (s.to - s.from),
    /** 0..1 across the arc, eased so the last third climbs hardest (calm stays gentle) */
    intensity: mode === 'calm' ? raw * 0.3 : raw,
  }
}

/** Heartbeat tempo: calm stays slow; normal rises ~54 → 120; wild ~64 → 132. */
export function bpmAt(ms: number, mode: PowerMode = 'normal') {
  const i = Math.pow(Math.max(0, Math.min(POWER_MS, ms)) / POWER_MS, 1.7)
  if (mode === 'calm') return Math.round(50 + 14 * i)
  if (mode === 'wild') return Math.round(64 + 68 * i)
  return Math.round(54 + 66 * i)
}

// ---- board spins ----
// First spin at 10 minutes of arc, then closer and closer together, moving from plain quarter
// turns to back-and-forth rocking, then flips, mirrors and odd spins. Progress is kept.
// Calm mode never spins.

export type SpinKind = 'cw' | 'ccw' | 'rock' | 'flip' | 'mirror' | 'spin' | 'wobble'
export type SpinEvent = { at: number; kind: SpinKind }

const SCHEDULE_MIN: [number, SpinKind][] = [
  [10, 'cw'],
  [20, 'cw'],
  [27, 'cw'],
  [33, 'ccw'],
  [38, 'rock'],
  [42, 'flip'],
  [45, 'rock'],
  [47.5, 'mirror'],
  [50, 'cw'],
  [52, 'spin'],
  [53.75, 'rock'],
  [55, 'mirror'],
  [56.25, 'flip'],
  [57.25, 'ccw'],
  [58.25, 'wobble'],
  [59, 'cw'],
]

export const SPINS: SpinEvent[] = SCHEDULE_MIN.map(([m, kind]) => ({ at: m * MIN, kind }))

export function spinsFor(mode: PowerMode = 'normal'): SpinEvent[] {
  return mode === 'calm' ? [] : SPINS
}

/** Lasting change a spin leaves behind (rock and wobble return to where they started). */
const NET: Record<SpinKind, { deg: number; mirror: boolean }> = {
  cw: { deg: 90, mirror: false },
  ccw: { deg: -90, mirror: false },
  flip: { deg: 180, mirror: false },
  spin: { deg: -270, mirror: false },
  mirror: { deg: 0, mirror: true },
  rock: { deg: 0, mirror: false },
  wobble: { deg: 0, mirror: false },
}

export type Orientation = { deg: number; mirror: boolean; last: SpinEvent | null }

/** Cumulative board orientation at a moment of arc time. */
export function orientationAt(ms: number, mode: PowerMode = 'normal'): Orientation {
  let deg = 0, mirror = false
  let last: SpinEvent | null = null
  for (const e of spinsFor(mode)) {
    if (e.at > ms) break
    deg += NET[e.kind].deg
    if (NET[e.kind].mirror) mirror = !mirror
    last = e
  }
  return { deg, mirror, last }
}

export function nextSpin(ms: number, mode: PowerMode = 'normal'): SpinEvent | null {
  return spinsFor(mode).find((e) => e.at > ms) ?? null
}

// ---- wild colour swaps ----
// Wild only: the board keeps its layout but every colour trades places. They start in the build,
// get closer together, and from the surge some land exactly on a spin (twist + glitch + recolour).

const SWAP_MIN = [22, 29, 33, 38.5, 42, 45.5, 47.5, 50, 51.5, 53, 55, 56.25, 57.25, 58.25, 59.25]

export const SWAPS: number[] = SWAP_MIN.map((m) => m * MIN)

export function swapsFor(mode: PowerMode = 'normal'): number[] {
  return mode === 'wild' ? SWAPS : []
}

/** How many colour swaps have happened by this point of the arc. */
export function swapCountAt(ms: number, mode: PowerMode = 'normal'): number {
  return swapsFor(mode).filter((at) => at <= ms).length
}

/** The next twist, glitch or recolour coming up (for the warning in the stage bar). */
export function nextEvent(ms: number, mode: PowerMode = 'normal'): { at: number; label: string } | null {
  const spin = nextSpin(ms, mode)
  const swap = swapsFor(mode).find((at) => at > ms)
  if (spin && swap !== undefined && Math.abs(spin.at - swap) < 1000) return { at: spin.at, label: 'twist + swap' }
  if (swap !== undefined && (!spin || swap < spin.at)) return { at: swap, label: 'colour swap' }
  return spin ? { at: spin.at, label: 'spin' } : null
}

// ---- puzzle plan ----

const LADDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
const easier = (d: Difficulty): Difficulty => LADDER[Math.max(0, LADDER.indexOf(d) - 1)]

/**
 * Size and difficulty for the next puzzle, from her usual board size, where she is in the arc,
 * how long the run is and the mode. The first crescendo puzzle is the "boss". On short runs the
 * boss shrinks so it can actually be solved in the time left (the crescendo of a 10-minute run
 * lasts 1 minute 40).
 */
export function puzzleSpec(
  ms: number,
  baseN: number,
  bossDone: boolean,
  durationMin = 60,
  mode: PowerMode = 'normal',
): { n: number; difficulty: Difficulty; boss: boolean } {
  const clamp = (n: number) => Math.max(6, Math.min(11, n))
  const short = durationMin <= 10
  const bossBump = durationMin >= 45 ? 2 : durationMin >= 30 ? 1 : 0
  const { stage, progress } = stageAt(ms)
  let spec: { n: number; difficulty: Difficulty; boss: boolean }
  switch (stage) {
    case 'warm':
      spec = { n: clamp(baseN - 1), difficulty: progress < 0.4 ? 'easy' : 'medium', boss: false }
      break
    case 'build':
      spec = { n: clamp(short ? baseN - 1 : baseN), difficulty: progress < 0.5 ? 'medium' : 'hard', boss: false }
      break
    case 'surge':
      spec = { n: clamp(short ? baseN : progress < 0.5 ? baseN : baseN + 1), difficulty: 'hard', boss: false }
      break
    case 'crescendo':
      spec = bossDone
        ? { n: clamp(baseN + (short ? 0 : 1)), difficulty: 'hard', boss: false }
        : { n: clamp(baseN + bossBump), difficulty: short ? 'hard' : 'expert', boss: true }
  }
  if (mode === 'calm') spec = { ...spec, n: clamp(Math.min(spec.n, baseN)), difficulty: easier(spec.difficulty) }
  return spec
}

// ---- scoring ----

export const STAGE_BONUS: Record<Stage, number> = { warm: 1, build: 1.25, surge: 1.5, crescendo: 2 }
export const MODE_BONUS: Record<PowerMode, number> = { calm: 0.8, normal: 1, wild: 1.25 }

/** Clean solves in a row build a multiplier: ×1.0, ×1.2 … capped at ×3.0. */
export function comboMultiplier(combo: number) {
  return 1 + 0.2 * Math.min(Math.max(combo - 1, 0), 10)
}

// ---- win words: they escalate with the arc ----

const WORDS: Record<PowerMode, Record<Stage, string[]>> = {
  calm: {
    warm: ['Lovely', 'Nice', 'Gentle'],
    build: ['Well done', 'Easy does it', 'Nicely'],
    surge: ['Smooth', 'Steady', 'Sweet'],
    crescendo: ['Beautiful', 'Soft landing', 'Just right'],
  },
  normal: {
    warm: ['Nice', 'Neat', 'Lovely', 'Sorted', 'Smooth'],
    build: ['Sharp', 'Rolling', 'Locked in', 'On it', 'Clean'],
    surge: ['Relentless', 'Unstoppable', 'Electric', 'Blazing', 'Fierce'],
    crescendo: ['SUPERNOVA', 'UNREAL', 'ASCENDED', 'GALACTIC', 'LEGEND', '∞'],
  },
  wild: {
    warm: ['BOOTED', 'ONLINE', 'SYNCED', 'PING'],
    build: ['OVERCLOCK', 'N30N', 'HACKED', 'CTRL+ALT+YES'],
    surge: ['GL1TCH', 'SYS//OVERLOAD', 'ERR: TOO GOOD', 'MELTDOWN'],
    crescendo: ['0xFFFFFF', '▓▒░ SINGULARITY ░▒▓', 'KERNEL PANIC', 'REALITY.EXE', '∞∞∞'],
  },
}

export function winWord(ms: number, k: number, combo: number, mode: PowerMode = 'normal') {
  const s = stageAt(ms).stage
  const list = WORDS[mode][s]
  const word = list[(k * 7 + combo) % list.length]
  return combo >= 5 && mode === 'normal' && s !== 'crescendo' ? `${word}!!` : word
}

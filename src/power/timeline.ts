// Power Hour: one intense, bounded hour a day that builds to a crescendo and then stops.
// Pure timing logic (stages, intensity, board spins, puzzle plan) so it can be unit-tested.

import type { Difficulty } from '../engine/types'

export const POWER_MS = 60 * 60_000
const MIN = 60_000

export type Stage = 'warm' | 'build' | 'surge' | 'crescendo'

export const STAGES: { id: Stage; name: string; from: number; to: number }[] = [
  { id: 'warm', name: 'Warm up', from: 0, to: 15 * MIN },
  { id: 'build', name: 'Build', from: 15 * MIN, to: 35 * MIN },
  { id: 'surge', name: 'Surge', from: 35 * MIN, to: 50 * MIN },
  { id: 'crescendo', name: 'Crescendo', from: 50 * MIN, to: POWER_MS },
]

export function stageAt(ms: number) {
  const t = Math.max(0, Math.min(POWER_MS, ms))
  const index = Math.max(0, STAGES.findIndex((s) => t >= s.from && t < s.to))
  const s = t >= POWER_MS ? STAGES[3] : STAGES[index]
  return {
    stage: s.id,
    name: s.name,
    index: t >= POWER_MS ? 3 : index,
    /** 0..1 through the current stage */
    progress: (t - s.from) / (s.to - s.from),
    /** 0..1 across the hour, eased so the last third climbs hardest */
    intensity: Math.pow(t / POWER_MS, 1.7),
  }
}

/** Heartbeat tempo: a resting ~54 bpm rising to ~120 bpm at the end. */
export function bpmAt(ms: number) {
  return Math.round(54 + 66 * stageAt(ms).intensity)
}

// ---- board spins ----
// First spin at 10 minutes, then closer and closer together, moving from plain quarter turns
// to back-and-forth rocking, then flips, mirrors and odd spins. Progress on the board is kept.

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

/** Cumulative board orientation at a moment. Degrees keep accumulating so CSS animates the short way she saw. */
export function orientationAt(ms: number): Orientation {
  let deg = 0, mirror = false
  let last: SpinEvent | null = null
  for (const e of SPINS) {
    if (e.at > ms) break
    deg += NET[e.kind].deg
    if (NET[e.kind].mirror) mirror = !mirror
    last = e
  }
  return { deg, mirror, last }
}

export function nextSpin(ms: number): SpinEvent | null {
  return SPINS.find((e) => e.at > ms) ?? null
}

// ---- puzzle plan ----

const LADDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

/**
 * Size and difficulty for the next puzzle, from her usual board size and where she is in the hour.
 * The first crescendo puzzle is the "boss": biggest and hardest.
 */
export function puzzleSpec(ms: number, baseN: number, bossDone: boolean): { n: number; difficulty: Difficulty; boss: boolean } {
  const clamp = (n: number) => Math.max(6, Math.min(11, n))
  const { stage, progress } = stageAt(ms)
  switch (stage) {
    case 'warm':
      return { n: clamp(baseN - 1), difficulty: progress < 0.4 ? 'easy' : 'medium', boss: false }
    case 'build':
      return { n: clamp(baseN), difficulty: progress < 0.5 ? 'medium' : 'hard', boss: false }
    case 'surge':
      return { n: clamp(progress < 0.5 ? baseN : baseN + 1), difficulty: 'hard', boss: false }
    case 'crescendo':
      return bossDone
        ? { n: clamp(baseN + 1), difficulty: 'hard', boss: false }
        : { n: clamp(baseN + 2), difficulty: LADDER[3], boss: true }
  }
}

// ---- scoring ----

export const STAGE_BONUS: Record<Stage, number> = { warm: 1, build: 1.25, surge: 1.5, crescendo: 2 }

/** Clean solves in a row build a multiplier: ×1.0, ×1.2 … capped at ×3.0. */
export function comboMultiplier(combo: number) {
  return 1 + 0.2 * Math.min(Math.max(combo - 1, 0), 10)
}

// ---- win words: they escalate with the hour ----

const WORDS: Record<Stage, string[]> = {
  warm: ['Nice', 'Neat', 'Lovely', 'Sorted', 'Smooth'],
  build: ['Sharp', 'Rolling', 'Locked in', 'On it', 'Clean'],
  surge: ['Relentless', 'Unstoppable', 'Electric', 'Blazing', 'Fierce'],
  crescendo: ['SUPERNOVA', 'UNREAL', 'ASCENDED', 'GALACTIC', 'LEGEND', '∞'],
}

export function winWord(ms: number, k: number, combo: number) {
  const s = stageAt(ms).stage
  const list = WORDS[s]
  const word = list[(k * 7 + combo) % list.length]
  return combo >= 5 && s !== 'crescendo' ? `${word}!!` : word
}

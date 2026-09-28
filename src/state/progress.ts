import { signal, effect } from '@preact/signals'
import { lsGet, lsSet, localDay } from '../db'
import { COOLDOWN_MIN, SICK_COOLDOWN_MIN, SESSION_SIZE, sizeForLevel, GENERATOR_VERSION } from '../config'
import type { Difficulty } from '../engine/types'
import { native } from '../native/bridge'

export type SessionResult = {
  level: number
  n: number
  difficulty: Difficulty
  timeMs: number
  score: number
  clean: boolean
  pb: boolean
  fasterPct: number | null
}

export type Session = {
  id: string
  startedAt: number
  levelAtStart: number
  index: number
  plan: { n: number; difficulty: Difficulty }[]
  results: SessionResult[]
  finishedAt?: number
}

export type Progress = {
  /** next level to play */
  level: number
  totalScore: number
  bestSessionScore: number
  /** -1 easier · 0 normal · +1 harder, nudged after each break */
  skill: number
  cooldownUntil: number
  extrasUsed: number
  daily: { day: string; timeMs: number; clean: boolean; score: number } | null
  session: Session | null
  /** random salt so puzzles aren't the same as anyone else running the code */
  salt: string
  /** local day Power Hour was finished: everything rests until tomorrow */
  restDay: string | null
  /** local day she switched on "not feeling great": gentler rules for that day only */
  sickDay: string | null
}

const fresh = (): Progress => ({
  level: 1,
  totalScore: 0,
  bestSessionScore: 0,
  skill: 0,
  cooldownUntil: 0,
  extrasUsed: 0,
  daily: null,
  session: null,
  salt: Math.random().toString(36).slice(2, 10),
  restDay: null,
  sickDay: null,
})

export const progress = signal<Progress>({ ...fresh(), ...lsGet('nd:progress', {}) })
effect(() => lsSet('nd:progress', progress.value))

export function patchProgress(p: Partial<Progress>) {
  progress.value = { ...progress.value, ...p }
}

const LADDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

/** 5 puzzles ramping warm-up → boss, shifted by her recent form. */
export function planSession(level: number, skill: number): Session['plan'] {
  const n = sizeForLevel(level)
  const early = level <= 20
  const base = early ? [0, 0, 1, 1, 2] : [0, 1, 1, 2, 3]
  return base.slice(0, SESSION_SIZE).map((d, i) => {
    const idx = Math.max(0, Math.min(3, d + skill))
    const size = i === 0 ? Math.max(5, n - 1) : i === SESSION_SIZE - 1 ? Math.min(11, n + (level > 30 ? 1 : 0)) : n
    return { n: size, difficulty: LADDER[idx] }
  })
}

export function sessionSeed(pr: Progress, level: number) {
  return `nicdoku:${GENERATOR_VERSION}:${pr.salt}:L${level}`
}

export function dailySeed(day = localDay()) {
  return `nicdoku:${GENERATOR_VERSION}:daily:${day}`
}

/** Daily puzzle: size and difficulty vary through the week (Mon easy → Sun big). */
export function dailySpec(day = localDay()): { n: number; difficulty: Difficulty } {
  const dow = new Date(day + 'T12:00:00').getDay() // 0 Sun
  const table: { n: number; difficulty: Difficulty }[] = [
    { n: 10, difficulty: 'expert' }, // Sun
    { n: 8, difficulty: 'easy' },
    { n: 8, difficulty: 'medium' },
    { n: 9, difficulty: 'medium' },
    { n: 9, difficulty: 'hard' },
    { n: 9, difficulty: 'hard' },
    { n: 10, difficulty: 'hard' }, // Sat
  ]
  return table[dow]
}

export function startSession(): Session {
  const pr = progress.value
  const s: Session = {
    id: `s${Date.now().toString(36)}`,
    startedAt: Date.now(),
    levelAtStart: pr.level,
    index: 0,
    plan: planSession(pr.level, sickToday() ? Math.max(-1, pr.skill - 1) : pr.skill),
    results: [],
  }
  patchProgress({ session: s })
  return s
}

export function finishSession() {
  const pr = progress.value
  const s = pr.session
  if (!s) return
  const score = s.results.reduce((a, r) => a + r.score, 0)
  // nudge difficulty: quick + clean → harder, messy/slow → easier
  const fastClean = s.results.filter((r) => r.clean && (r.fasterPct ?? 50) >= 60).length
  const messy = s.results.filter((r) => !r.clean).length
  let skill = pr.skill
  if (fastClean >= 4) skill = Math.min(1, skill + 1)
  else if (messy >= 3) skill = Math.max(-1, skill - 1)
  // native app: the break goes into Apple Health as Mindful Minutes
  void native.logMindful(s.startedAt, Date.now())
  patchProgress({
    session: { ...s, finishedAt: Date.now() },
    bestSessionScore: Math.max(pr.bestSessionScore, score),
    cooldownUntil: Date.now() + (sickToday() ? SICK_COOLDOWN_MIN : COOLDOWN_MIN) * 60_000,
    extrasUsed: 0,
    skill,
  })
}

export function inCooldown(now = Date.now()) {
  return progress.value.cooldownUntil > now
}

/** Power Hour is done for today: breaks, daily and Power Hour all rest until tomorrow. */
export function restingToday(day = localDay()) {
  return progress.value.restDay === day
}

/** "Not feeling great" is on for today (it switches itself off at midnight). */
export function sickToday(day = localDay()) {
  return progress.value.sickDay === day
}

export function setSickToday(on: boolean) {
  const pr = progress.value
  const finished = pr.session?.finishedAt
  const shorter = on && finished ? Math.min(pr.cooldownUntil, finished + SICK_COOLDOWN_MIN * 60_000) : pr.cooldownUntil
  patchProgress({ sickDay: on ? localDay() : null, cooldownUntil: shorter })
}

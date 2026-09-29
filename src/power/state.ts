// Power run state: the clock, combo, scoring, time away, the ending and the rest that follows.
// Runs last 10, 30, 45 or 60 minutes (60 Power minutes a day) in calm, normal or wild mode.
// It has its own records (kv 'powerHours'), kept apart from the normal break stats.

import { signal, computed } from '@preact/signals'
import { lsGet, lsSet, kvGet, kvSet, localDay } from '../db'
import { requestPuzzle } from '../worker/client'
import { game, startGame, freezeGame, clearFinishedGame, powerHooks, type PowerSolveInfo } from '../state/game'
import { progress, restingToday, powerWaiting, powerMinutesLeft, usePowerMinutes } from '../state/progress'
import { theme } from '../state/theme'
import { sizeForLevel, GENERATOR_VERSION } from '../config'
import { computeScore } from '../state/game'
import { go } from '../router'
import {
  POWER_MS, STAGES, stageAt, stageName, puzzleSpec, comboMultiplier, STAGE_BONUS, MODE_BONUS, winWord, spinsFor, arcMs,
  realMs, DURATIONS_MIN, type Stage, type PowerMode,
} from './timeline'
import { native, type HrSample } from '../native/bridge'

export type PowerSolve = {
  /** real ms since the run started */
  at: number
  n: number
  difficulty: string
  timeMs: number
  clean: boolean
  score: number
  combo: number
  stage: Stage
  boss: boolean
}

export type PowerRun = {
  id: string
  day: string
  startedAt: number
  /** run length in ms (older runs were always the full hour) */
  durationMs?: number
  /** calm / normal / wild (older runs were normal) */
  mode?: PowerMode
  endedAt?: number
  endReason?: 'time' | 'early'
  baseN: number
  solves: PowerSolve[]
  /** puzzles begun, used for seeds */
  started: number
  bossDone: boolean
  /** the puzzle on the board is the boss (decided when it started) */
  currentBoss: boolean
  combo: number
  bestCombo: number
  /** ms since start when the best combo was reached (the "peak") */
  peakAt: number
  score: number
  mistakes: number
  /** ms spent outside the app during the hour, and how many times she left */
  awayMs: number
  switches: number
  /** longest stretch in the app without leaving, ms */
  longestFocusMs: number
  focusSince: number
  hiddenAt?: number
  sound: boolean
  moodBefore?: number
  moodAfter?: number
  /** she has seen the results screen */
  seen?: boolean
  /** heart rate from her Apple Watch during the hour (native app only); t = ms since start */
  hr?: HrSample[]
}

/** Dev/test only: speed the hour up (e.g. 60 → one minute). Never set in normal use. */
const SCALE = Math.max(1, Number(lsGet<number>('nd:debugPowerScale', 1)) || 1)

export const power = signal<PowerRun | null>(lsGet<PowerRun | null>('nd:power', null))
/** 'playing' → 'time' (TIME. slam) → 'breathe' → 'done' */
export const powerPhase = signal<'playing' | 'time' | 'breathe' | 'done'>(
  power.value?.endedAt ? 'done' : 'playing',
)
/** the quick celebration shown over the board after each solve */
export const burst = signal<{ word: string; score: number; combo: number; t: number; boss: boolean } | null>(null)
/** ticks 4× a second while an hour is running, so the clock and effects re-render */
export const powerNow = signal(Date.now())

function save(r: PowerRun | null) {
  power.value = r
  lsSet('nd:power', r)
}

export const runDuration = (r: PowerRun | null) => r?.durationMs ?? POWER_MS
export const runMode = (r: PowerRun | null): PowerMode => r?.mode ?? 'normal'
export const runMinutes = (r: PowerRun | null) => Math.round(runDuration(r) / 60_000)

/** Real time into the run (ms), capped at its length. */
export function powerElapsed(r = power.value, now = powerNow.value): number {
  if (!r) return 0
  const end = r.endedAt ?? now
  return Math.min(runDuration(r), (end - r.startedAt) * SCALE)
}

/** Where the run is on the 60-minute arc (drives stages, spins, tempo, intensity). */
export function powerArc(r = power.value, now = powerNow.value): number {
  return arcMs(powerElapsed(r, now), runDuration(r))
}

export const powerRemaining = computed(() => runDuration(power.value) - powerElapsed())

/** No Power run can start now: resting after one, or today's 60 minutes are used. */
export function powerDoneToday(day = localDay()) {
  return restingToday(day) || powerWaiting() || powerMinutesLeft(day) < DURATIONS_MIN[0]
}

/** Lengths that still fit in what's left of today's Power minutes. */
export function lengthsAvailable(day = localDay()): number[] {
  const left = powerMinutesLeft(day)
  return DURATIONS_MIN.filter((m) => m <= left)
}

export async function powerHistory(): Promise<PowerRun[]> {
  try {
    return (await kvGet<PowerRun[]>('powerHours')) ?? []
  } catch {
    return []
  }
}

// ---- running ----

let ticker: ReturnType<typeof setInterval> | undefined
let stopHr: (() => void) | null = null

/** Collect live heart-rate samples from the Watch (native app only). */
function listenHeartRate() {
  stopHr?.()
  stopHr = native.onHeartRate((s) => {
    const r = power.value
    if (!r || r.endedAt) return
    const t = s.t - r.startedAt
    save({ ...r, hr: [...(r.hr ?? []), { t, bpm: s.bpm }] })
  })
}
function startTicker() {
  clearInterval(ticker)
  ticker = setInterval(() => {
    powerNow.value = Date.now()
    const r = power.value
    if (r && !r.endedAt && powerElapsed(r) >= runDuration(r)) endPower('time')
  }, 250)
}

async function nextPuzzle() {
  const r = power.value
  if (!r || r.endedAt) return
  const spec = puzzleSpec(powerArc(r), r.baseN, r.bossDone, runMinutes(r), runMode(r))
  const k = r.started
  save({ ...r, started: k + 1, currentBoss: spec.boss })
  const puzzle = await requestPuzzle(spec.n, `nicdoku:${GENERATOR_VERSION}:power:${r.id}:${k}`, spec.difficulty)
  const cur = power.value
  if (!cur || cur.endedAt) return
  startGame({ puzzle, mode: 'power', level: progress.value.level, themeId: theme.value.id })
  // warm the next one so there's never a wait between puzzles
  const after = puzzleSpec(powerArc(cur) + 3 * 60_000, cur.baseN, cur.bossDone || spec.boss, runMinutes(cur), runMode(cur))
  requestPuzzle(after.n, `nicdoku:${GENERATOR_VERSION}:power:${cur.id}:${k + 1}`, after.difficulty).catch(() => {})
}

export async function startPower(opts: { sound: boolean; moodBefore?: number; minutes: number; mode: PowerMode }) {
  if (powerDoneToday() || !lengthsAvailable().includes(opts.minutes)) return
  const now = Date.now()
  const durationMs = opts.minutes * 60_000
  const r: PowerRun = {
    id: `p${now.toString(36)}`,
    day: localDay(),
    startedAt: now,
    durationMs,
    mode: opts.mode,
    baseN: sizeForLevel(progress.value.level),
    solves: [],
    started: 0,
    bossDone: false,
    currentBoss: false,
    combo: 0,
    bestCombo: 0,
    peakAt: 0,
    score: 0,
    mistakes: 0,
    awayMs: 0,
    switches: 0,
    longestFocusMs: 0,
    focusSince: now,
    sound: opts.sound,
    moodBefore: opts.moodBefore,
  }
  save(r)
  powerPhase.value = 'playing'
  startTicker()
  // the Watch runs its own copy of the clock for haptics and the wrist view
  listenHeartRate()
  void native.powerStart({
    startedAt: now,
    durationMs: Math.ceil(durationMs / SCALE),
    spins: spinsFor(opts.mode).map((s) => Math.round(realMs(s.at, durationMs) / SCALE)),
    stages: STAGES.map((s) => ({ name: stageName(s.id, opts.mode), at: Math.round(realMs(s.from, durationMs) / SCALE) })),
    mode: opts.mode,
  })
  await nextPuzzle()
  go('game')
}

/** Reopening the app mid-hour: carry on (or end it, if the hour ran out while away). */
export function resumePower() {
  const r = power.value
  if (!r || r.endedAt) return
  startTicker()
  if (!stopHr) listenHeartRate()
  if (powerElapsed(r) >= runDuration(r)) endPower('time')
  else if (!game.value || game.value.mode !== 'power' || game.value.done) void nextPuzzle()
}

powerHooks.onSolved = (info: PowerSolveInfo) => {
  const r = power.value
  if (!r || r.endedAt) return
  const ms = powerElapsed(r)
  const arc = powerArc(r)
  const mode = runMode(r)
  const { stage } = stageAt(arc)
  const combo = info.clean ? r.combo + 1 : 0
  const base = computeScore(info.puzzle, info.timeMs, info.clean, info.hints, null)
  const boss = r.currentBoss
  const score = Math.round((base * comboMultiplier(combo) * STAGE_BONUS[stage] * MODE_BONUS[mode] * (boss ? 1.5 : 1)) / 5) * 5
  const solve: PowerSolve = {
    at: ms, n: info.puzzle.n, difficulty: info.puzzle.difficulty, timeMs: info.timeMs,
    clean: info.clean, score, combo, stage, boss,
  }
  const best = combo > r.bestCombo
  save({
    ...r,
    solves: [...r.solves, solve],
    combo,
    bestCombo: best ? combo : r.bestCombo,
    peakAt: best ? ms : r.peakAt,
    score: r.score + score,
    bossDone: r.bossDone || boss,
  })
  void native.powerUpdate({ combo, score: r.score + score, stage: stage, solved: r.solves.length + 1 })
  const bossWord = mode === 'wild' ? 'BOSS.EXE DELETED' : mode === 'calm' ? 'Big one done' : 'BOSS DOWN'
  burst.value = { word: boss ? bossWord : winWord(arc, r.solves.length, combo, mode), score, combo, t: Date.now(), boss }
  // a short beat on the solved board, then straight into the next one
  setTimeout(() => {
    if (power.value && !power.value.endedAt) void nextPuzzle()
  }, 1100)
}

powerHooks.onMistake = () => {
  const r = power.value
  if (!r || r.endedAt) return
  save({ ...r, combo: 0, mistakes: r.mistakes + 1 })
  void native.powerUpdate({ combo: 0, score: r.score, stage: stageAt(powerArc(r)).stage, solved: r.solves.length })
}

export async function endPower(reason: 'time' | 'early') {
  const r = power.value
  if (!r || r.endedAt) return
  const now = Date.now()
  const focus = Math.max(r.longestFocusMs, r.hiddenAt ? 0 : now - r.focusSince)
  const ended: PowerRun = {
    ...r,
    endedAt: reason === 'time' ? r.startedAt + Math.ceil(runDuration(r) / SCALE) : now,
    endReason: reason,
    longestFocusMs: focus,
    hiddenAt: undefined,
  }
  save(ended)
  clearInterval(ticker)
  freezeGame()
  // rest for as long as the run was chosen for; once today's 60 minutes are used, rest until tomorrow
  // a full run rests (and uses up) its chosen length; ending early counts the minutes actually played
  const played = reason === 'early' ? Math.max(1, Math.ceil(powerElapsed(ended) / 60_000)) : runMinutes(r)
  usePowerMinutes(Math.min(played, runMinutes(r)), r.day)
  powerPhase.value = 'time'
  // the Watch's full series is more complete than what streamed live (screen-off gaps etc.)
  stopHr?.()
  stopHr = null
  const { samples } = await native.powerEnd()
  if (samples.length) {
    const cur = power.value
    const full = samples.map((s) => ({ t: s.t - ended.startedAt, bpm: s.bpm })).filter((s) => s.t >= 0)
    if (cur && full.length >= (cur.hr?.length ?? 0)) save({ ...cur, hr: full })
  }
  try {
    const list = await powerHistory()
    const final = power.value ?? ended
    await kvSet('powerHours', [...list.filter((x) => x.id !== final.id), final])
  } catch {
    /* the run is still in localStorage */
  }
}

export function setPowerMoodAfter(v: number) {
  const r = power.value
  if (!r) return
  const next = { ...r, moodAfter: v }
  save(next)
  powerHistory()
    .then((list) => kvSet('powerHours', list.map((x) => (x.id === next.id ? next : x))))
    .catch(() => {})
}

export function leavePowerDone() {
  if (game.value?.mode === 'power') clearFinishedGame()
  const r = power.value
  if (r && !r.seen) save({ ...r, seen: true })
  powerPhase.value = 'done'
  go('home')
}

// ---- time away: counted honestly, the clock keeps running (it's a real hour) ----
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const r = power.value
    if (!r || r.endedAt) return
    const now = Date.now()
    if (document.hidden) {
      save({ ...r, hiddenAt: now, longestFocusMs: Math.max(r.longestFocusMs, now - r.focusSince) })
    } else if (r.hiddenAt) {
      save({ ...r, awayMs: r.awayMs + (now - r.hiddenAt), switches: r.switches + 1, hiddenAt: undefined, focusSince: now })
      resumePower()
    }
  })
}

if (power.value && !power.value.endedAt) startTicker()

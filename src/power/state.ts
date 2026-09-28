// Power Hour run state: the clock, combo, scoring, time away, the ending and the rest-until-tomorrow lock.
// It has its own records (kv 'powerHours'), kept apart from the normal break stats.

import { signal, computed } from '@preact/signals'
import { lsGet, lsSet, kvGet, kvSet, localDay } from '../db'
import { requestPuzzle } from '../worker/client'
import { game, startGame, freezeGame, clearFinishedGame, powerHooks, type PowerSolveInfo } from '../state/game'
import { progress, patchProgress, restingToday } from '../state/progress'
import { theme } from '../state/theme'
import { sizeForLevel, GENERATOR_VERSION } from '../config'
import { computeScore } from '../state/game'
import { go } from '../router'
import { POWER_MS, stageAt, puzzleSpec, comboMultiplier, STAGE_BONUS, winWord, type Stage } from './timeline'

export type PowerSolve = {
  /** ms since the hour started */
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

export function powerElapsed(r = power.value, now = powerNow.value): number {
  if (!r) return 0
  const end = r.endedAt ?? now
  return Math.min(POWER_MS, (end - r.startedAt) * SCALE)
}

export const powerRemaining = computed(() => POWER_MS - powerElapsed())

export function powerDoneToday(day = localDay()) {
  return restingToday(day) || (power.value?.day === day && !!power.value.endedAt)
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
function startTicker() {
  clearInterval(ticker)
  ticker = setInterval(() => {
    powerNow.value = Date.now()
    const r = power.value
    if (r && !r.endedAt && powerElapsed(r) >= POWER_MS) endPower('time')
  }, 250)
}

async function nextPuzzle() {
  const r = power.value
  if (!r || r.endedAt) return
  const ms = powerElapsed(r)
  const spec = puzzleSpec(ms, r.baseN, r.bossDone)
  const k = r.started
  save({ ...r, started: k + 1, currentBoss: spec.boss })
  const puzzle = await requestPuzzle(spec.n, `nicdoku:${GENERATOR_VERSION}:power:${r.id}:${k}`, spec.difficulty)
  const cur = power.value
  if (!cur || cur.endedAt) return
  startGame({ puzzle, mode: 'power', level: progress.value.level, themeId: theme.value.id })
  // warm the next one so there's never a wait between puzzles
  const after = puzzleSpec(powerElapsed(cur) + 3 * 60_000, cur.baseN, cur.bossDone || spec.boss)
  requestPuzzle(after.n, `nicdoku:${GENERATOR_VERSION}:power:${cur.id}:${k + 1}`, after.difficulty).catch(() => {})
}

export async function startPower(opts: { sound: boolean; moodBefore?: number }) {
  if (powerDoneToday()) return
  const now = Date.now()
  const r: PowerRun = {
    id: `p${now.toString(36)}`,
    day: localDay(),
    startedAt: now,
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
  await nextPuzzle()
  go('game')
}

/** Reopening the app mid-hour: carry on (or end it, if the hour ran out while away). */
export function resumePower() {
  const r = power.value
  if (!r || r.endedAt) return
  startTicker()
  if (powerElapsed(r) >= POWER_MS) endPower('time')
  else if (!game.value || game.value.mode !== 'power' || game.value.done) void nextPuzzle()
}

powerHooks.onSolved = (info: PowerSolveInfo) => {
  const r = power.value
  if (!r || r.endedAt) return
  const ms = powerElapsed(r)
  const { stage } = stageAt(ms)
  const combo = info.clean ? r.combo + 1 : 0
  const base = computeScore(info.puzzle, info.timeMs, info.clean, info.hints, null)
  const boss = r.currentBoss
  const score = Math.round((base * comboMultiplier(combo) * STAGE_BONUS[stage] * (boss ? 1.5 : 1)) / 5) * 5
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
  burst.value = { word: boss ? 'BOSS DOWN' : winWord(ms, r.solves.length, combo), score, combo, t: Date.now(), boss }
  // a short beat on the solved board, then straight into the next one
  setTimeout(() => {
    if (power.value && !power.value.endedAt) void nextPuzzle()
  }, 1100)
}

powerHooks.onMistake = () => {
  const r = power.value
  if (!r || r.endedAt) return
  save({ ...r, combo: 0, mistakes: r.mistakes + 1 })
}

export async function endPower(reason: 'time' | 'early') {
  const r = power.value
  if (!r || r.endedAt) return
  const now = Date.now()
  const focus = Math.max(r.longestFocusMs, r.hiddenAt ? 0 : now - r.focusSince)
  const ended: PowerRun = {
    ...r,
    endedAt: reason === 'time' ? r.startedAt + Math.ceil(POWER_MS / SCALE) : now,
    endReason: reason,
    longestFocusMs: focus,
    hiddenAt: undefined,
  }
  save(ended)
  clearInterval(ticker)
  freezeGame()
  patchProgress({ restDay: localDay() })
  powerPhase.value = 'time'
  try {
    const list = await powerHistory()
    await kvSet('powerHours', [...list.filter((x) => x.id !== ended.id), ended])
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

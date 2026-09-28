// Moves between sessions, puzzles and screens.

import { signal } from '@preact/signals'
import { requestPuzzle } from './worker/client'
import { go } from './router'
import { startGame, clearFinishedGame, game } from './state/game'
import {
  progress, patchProgress, startSession, finishSession, sessionSeed, dailySeed, dailySpec, planSession,
  restingToday,
} from './state/progress'
import { theme } from './state/theme'
import { localDay } from './db'
import { SESSION_SIZE, sizeForLevel } from './config'

export const loading = signal(false)

async function launch(fn: () => Promise<void>) {
  if (loading.value || restingToday()) return
  loading.value = true
  try {
    await fn()
    go('game')
  } finally {
    loading.value = false
  }
}

/** Warm the worker cache for the upcoming puzzles of a session. */
function prefetch(fromIndex: number) {
  const pr = progress.value
  const s = pr.session
  if (!s) return
  for (let k = fromIndex; k < s.plan.length; k++) {
    const level = s.levelAtStart + k
    requestPuzzle(s.plan[k].n, sessionSeed(pr, level), s.plan[k].difficulty).catch(() => {})
  }
}

async function playSessionPuzzle() {
  const pr = progress.value
  const s = pr.session!
  const spec = s.plan[s.index]
  const level = s.levelAtStart + s.index
  const puzzle = await requestPuzzle(spec.n, sessionSeed(pr, level), spec.difficulty)
  startGame({ puzzle, mode: 'session', level, sessionId: s.id, themeId: theme.value.id })
  prefetch(s.index + 1)
}

export function startBreak() {
  const s = progress.value.session
  // app was closed on the last win screen: wrap the break up properly
  if (s && !s.finishedAt && s.index >= SESSION_SIZE) {
    finishSession()
    clearFinishedGame()
    go('session-done')
    return
  }
  return launch(async () => {
    const pr = progress.value
    if (!pr.session || pr.session.finishedAt) startSession()
    await playSessionPuzzle()
  })
}

export function nextPuzzle() {
  const g = game.value
  const mode = g?.mode
  const s = progress.value.session
  if (mode === 'session' && s && s.id === g?.sessionId) {
    // the last win already finished the session (at the real solve time)
    if (s.index >= SESSION_SIZE) {
      if (!s.finishedAt) finishSession()
      clearFinishedGame()
      go('session-done')
      return
    }
    // keep the finished board + overlay up until the next puzzle is ready (no flash)
    if (!s.finishedAt) return launch(playSessionPuzzle)
  }
  clearFinishedGame()
  go('home')
}

export function startDaily() {
  return launch(async () => {
    const day = localDay()
    const spec = dailySpec(day)
    const puzzle = await requestPuzzle(spec.n, dailySeed(day), spec.difficulty)
    startGame({ puzzle, mode: 'daily', level: progress.value.level, themeId: theme.value.id })
  })
}

/** "Just one more" during a cooldown: never counted in stats. */
export function startExtra() {
  return launch(async () => {
    const pr = progress.value
    const n = sizeForLevel(pr.level)
    const puzzle = await requestPuzzle(n, `extra:${pr.salt}:${Date.now()}`, 'medium')
    startGame({ puzzle, mode: 'extra', level: pr.level, themeId: theme.value.id })
  })
}

export function continueGame() {
  if (game.value) go('game')
}

/** Warm the first puzzle of the next break so Start is instant. */
export function warmUp() {
  const pr = progress.value
  const plan = pr.session && !pr.session.finishedAt ? pr.session.plan : planSession(pr.level, pr.skill)
  const idx = pr.session && !pr.session.finishedAt ? pr.session.index : 0
  const level = pr.session && !pr.session.finishedAt ? pr.session.levelAtStart + idx : pr.level
  if (plan[idx]) requestPuzzle(plan[idx].n, sessionSeed(pr, level), plan[idx].difficulty).catch(() => {})
  const spec = dailySpec()
  if (pr.daily?.day !== localDay()) requestPuzzle(spec.n, dailySeed(), spec.difficulty).catch(() => {})
}

export function setStartLevel(level: number) {
  patchProgress({ level: Math.max(1, Math.min(2000, Math.round(level))) })
}

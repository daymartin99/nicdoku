// "Start again from scratch": wipes progress, stats, Power runs and records on this phone.
// Family dates/photos and settings can be kept. The page reloads so every in-memory state starts fresh.

import { allSolves, kvDel, kvKeys, replaceSolves, lsGet, lsSet } from './db'
import { abandonGame } from './state/game'
import { powerHistory } from './power/state'

export type ResetSummary = { solves: number; runs: number; level: number; score: number }

export async function resetSummary(): Promise<ResetSummary> {
  const [solves, runs] = await Promise.all([allSolves().catch(() => []), powerHistory().catch(() => [])])
  const pr = lsGet<{ level?: number; totalScore?: number }>('nd:progress', {})
  return { solves: solves.length, runs: runs.length, level: pr.level ?? 1, score: pr.totalScore ?? 0 }
}

/** Everything that counts as "progress"; wiped on every reset. */
const PROGRESS_KEYS = ['nd:game', 'nd:power', 'nd:progress', 'nd:powerPrefs', 'nd:weekly', 'nd:bigdayConfetti', 'nd:crashlog']

export async function resetEverything(opts: { keepFamily: boolean; keepSettings: boolean }): Promise<void> {
  // stop anything that might write old state back while we wipe
  abandonGame()

  await replaceSolves([])
  const keys = await kvKeys().catch(() => [] as string[])
  for (const k of keys) {
    const family = k === 'family' || k.startsWith('photo:')
    if (family && opts.keepFamily) continue
    await kvDel(k).catch(() => {})
  }

  for (const k of PROGRESS_KEYS) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* blocked storage: nothing to clear */
    }
  }
  if (opts.keepSettings) {
    // keep her name and controls, but walk through the welcome again (and pick a starting level)
    lsSet('nd:settings', { ...lsGet<Record<string, unknown>>('nd:settings', {}), onboarded: false, themeOverride: null })
  } else {
    try {
      localStorage.removeItem('nd:settings')
    } catch {
      /* ignore */
    }
  }
  location.reload()
}

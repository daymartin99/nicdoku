// This week's challenge: chosen once per week from her records, then checked after each run/break.
import { signal } from '@preact/signals'
import { allSolves, lsGet, lsSet, localDay } from '../db'
import { powerHistory } from '../power/state'
import { pickChallenge, checkChallenge, type Challenge } from '../stats/challenge'
import { weekStart } from '../stats/records'
import { progress } from './progress'

export const weekly = signal<Challenge | null>(lsGet<Challenge | null>('nd:weekly', null))

function save(c: Challenge | null) {
  weekly.value = c
  lsSet('nd:weekly', c)
}

/** Make sure this week has a challenge (picks a new one each Monday). */
export async function ensureWeekly(): Promise<Challenge | null> {
  const week = localDay(new Date(weekStart()))
  if (weekly.value?.week === week) return weekly.value
  try {
    const [runs, solves] = await Promise.all([powerHistory(), allSolves()])
    const c = pickChallenge(runs, solves, week, Date.now(), progress.value.salt)
    save(c)
    return c
  } catch {
    return null
  }
}

/** Check whether recent play beat this week's target. Returns true the moment it's completed. */
export async function refreshWeekly(): Promise<boolean> {
  const c = weekly.value
  if (!c || c.done) return false
  try {
    const [runs, solves] = await Promise.all([powerHistory(), allSolves()])
    const hit = checkChallenge(c, runs, solves)
    if (!hit) return false
    save({ ...c, done: { at: Date.now(), display: hit.display } })
    return true
  } catch {
    return false
  }
}

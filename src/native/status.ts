// Keeps the Watch complication/idle screen in step with the app: break open, resting, Power Hour…
// Native app only; on the web this module does nothing.

import { effect } from '@preact/signals'
import { isNative, native, type WatchStatus } from './bridge'
import { progress, restingToday, inCooldown, powerWaiting } from '../state/progress'
import { power } from '../power/state'
import { allSolves, localDay } from '../db'
import { streak } from '../stats/metrics'

let activeDays = 0
let last = ''

function compute(): WatchStatus {
  const p = power.value
  const pr = progress.value
  if (p && !p.endedAt) return { state: 'power', streak: activeDays, label: 'Power Hour' }
  if (restingToday()) return { state: 'resting', streak: activeDays, label: 'Rest day' }
  if (powerWaiting()) return { state: 'cooling', until: pr.powerRestUntil, streak: activeDays, label: 'Resting' }
  if (inCooldown()) return { state: 'cooling', until: pr.cooldownUntil, streak: activeDays, label: 'Next break' }
  return { state: 'open', streak: activeDays, label: 'Break open' }
}

function push() {
  const s = compute()
  const key = JSON.stringify(s)
  if (key === last) return
  last = key
  void native.setStatus(s)
}

export async function refreshStreak() {
  if (!isNative) return
  try {
    const solves = await allSolves()
    activeDays = solves.length ? streak(solves, localDay()).activeLast7 : 0
  } catch {
    /* keep the last value */
  }
  push()
}

if (isNative) {
  // re-send whenever progress or Power Hour changes; a timer catches cooldowns ending
  effect(() => {
    void progress.value
    void power.value
    push()
  })
  setInterval(push, 60_000)
  void refreshStreak()
}

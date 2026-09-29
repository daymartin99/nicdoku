// Bridge to the native iPhone app (Capacitor) and, through it, the Apple Watch and Apple Health.
// On the web every call is a harmless no-op, so the PWA keeps working exactly as before.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type HrSample = { t: number; bpm: number }

/** What the Watch needs to run Power Hour on its own clock (real ms, already speed-adjusted). */
export type PowerStartMsg = {
  startedAt: number
  durationMs: number
  /** real ms offsets from start */
  spins: number[]
  stages: { name: string; at: number }[]
  /** calm | normal | wild (calm has no spins, wild adds glitch haptics) */
  mode?: string
}

/** Shown on the Watch face complication and the Watch idle screen. */
export type WatchStatus = {
  state: 'open' | 'cooling' | 'resting' | 'power'
  /** epoch ms when a break opens again (cooling) */
  until?: number
  streak: number
  label: string
}

type NicdokuNative = {
  available(): Promise<{ health: boolean; watch: boolean }>
  requestHealth(): Promise<{ granted: boolean }>
  powerStart(msg: PowerStartMsg): Promise<{ watchLaunched: boolean }>
  powerUpdate(msg: { combo: number; score: number; stage: string; solved: number }): Promise<void>
  powerEnd(): Promise<{ samples: HrSample[] }>
  logMindful(msg: { start: number; end: number }): Promise<void>
  setStatus(msg: WatchStatus): Promise<void>
  addListener(event: 'heartRate', fn: (s: HrSample) => void): Promise<PluginListenerHandle>
}

export const isNative = Capacitor.isNativePlatform()

const plugin = isNative ? registerPlugin<NicdokuNative>('Nicdoku') : null

/** Swallow bridge errors: a Watch hiccup must never break the game. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!plugin) return fallback
  try {
    return await fn()
  } catch (e) {
    console.warn('[native]', e)
    return fallback
  }
}

export const native = {
  available: () => safe(() => plugin!.available(), { health: false, watch: false }),
  requestHealth: () => safe(() => plugin!.requestHealth(), { granted: false }),
  powerStart: (m: PowerStartMsg) => safe(() => plugin!.powerStart(m), { watchLaunched: false }),
  powerUpdate: (m: { combo: number; score: number; stage: string; solved: number }) =>
    safe(() => plugin!.powerUpdate(m), undefined),
  powerEnd: () => safe(() => plugin!.powerEnd(), { samples: [] as HrSample[] }),
  logMindful: (start: number, end: number) => safe(() => plugin!.logMindful({ start, end }), undefined),
  setStatus: (s: WatchStatus) => safe(() => plugin!.setStatus(s), undefined),
  onHeartRate: (fn: (s: HrSample) => void): (() => void) => {
    if (!plugin) return () => {}
    let handle: PluginListenerHandle | null = null
    plugin.addListener('heartRate', fn).then((h) => (handle = h)).catch(() => {})
    return () => void handle?.remove()
  },
}

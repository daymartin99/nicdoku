// Service worker registration + small iOS/PWA helpers.
// Updates are never applied automatically: we flag `updateReady` and let her tap
// "Refresh" when she's not mid-puzzle.

import { signal } from '@preact/signals'
import { isNative } from './native/bridge'
import { registerSW } from 'virtual:pwa-register'
import { lsGet, lsSet } from './db'

export const updateReady = signal(false)
/** true once the app is fully cached and works offline */
export const offlineReady = signal(false)
/** navigator.storage.persist() result: true / false, or null if unknown/unsupported */
export const storagePersisted = signal<boolean | null>(lsGet<boolean | null>('nd:persisted', null))

let updateSW: ((reload?: boolean) => Promise<void>) | null = null
let registered = false

export function registerPwa(): void {
  // the native app bundles everything and updates through TestFlight: no service worker there
  if (registered || isNative || !('serviceWorker' in navigator)) return
  registered = true
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady.value = true
    },
    onOfflineReady() {
      offlineReady.value = true
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // Look for a new version when she comes back to the app (at most hourly).
      let last = Date.now()
      const check = () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return
        if (Date.now() - last < 60 * 60 * 1000) return
        last = Date.now()
        reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
    },
  })
}

/** Activate the waiting service worker and reload into the new version. */
export async function applyUpdate(): Promise<void> {
  updateReady.value = false
  if (updateSW) await updateSW(true)
  else location.reload()
}

/** Ask the browser not to evict our storage. Only asks once (unless `force`); result kept in localStorage. */
export async function requestPersistence(force = false): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) {
      storagePersisted.value = true
      lsSet('nd:persisted', true)
      return true
    }
    if (!force && lsGet<boolean | null>('nd:persistAsked', null)) return storagePersisted.value
    lsSet('nd:persistAsked', true)
    const ok = await navigator.storage.persist()
    storagePersisted.value = ok
    lsSet('nd:persisted', ok)
    return ok
  } catch {
    return null
  }
}

/** Current persisted status, without asking. */
export async function checkPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null
    const ok = await navigator.storage.persisted()
    storagePersisted.value = ok
    lsSet('nd:persisted', ok)
    return ok
  } catch {
    return null
  }
}

export function isStandalone(): boolean {
  if (isNative) return true // the native app is always 'installed'
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    nav.standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
  )
}

export function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; detect by touch support.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

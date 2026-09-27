import { signal, computed, effect } from '@preact/signals'
import { kvGet, localDay } from '../db'
import { resolveTheme } from '../themes/calendar'
import type { FamilyData, PieceArt, ResolvedTheme } from '../themes/types'
import { settings } from './settings'

export const family = signal<FamilyData | null>(null)
/** bumps at midnight / on focus so the theme follows the calendar */
export const today = signal(new Date())

export async function loadFamily() {
  try {
    family.value = (await kvGet<FamilyData>('family')) ?? null
  } catch {
    family.value = null
  }
}

/** what the calendar alone says today (no hand-picked override) */
export const calendarResolved = computed<ResolvedTheme>(() => resolveTheme(today.value, family.value, null))

/** true when a birthday/special owns today, so a hand-picked theme can't hide it */
export const overrideLocked = computed(() => calendarResolved.value.isBigDay)

/** today's hand-picked theme id, if she picked one today */
export const activeOverrideId = computed<string | null>(() => {
  const ov = settings.value.themeOverride
  return ov && ov.day === localDay(today.value) ? ov.id : null
})

export const resolved = computed<ResolvedTheme>(() => {
  const base = calendarResolved.value
  const id = activeOverrideId.value
  if (!id || overrideLocked.value) return base
  return resolveTheme(today.value, family.value, id)
})

export const theme = computed(() => resolved.value.theme)

/** piece actually drawn on the board (her photo wins if chosen) */
export const pieceArt = computed<PieceArt>(() =>
  settings.value.photoPiece ? { kind: 'photo', photoId: settings.value.photoPiece } : theme.value.piece,
)

if (typeof window !== 'undefined') {
  const refresh = () => {
    const now = new Date()
    if (now.toDateString() !== today.value.toDateString()) today.value = now
  }
  document.addEventListener('visibilitychange', () => !document.hidden && refresh())
  setInterval(refresh, 60_000)

  effect(() => {
    const t = theme.value
    const root = document.documentElement.style
    root.setProperty('--bg', t.bg ?? '#f7f1ec')
    root.setProperty('--accent', t.accent ?? '#f2922f')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg ?? '#f7f1ec')
  })
}

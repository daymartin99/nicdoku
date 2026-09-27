import { signal, computed, effect } from '@preact/signals'
import { kvGet } from '../db'
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

export const resolved = computed<ResolvedTheme>(() =>
  resolveTheme(today.value, family.value, settings.value.themeOverride),
)

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

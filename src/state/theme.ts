import { signal, computed, effect } from '@preact/signals'
import { kvGet, localDay } from '../db'
import { resolveTheme, upcoming, setOwnerName } from '../themes/calendar'
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
export const calendarResolved = computed<ResolvedTheme>(() => {
  setOwnerName(settings.value.name)
  return resolveTheme(today.value, family.value, null)
})

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

/** Next family birthday / special date within 6 weeks, e.g. "🎂 Sam's birthday in 28 days". */
export function nextPersonalLine(from: Date, fam: FamilyData | null, days = 42): string | null {
  if (!fam) return null
  const next = upcoming(from, fam, days).find((u) => u.themeId.startsWith('birthday') || u.themeId === 'special')
  if (!next) return null
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const d = Math.round((new Date(next.date + 'T00:00:00').getTime() - start.getTime()) / 86400000)
  const when = d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
  return `${next.emoji} ${next.title} ${when}`
}

export const nextPersonal = computed(() => nextPersonalLine(today.value, family.value))

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

import { signal, effect } from '@preact/signals'
import { lsGet, lsSet, localDay } from '../db'

/** a theme she picked by hand; it only applies on the day she picked it */
export type ThemeOverride = { id: string; day: string }

export type Settings = {
  name: string
  /** 'meowdoku' = tap X / double-tap piece; 'cycle' = tap cycles empty → X → piece */
  inputMode: 'meowdoku' | 'cycle'
  /** cross out cells around a placed piece automatically */
  autoX: boolean
  showTimer: boolean
  showRules: boolean
  sound: boolean
  haptics: boolean
  /** subtle pattern per region so colours are never the only cue */
  patterns: boolean
  /** manual theme pick for one day, or null to follow the calendar */
  themeOverride: ThemeOverride | null
  /** photo piece id to use instead of the theme piece, or null */
  photoPiece: string | null
  onboarded: boolean
  /** epoch ms of last backup export */
  lastBackupAt: number
}

export const DEFAULT_SETTINGS: Settings = {
  name: 'Nicola',
  inputMode: 'meowdoku',
  autoX: false,
  showTimer: true,
  showRules: true,
  sound: false,
  haptics: true,
  patterns: false,
  themeOverride: null,
  photoPiece: null,
  onboarded: false,
  lastBackupAt: 0,
}

/** Older builds stored the override as a bare theme id that lasted forever. */
function migrate(raw: Partial<Settings> & { themeOverride?: unknown }): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw } as Settings & { themeOverride: unknown }
  const ov = s.themeOverride
  if (typeof ov === 'string') s.themeOverride = ov ? { id: ov, day: localDay() } : null
  else if (!ov || typeof ov !== 'object' || typeof (ov as ThemeOverride).id !== 'string') s.themeOverride = null
  return s as Settings
}

export const settings = signal<Settings>(migrate(lsGet('nd:settings', {})))

effect(() => lsSet('nd:settings', settings.value))

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
}

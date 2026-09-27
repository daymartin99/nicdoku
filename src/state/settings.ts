import { signal, effect } from '@preact/signals'
import { lsGet, lsSet } from '../db'

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
  /** manual theme override id, or null to follow the calendar */
  themeOverride: string | null
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

export const settings = signal<Settings>({ ...DEFAULT_SETTINGS, ...lsGet('nd:settings', {}) })

effect(() => lsSet('nd:settings', settings.value))

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
}

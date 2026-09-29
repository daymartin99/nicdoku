// Tunables. Change these after a week of real play.
export const SESSION_SIZE = 5
export const COOLDOWN_MIN = 60
/** rest between breaks on a "not feeling great" day */
export const SICK_COOLDOWN_MIN = 20
export const LIVES = 3
/** extra puzzles allowed during a cooldown (not counted in stats) */
export const JUST_ONE_MORE = 1
export const DOUBLE_TAP_MS = 420
export const APP_NAME = 'Nicdoku'
/**
 * Personal names are set per deployment (Vercel env / a local .env.local), never in the public code:
 *   VITE_OWNER_NAME = who the app is for (greeting, their own birthday week)
 *   VITE_MAKER_NAME = who made it for them ("Made by …")
 */
const env = import.meta.env as Record<string, string | undefined>
export const OWNER_NAME = env.VITE_OWNER_NAME?.trim() ?? ''
export const MAKER_NAME = env.VITE_MAKER_NAME?.trim() ?? ''
export const GENERATOR_VERSION = 'v1'

/** Board size grows with level, roughly like Meowdoku (she was on 9×9 at level 134). */
export function sizeForLevel(level: number): number {
  if (level <= 3) return 5
  if (level <= 10) return 6
  if (level <= 25) return 7
  if (level <= 60) return 8
  if (level <= 160) return 9
  if (level <= 320) return 10
  return 11
}

// Today's dailies as a short message for the family chat. Times only, never the board,
// so nobody gets a spoiler before they've played.

import { APP_NAME } from './config'
import { KIND_INFO, type DailyPlan, type DailySlot } from './dailies'
import type { DailyResult } from './state/progress'
import { formatTime } from './stats/metrics'

export function dailyShareText(
  day: string,
  lineup: DailyPlan[],
  result: (slot: DailySlot) => DailyResult | null,
): string {
  const date = new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const lines = lineup.map((p) => {
    const info = KIND_INFO[p.kind]
    const r = result(p.slot)
    const size = `${p.n}×${p.n}`
    const how = r ? `${formatTime(r.timeMs)}${r.clean ? ' ✨' : ''}` : 'not yet'
    return `${info.icon} ${info.title} ${size} · ${how}`
  })
  const anyClean = lineup.some((p) => result(p.slot)?.clean)
  return [`${APP_NAME} · ${date}`, ...lines, ...(anyClean ? ['✨ = no mistakes, no hints'] : [])].join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** The phone's share sheet where there is one, otherwise the clipboard. */
export async function shareText(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      // closing the sheet isn't a failure
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** A short line to show after sharing, or '' when nothing needs saying. */
export function shareNote(o: ShareOutcome): string {
  if (o === 'copied') return 'Copied, ready to paste in a chat'
  if (o === 'failed') return "Couldn't share this time"
  return ''
}

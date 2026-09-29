import { useEffect } from 'preact/hooks'
import { go } from '../router'
import { lsGet, lsSet } from '../db'
import { weekly, ensureWeekly, refreshWeekly } from '../state/weekly'
import { startBreak } from '../flow'

/** Home: this week's one target, from her own records. Tapping it starts the right thing. */
export function ChallengeCard({ disabled }: { disabled?: boolean }) {
  useEffect(() => {
    void ensureWeekly().then(() => refreshWeekly())
  }, [])
  const c = weekly.value
  if (!c) return null

  const play = () => {
    if (c.done) return
    if (c.kind === 'break') {
      void startBreak()
      return
    }
    // open Power already set to the challenge's format
    const [min, mode] = c.key.split('-')
    const prefs = lsGet<{ minutes: number; mode: string; sound: boolean }>('nd:powerPrefs', { minutes: 60, mode: 'normal', sound: true })
    lsSet('nd:powerPrefs', { ...prefs, minutes: Number(min), mode })
    go('power-intro')
  }

  const ends = 'Ends Sunday night'
  return (
    <button class={`card challenge-card${c.done ? ' done' : ''}`} onClick={play} disabled={disabled && !c.done}>
      <span class="ch-icon" aria-hidden="true">{c.done ? '✓' : '🎯'}</span>
      <span class="ch-text">
        <span class="label">This week's challenge</span>
        <b>{c.title}</b>
        <span class="muted">{c.done ? `Done: ${c.done.display}. A new one arrives Monday.` : `${c.sub} · ${ends}`}</span>
      </span>
    </button>
  )
}

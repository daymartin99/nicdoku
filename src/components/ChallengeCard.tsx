import { useEffect } from 'preact/hooks'
import { go } from '../router'
import { lsGet, lsSet } from '../db'
import { weekly, ensureWeekly, refreshWeekly } from '../state/weekly'
import { progress, inCooldown } from '../state/progress'

/** Home: this week's one target, from her own records. Tapping it starts the right thing. */
/** `onBreak` starts (or resumes) a break the same way Home's main button does. */
export function ChallengeCard({ disabled, onBreak }: { disabled?: boolean; onBreak: () => void }) {
  useEffect(() => {
    void ensureWeekly().then(() => refreshWeekly())
  }, [])
  const c = weekly.value
  if (!c) return null

  const play = () => {
    if (c.done) return
    if (c.kind === 'break') {
      onBreak()
      return
    }
    // open Power already set to the challenge's format
    const [min, mode] = c.key.split('-')
    const prefs = lsGet<{ minutes: number; mode: string; sound: boolean }>('nd:powerPrefs', { minutes: 60, mode: 'normal', sound: true })
    lsSet('nd:powerPrefs', { ...prefs, minutes: Number(min), mode })
    go('power-intro')
  }

  const ends = 'Ends Sunday night'
  // a break challenge waits for the next break, like the main button
  const s = progress.value.session
  const waitBreak = c.kind === 'break' && !c.done && (!s || !!s.finishedAt) && inCooldown()
  const nextAt = new Date(progress.value.cooldownUntil).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  const sub = c.done
    ? `Done: ${c.done.display}. A new one arrives Monday.`
    : waitBreak
      ? `${c.sub} · Next break from ${nextAt}`
      : `${c.sub} · ${ends}`
  return (
    <button class={`card challenge-card${c.done ? ' done' : ''}`} onClick={play} disabled={(disabled || waitBreak) && !c.done}>
      <span class="ch-icon" aria-hidden="true">{c.done ? '✓' : '🎯'}</span>
      <span class="ch-text">
        <span class="label">This week's challenge</span>
        <b>{c.title}</b>
        <span class="muted">{sub}</span>
      </span>
    </button>
  )
}

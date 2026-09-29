import { useEffect, useState } from 'preact/hooks'
import { allSolves } from '../db'
import { powerHistory } from '../power/state'
import { welcomeBack } from '../stats/comeback'

/** Results screens: a warm card when this is her first play after a few days away. */
export function WelcomeBack({ day, since }: { day: string; since: number }) {
  const [card, setCard] = useState<{ title: string; lines: string[] } | null>(null)
  useEffect(() => {
    Promise.all([allSolves(), powerHistory()])
      .then(([solves, runs]) => {
        // only on the first break or run of the day, not every one after it. The daily puzzle
        // has no results screen, so a daily played first mustn't hide the card; nor should a
        // Power run that was abandoned before it solved anything.
        const earlier =
          solves.some((s) => s.day === day && s.at < since && s.mode === 'session') ||
          runs.some((r) => r.day === day && r.startedAt < since && (r.solves.length > 0 || !!r.endedAt))
        setCard(earlier ? null : welcomeBack(solves, runs, day))
      })
      .catch(() => {})
  }, [day, since])
  if (!card) return null
  return (
    <div class="card welcome-back fade-in" role="status">
      <span aria-hidden="true">👋</span>
      <span>
        <b>{card.title}</b>
        {card.lines.map((l) => (
          <span key={l} class="wb-line">{l}</span>
        ))}
      </span>
    </div>
  )
}

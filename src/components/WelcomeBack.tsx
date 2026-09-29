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
        // only on the first break or run of the day, not every one after it
        const earlier =
          solves.some((s) => s.day === day && s.at < since) || runs.some((r) => r.day === day && r.startedAt < since)
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

import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { progress } from '../state/progress'
import { theme } from '../state/theme'
import { allSolves, type SolveRecord } from '../db'
import { formatTime, medianTime } from '../stats/metrics'
import { COOLDOWN_MIN } from '../config'

// Honest, research-backed lines (see About). One is picked per break.
const MESSAGES = [
  'Short, focused breaks tend to leave people feeling more energised and less tired. That was one.',
  "You gave your attention one thing for ten minutes. That's a proper reset.",
  "You're measurably getting quicker at this puzzle: the graphs don't lie.",
  'Done for now. Your brain has had a change of scene; go enjoy the rest of your day.',
  'Breaks work best when they end. This one just did, nicely.',
]

export function SessionDoneScreen() {
  const s = progress.value.session
  const [solves, setSolves] = useState<SolveRecord[]>([])
  useEffect(() => {
    allSolves().then(setSolves).catch(() => {})
  }, [])
  if (!s) {
    go('home')
    return null
  }
  const total = s.results.reduce((a, r) => a + r.score, 0)
  const time = s.results.reduce((a, r) => a + r.timeMs, 0)
  const clean = s.results.filter((r) => r.clean).length
  const pbs = s.results.filter((r) => r.pb)
  const best = progress.value.bestSessionScore
  const msg = MESSAGES[Math.abs(hash(s.id)) % MESSAGES.length]
  const n = s.results[s.results.length - 1]?.n ?? 9
  const med = medianTime(solves.filter((x) => x.mode !== 'extra'), n)

  return (
    <div class="screen session-done fade-in">
      <div class="done-hero">
        <span class="done-emoji" aria-hidden="true">🌿</span>
        <h1>Break done</h1>
        <p class="muted">{theme.value.name}</p>
      </div>

      <div class="card done-stats">
        <div>
          <span class="label">Break score</span>
          <b class="big-num">{total.toLocaleString('en-GB')}</b>
          {total >= best && total > 0 && <span class="badge gold">Best break yet!</span>}
        </div>
        <div>
          <span class="label">Time</span>
          <b class="big-num">{formatTime(time)}</b>
        </div>
        <div>
          <span class="label">Clean solves</span>
          <b class="big-num">
            {clean}/{s.results.length}
          </b>
        </div>
      </div>

      <div class="card done-list">
        {s.results.map((r, i) => (
          <div key={i} class="done-row">
            <span class="dr-n">{r.n}×{r.n}</span>
            <span class={`diff-chip ${r.difficulty}`}>{r.difficulty}</span>
            <span class="dr-time">{formatTime(r.timeMs)}</span>
            <span class="dr-tags">
              {r.pb && <span class="badge gold">PB</span>}
              {r.clean && <span class="badge good">✓</span>}
            </span>
          </div>
        ))}
        {med !== null && <p class="muted small">Your recent {n}×{n} median: {formatTime(med)}</p>}
      </div>

      {pbs.length > 0 && (
        <div class="card pb-card">
          🏆 {pbs.length === 1 ? 'A new personal best' : `${pbs.length} new personal bests`} this break
        </div>
      )}

      <p class="honest">{msg}</p>

      <div class="card cooldown-note">
        Next break unlocks in <b>{COOLDOWN_MIN} min</b>. The daily puzzle is always open.
      </div>

      <button class="btn" onClick={() => go('home')}>
        Back to home
      </button>
      <button class="btn secondary small" onClick={() => go('stats')}>
        See my graphs
      </button>
    </div>
  )
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

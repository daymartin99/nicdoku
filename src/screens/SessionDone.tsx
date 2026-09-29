import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { progress } from '../state/progress'
import { pieceArt } from '../state/theme'
import { allSolves, localDay, type SolveRecord } from '../db'
import { formatTime, median, medianTime } from '../stats/metrics'
import { Piece } from '../components/Piece'
import { MoodTap } from '../components/MoodTap'
import { saveMood } from '../mood'
import './home.css'
import { weekly, refreshWeekly } from '../state/weekly'
import '../power/power.css'

// Calm, honest closing lines. One is picked per break.
const MESSAGES = [
  'That was a proper break: a few minutes on one thing, then done.',
  "You gave one thing your full attention for a few minutes. That's a proper reset.",
  'Done for now. Your brain has had a change of scene; go enjoy the rest of your day.',
  'Breaks work best when they end. This one just did, nicely.',
]

export function SessionDoneScreen() {
  const s = progress.value.session
  const [solves, setSolves] = useState<SolveRecord[]>([])
  // after-break check-in: 'ask' → 'thanks' (picked) or 'skipped'
  const [mood, setMood] = useState<'ask' | 'thanks' | 'skipped'>('ask')
  useEffect(() => {
    allSolves().then(setSolves).catch(() => {})
  }, [])
  // a break can complete a break-based weekly challenge
  const [challengeDone, setChallengeDone] = useState(false)
  useEffect(() => {
    void refreshWeekly().then(setChallengeDone)
  }, [])
  useEffect(() => {
    if (!s) go('home')
  }, [s])
  if (!s) return null

  const total = s.results.reduce((a, r) => a + r.score, 0)
  const time = s.results.reduce((a, r) => a + r.timeMs, 0)
  const clean = s.results.filter((r) => r.clean).length
  const best = progress.value.bestSessionScore
  const msg = MESSAGES[Math.abs(hash(s.id)) % MESSAGES.length]

  // compare only with solves from before this break, never with itself
  const prior = solves.filter((x) => x.at < s.startedAt && x.mode !== 'extra')
  const medians = new Map<number, number | null>()
  const usual = (n: number) => {
    if (!medians.has(n)) medians.set(n, medianTime(prior, n))
    return medians.get(n) ?? null
  }

  // a data-backed line, only when it's actually true
  const bySize = new Map<number, number[]>()
  for (const r of s.results) bySize.set(r.n, [...(bySize.get(r.n) ?? []), r.timeMs])
  let quicker: string | null = null
  for (const [n, times] of [...bySize].sort((a, b) => b[1].length - a[1].length)) {
    if (times.length < 2) continue
    const a = median(times)
    const b = usual(n)
    if (a !== null && b !== null && a < b) {
      quicker = `This break's ${n}×${n} solves averaged ${formatTime(a)}; your usual is ${formatTime(b)}.`
      break
    }
  }

  const pr = progress.value
  const nextAt = new Date(pr.cooldownUntil).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  const dailyWaiting = pr.daily?.day !== localDay()

  return (
    <div class="screen session-done fade-in">
      <div class="done-hero">
        <div class="done-art" aria-hidden="true">
          <Piece art={pieceArt.value} />
        </div>
        <h1>Break done</h1>
        <p class="muted">
          {s.results.length} puzzles · {formatTime(time)} solving
        </p>
      </div>

      {challengeDone && (
        <div class="card pd-challenge fade-in" role="status">
          <span aria-hidden="true">🎯</span>
          <span>
            <b>Weekly challenge done!</b>
            <span class="muted"> {weekly.value?.title} · {weekly.value?.done?.display}</span>
          </span>
        </div>
      )}

      <div class="card done-stats">
        <div>
          <span class="label">Break score</span>
          <b class="big-num">{total.toLocaleString('en-GB')}</b>
          {total >= best && total > 0 && <span class="badge gold">Best break yet!</span>}
        </div>
        <div>
          <span class="label">Solving time</span>
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
        {s.results.map((r, i) => {
          const m = usual(r.n)
          return (
            <div key={i} class="done-row">
              <span class="dr-n">{r.n}×{r.n}</span>
              <span class={`diff-chip ${r.difficulty}`}>{r.difficulty}</span>
              <span class="dr-time">{formatTime(r.timeMs)}</span>
              <span class="dr-tags">
                {m !== null && r.timeMs < m && <span class="badge good">−{formatTime(m - r.timeMs)}</span>}
                {r.pb && <span class="badge gold">PB</span>}
                {r.clean && <span class="badge good">Clean</span>}
              </span>
            </div>
          )
        })}
      </div>

      {mood === 'ask' ? (
        <div class="done-mood">
          <MoodTap
            compact
            prompt="How do you feel now?"
            onPick={(v) => {
              void saveMood({ kind: 'break', ref: s.id, when: 'after', v })
              setMood('thanks')
            }}
            onSkip={() => setMood('skipped')}
          />
        </div>
      ) : (
        <>
          {mood === 'thanks' && <p class="done-thanks">Thanks, noted.</p>}
          {/* after a check-in keep only the data-backed line, so the screen still fits */}
          {(mood === 'skipped' || quicker) && <p class="honest">{quicker ?? msg}</p>}
        </>
      )}

      <p class="muted done-next">
        Next break from {nextAt}
        {dailyWaiting && " · Today's daily puzzle is still waiting"}
      </p>

      <button class="btn" onClick={() => go('home')}>
        Back to home
      </button>
      <button class="link-btn" onClick={() => go('stats')}>
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

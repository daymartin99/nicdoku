import { useEffect, useMemo, useState } from 'preact/hooks'
import { win, game } from '../state/game'
import { progress } from '../state/progress'
import { theme, pieceArt, resolved } from '../state/theme'
import { nextPuzzle, loading } from '../flow'
import { formatTime } from '../stats/metrics'
import { SESSION_SIZE } from '../config'
import { Piece } from './Piece'

const CONFETTI = ['#8E7BDB', '#F7A05E', '#8DD67E', '#F5A2DE', '#A8C8E6', '#FFC53D']

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

export function WinOverlay() {
  const w = win.value!
  const g = game.value
  const s = progress.value.session
  const words = theme.value.winWords.length ? theme.value.winWords : ['Brilliant!']
  const word = useMemo(() => words[Math.floor(Math.random() * words.length)], [w])
  const score = useCountUp(w.score)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // tiny delay stops an accidental double-tap skipping the moment
    const id = setTimeout(() => setReady(true), 450)
    return () => clearTimeout(id)
  }, [])

  let line: string
  if (w.pb) line = 'New personal best!'
  else if (w.fasterPct !== null && w.fasterPct >= 50) line = `Faster than ${w.fasterPct}% of your ${g?.puzzle.n}×${g?.puzzle.n} solves`
  else if (w.clean) line = 'A clean solve: no mistakes, no hints'
  else line = 'Solved. Nice work.'

  const inSession = w.mode === 'session' && s && !s.finishedAt
  const doneCount = s?.results.length ?? 0
  const last = inSession && doneCount >= SESSION_SIZE
  const cta = !inSession ? 'Done' : last ? 'Finish break' : `Next puzzle`

  return (
    <div class="win-overlay" role="dialog" aria-label="Puzzle solved">
      <div class="rays" />
      <div class="confetti" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              animationDelay: `${(i % 7) * 0.08}s`,
              transform: `rotate(${i * 29}deg)`,
            }}
          />
        ))}
      </div>
      <div class="win-content">
        <h2 class="win-word">{word}</h2>
        <div class="win-piece">
          <Piece art={pieceArt.value} />
        </div>
        {resolved.value.isBigDay && theme.value.tagline && <p class="win-tagline">{theme.value.tagline}</p>}
        <div class="win-stats">
          <div>
            <span class="label">Time</span>
            <b>{formatTime(w.timeMs)}</b>
          </div>
          <div>
            <span class="label">Score</span>
            <b>+{score.toLocaleString('en-GB')}</b>
          </div>
          <div>
            <span class="label">Mistakes</span>
            <b>{g?.mistakes ?? 0}</b>
          </div>
        </div>
        <p class={`win-line${w.pb ? ' pb' : ''}`}>{line}</p>
        {inSession && (
          <div class="session-dots big" aria-label={`${doneCount} of ${SESSION_SIZE} done`}>
            {Array.from({ length: SESSION_SIZE }, (_, i) => (
              <span key={i} class={i < doneCount ? 'd done' : 'd'} />
            ))}
          </div>
        )}
        <button class="btn win-btn" disabled={!ready || loading.value} onClick={() => nextPuzzle()}>
          {loading.value ? 'Shuffling…' : cta}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { LIVES } from '../config'
import { game, elapsed, solvedRegions } from '../state/game'
import { progress } from '../state/progress'
import { settings, updateSettings } from '../state/settings'
import { theme, pieceArt } from '../state/theme'
import { formatTime } from '../stats/metrics'
import { BackIcon, GearIcon, CloseIcon } from './Icons'
import { Piece } from './Piece'
import { assignColours } from '../engine/colours'
import { boardMode, livePalette, powerPiece } from '../power/palette'

export function Header({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
  const g = game.value!
  const pr = progress.value
  const label = g.mode === 'daily' ? 'Daily' : g.mode === 'extra' ? 'Bonus' : g.mode === 'replay' ? 'Replay' : 'Level'
  const value = g.mode === 'daily' ? '★' : g.mode === 'extra' ? '+1' : g.mode === 'replay' ? '↺' : String(g.level)
  return (
    <div class="topbar game-top">
      <button class="round-btn" onClick={onBack} aria-label="Back">
        <BackIcon />
      </button>
      <div class="hud-stat">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div class="hud-stat">
        <span>Score</span>
        <b class="score-num">{pr.totalScore.toLocaleString('en-GB')}</b>
      </div>
      <button class="round-btn" onClick={onSettings} aria-label="Settings">
        <GearIcon />
      </button>
    </div>
  )
}

/** One piece per colour: silhouette until that colour is solved. */
/** `right` replaces the lives pill (Power Hour shows its combo there). */
export function Tracker({ right }: { right?: ComponentChildren } = {}) {
  const g = game.value!
  const palette = livePalette(g.mode === 'power', theme.value.palette)
  const solved = solvedRegions.value
  const n = g.puzzle.n
  const colourOf = assignColours(n, g.puzzle.regions, palette)
  return (
    <div class="tracker-row">
      <div class="pill tracker" style={{ '--count': n } as never}>
        {Array.from({ length: n }, (_, r) => (
          <span
            key={r}
            class={`trk${solved.has(r) ? ' on' : ''}`}
            style={{ '--c': palette[colourOf[r]] } as never}
          >
            {solved.has(r) && <Piece art={powerPiece(g.mode === 'power' ? boardMode.value : null, pieceArt.value)} />}
          </span>
        ))}
      </div>
      {right ?? (g.lives > 0 ? (
        <div class="pill lives" aria-label={`${g.lives} lives left`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} class={`life${i < g.lives ? '' : ' lost'}`}>
              <Heart />
            </span>
          ))}
        </div>
      ) : (
        // no hearts left: a calm, factual count instead of three grey hearts
        <div class="pill lives" aria-label={`${g.mistakes} slips`}>
          <span class="mistake-count">{g.mistakes} slips</span>
        </div>
      ))}
    </div>
  )
}

const Heart = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      d="M12 20.5s-7.5-4.4-9.3-9.2C1.5 8 3.6 4.5 7 4.5c2 0 3.3 1 5 3 1.7-2 3-3 5-3 3.4 0 5.5 3.5 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2Z"
      fill="currentColor"
      stroke="#7a5548"
      stroke-width="1.6"
    />
  </svg>
)

export function Rules() {
  if (!settings.value.showRules) return null
  return (
    <div class="rules card">
      <button class="rules-x" onClick={() => updateSettings({ showRules: false })} aria-label="Hide rules">
        <CloseIcon size={14} />
      </button>
      <div class="rule">
        <MiniGrid kind="colour" />
        <span>1 per colour</span>
      </div>
      <div class="rule">
        <MiniGrid kind="line" />
        <span>1 per row &amp; column</span>
      </div>
      <div class="rule">
        <MiniGrid kind="touch" />
        <span>Can't touch</span>
      </div>
    </div>
  )
}

function MiniGrid({ kind }: { kind: 'colour' | 'line' | 'touch' }) {
  // 3×3: p = piece, x = cross, . = blank
  const layouts = {
    colour: 'xxxxp.x..',
    line: 'xpx.x..x.',
    touch: 'xxxxpxxxx',
  }
  const tint = { colour: [0, 1, 2, 3, 4, 7, 6], line: [], touch: [] } as Record<string, number[]>
  return (
    <span class="mini">
      {layouts[kind].split('').map((ch, i) => (
        <span key={i} class={`mc${tint[kind].includes(i) ? ' t' : ''}`}>
          {ch === 'x' ? '×' : ch === 'p' ? '●' : ''}
        </span>
      ))}
    </span>
  )
}

export function Timer() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const g = game.value
  if (!g || !settings.value.showTimer) return null
  return <span class="timer">{formatTime(elapsed(g))}</span>
}

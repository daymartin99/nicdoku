import { useEffect, useRef, useState } from 'preact/hooks'
import { power, powerPhase, powerElapsed, powerNow, burst, endPower } from './state'
import { POWER_MS, STAGES, stageAt, orientationAt, nextSpin, bpmAt, comboMultiplier } from './timeline'
import { spin, resetSpin } from './spin'
import { startPowerSound, stopPowerSound, whoosh, finalHit } from './sound'
import { go } from '../router'
import { BackIcon } from '../components/Icons'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Keeps the board orientation, sound and end sequence in step with the clock. Renders nothing. */
export function PowerDriver() {
  const lastSpinAt = useRef<number>(-1)
  const r = power.value
  const ms = powerElapsed(r, powerNow.value)

  useEffect(() => {
    if (r?.sound && !r.endedAt) startPowerSound(() => powerElapsed())
    return () => stopPowerSound()
  }, [r?.id, r?.sound, !!r?.endedAt])

  useEffect(() => () => resetSpin(), [])

  // orientation follows the schedule; a spin that happens while she watches gets a whoosh and,
  // for rock/wobble, a short pulse animation. Reopening mid-hour just restores the orientation.
  const o = orientationAt(ms)
  const lastAt = o.last?.at ?? 0
  useEffect(() => {
    const live = lastSpinAt.current !== -1 && lastAt !== lastSpinAt.current
    lastSpinAt.current = lastAt
    const kind = o.last?.kind
    spin.value = {
      deg: o.deg,
      mirror: o.mirror,
      // every live spin gets a pulse: rock/wobble animate, turns shrink mid-way so corners stay on screen
      pulse: live && kind ? { kind, t: Date.now() } : null,
    }
    if (live && r?.sound) whoosh()
  }, [lastAt])

  // end sequence: TIME. slam → breathe → results
  const phase = powerPhase.value
  useEffect(() => {
    if (phase === 'time') {
      if (r?.sound) finalHit()
      stopPowerSound()
      const id = setTimeout(() => (powerPhase.value = 'breathe'), 2600)
      return () => clearTimeout(id)
    }
  }, [phase])
  return null
}

export function PowerHeader() {
  const r = power.value
  const ms = powerElapsed(r, powerNow.value)
  const left = POWER_MS - ms
  const st = stageAt(ms)
  const frac = ms / POWER_MS
  const R = 25, C = 2 * Math.PI * R
  const onBack = () => {
    if (confirm('End Power Hour now? It counts as today\'s, and everything rests until tomorrow.')) void endPower('early')
  }
  return (
    <div class="topbar game-top power-top">
      <button class="round-btn" onClick={onBack} aria-label="End Power Hour">
        <BackIcon />
      </button>
      <div class="power-clock" role="timer" aria-label={`${fmt(left)} left in Power Hour`}>
        <svg viewBox="0 0 60 60" class="clock-ring" aria-hidden="true">
          <circle cx="30" cy="30" r={R} class="ring-bg" />
          <circle cx="30" cy="30" r={R} class="ring-fg" stroke-dasharray={C} stroke-dashoffset={C * frac} />
        </svg>
        <div class="clock-text">
          <b>{fmt(left)}</b>
          <span>{st.name}</span>
        </div>
      </div>
      <div class="power-score">
        <span>Score</span>
        <b>{(r?.score ?? 0).toLocaleString('en-GB')}</b>
      </div>
    </div>
  )
}

export function ComboPill() {
  const r = power.value
  const combo = r?.combo ?? 0
  const mult = comboMultiplier(combo)
  return (
    <div class={`pill combo-pill${combo >= 2 ? ' hot' : ''}`} aria-label={`${combo} clean in a row`}>
      <span class="combo-x">×{mult.toFixed(1)}</span>
      <span class="combo-n">{combo} in a row</span>
    </div>
  )
}

export function StageBar() {
  const ms = powerElapsed(power.value, powerNow.value)
  const next = nextSpin(ms)
  const toSpin = next ? next.at - ms : Infinity
  return (
    <div class="stage-bar">
      <div class="stage-track">
        {STAGES.map((s) => {
          const f = Math.max(0, Math.min(1, (ms - s.from) / (s.to - s.from)))
          return (
            <span key={s.id} class={`stage-seg stage-seg-${s.id}`} style={{ flex: s.to - s.from }}>
              <i style={{ width: `${f * 100}%` }} />
            </span>
          )
        })}
      </div>
      {toSpin < 15_000 && <span class="spin-warn">spin in {Math.ceil(toSpin / 1000)}</span>}
    </div>
  )
}

export function Burst() {
  const b = burst.value
  const [, force] = useState(0)
  useEffect(() => {
    if (!b) return
    const id = setTimeout(() => force((x) => x + 1), 1200)
    return () => clearTimeout(id)
  }, [b?.t])
  if (!b || Date.now() - b.t > 1150) return null
  return (
    <div key={b.t} class={`burst${b.boss ? ' boss' : ''}`} aria-live="polite">
      <b class="burst-word">{b.word}</b>
      <span class="burst-score">
        +{b.score.toLocaleString('en-GB')}
        {b.combo >= 2 && <em> · {b.combo} in a row</em>}
      </span>
    </div>
  )
}

export function TimeSlam() {
  return (
    <div class="time-slam" role="alert">
      <b>TIME.</b>
    </div>
  )
}

/** 30 s of slow breathing to come down from the crescendo. Skippable after 10 s. */
export function Breathe() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setT(Date.now() - t0), 200)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (t >= 30_000) go('power-done')
  }, [t >= 30_000])
  const inPhase = (t % 10_000) < 4_000
  return (
    <div class="breathe" role="dialog" aria-label="Breathe">
      <div class={`breathe-circle${inPhase ? ' in' : ' out'}`} />
      <p class="breathe-word">{inPhase ? 'Breathe in' : 'and out'}</p>
      <p class="breathe-sub">That was the whole hour. Let it settle.</p>
      {t > 10_000 && (
        <button class="link-btn" onClick={() => go('power-done')}>
          Skip
        </button>
      )}
    </div>
  )
}

/** CSS variables that drive the whole screen's intensity. */
export function powerStyle(): Record<string, string | number> {
  const ms = powerElapsed(power.value, powerNow.value)
  const st = stageAt(ms)
  return {
    '--pi': st.intensity.toFixed(3),
    '--beat': `${(60 / bpmAt(ms)).toFixed(3)}s`,
  }
}

export function stageClass(): string {
  return `stage-${stageAt(powerElapsed(power.value, powerNow.value)).stage}`
}

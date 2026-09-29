import { useState } from 'preact/hooks'
import { go } from '../router'
import { startPower, powerDoneToday, lengthsAvailable } from './state'
import { unlockPowerAudio } from './sound'
import { DURATIONS_MIN, STAGES, stageName, type PowerMode } from './timeline'
import { powerMinutesLeft } from '../state/progress'
import { loading } from '../flow'
import { lsGet, lsSet } from '../db'
import { Toggle } from '../components/Toggle'
import { MoodTap } from '../components/MoodTap'
import { BackIcon } from '../components/Icons'
import { isNative, native } from '../native/bridge'
import './power.css'

const MODES: PowerMode[] = ['calm', 'normal', 'wild']

const MODE_COPY: Record<PowerMode, { title: string; lead: string }> = {
  calm: {
    title: 'Calm',
    lead: 'Gentle and steady. Easier puzzles, soft colours, a slow heartbeat and no spins. Good for off days.',
  },
  normal: {
    title: 'Normal',
    lead: 'It starts gentle and builds: harder puzzles, a quicker heartbeat, and the board starts to spin.',
  },
  wild: {
    title: 'Wild',
    lead: 'System overload. Neon, glitching, spinning and pounding. The board breaks up as it builds.',
  },
}

type Prefs = { minutes: number; mode: PowerMode; sound: boolean }

/** The start ritual: pick a length and an intensity, settle in, know it ends, then go. */
export function PowerIntroScreen() {
  const saved = lsGet<Prefs>('nd:powerPrefs', { minutes: 60, mode: 'normal', sound: true })
  const available = lengthsAvailable()
  const fit = (m: number) => (available.includes(m) ? m : available[available.length - 1] ?? 10)
  const [minutes, setMinutes] = useState(fit(saved.minutes))
  const [mode, setMode] = useState<PowerMode>(saved.mode)
  const [sound, setSound] = useState(saved.sound)
  const [mood, setMood] = useState<number | undefined>(undefined)
  const [asked, setAsked] = useState(false)
  const [starting, setStarting] = useState(false)
  const done = powerDoneToday()
  const left = powerMinutesLeft()

  const start = async () => {
    if (starting || done) return
    setStarting(true)
    lsSet('nd:powerPrefs', { minutes, mode, sound })
    // must happen inside this tap for iOS to allow sound
    const ok = sound && unlockPowerAudio(mode)
    // native app: ask once for Apple Health so the Watch can share heart rate (iOS remembers the answer)
    if (isNative) await native.requestHealth()
    await startPower({ sound: !!ok, moodBefore: mood, minutes, mode })
  }

  const at = (ms: number) => Math.round((ms / 3_600_000) * minutes)
  const copy = MODE_COPY[mode]

  return (
    <div class={`screen power-intro fade-in pi-${mode}`}>
      <div class="topbar">
        <button class="round-btn" onClick={() => go('home')} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Power</h1>
        <span style={{ width: 52 }} />
      </div>

      <div class="card pi-hero">
        <div class="pi-bolt" aria-hidden="true">{mode === 'calm' ? '🌿' : mode === 'wild' ? '⚠' : '⚡'}</div>
        <p class="pi-title" data-text={copy.title}>{copy.title}</p>
        <p class="pi-lead">
          {copy.lead} At {minutes}:00 it stops, wherever you are.
        </p>
        <ul class="pi-stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <i class={`d ${['warm', 'build', 'surge', 'cres'][i]}`} />
              {stageName(s.id, mode)}
              <span>
                {at(s.from)}–{at(s.to)}
                {i === 2 && mode !== 'calm' ? ' · spins' : i === 3 ? ' · boss' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div class="card pi-picks">
        <span class="label">How long?</span>
        <div class="pi-lengths" role="radiogroup" aria-label="Length">
          {DURATIONS_MIN.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={minutes === m}
              class={minutes === m ? 'on' : ''}
              disabled={!available.includes(m)}
              onClick={() => setMinutes(m)}
            >
              {m}
              <small>min</small>
            </button>
          ))}
        </div>
        <p class="pi-note">
          {left < 60 ? `${left} Power minutes left today. ` : ''}
          Afterwards everything rests for {minutes} minutes (or as long as you played, if you stop early)
          {minutes === left ? ', then until tomorrow' : ''}.
        </p>

        <span class="label">How intense?</span>
        <div class="pi-slider">
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={MODES.indexOf(mode)}
            aria-label="Intensity"
            aria-valuetext={copy.title}
            onInput={(e) => setMode(MODES[Number((e.currentTarget as HTMLInputElement).value)])}
          />
          <div class="pi-slider-labels" aria-hidden="true">
            {MODES.map((m) => (
              <button key={m} class={mode === m ? 'on' : ''} onClick={() => setMode(m)} tabIndex={-1}>
                {MODE_COPY[m].title}
              </button>
            ))}
          </div>
        </div>
        {mode === 'wild' && (
          <p class="pi-warn">Wild has glitch effects and fast motion. Skip it if flashing lights ever bother you.</p>
        )}
      </div>

      {!asked && (
        <MoodTap
          compact
          prompt="How are you feeling right now?"
          onPick={(v) => {
            setMood(v)
            setAsked(true)
          }}
          onSkip={() => setAsked(true)}
        />
      )}

      <div class="card pi-sound">
        <Toggle
          label={mode === 'wild' ? 'Bass + glitch sound' : 'Heartbeat sound'}
          note="Builds through the run. Your silent switch still mutes it."
          checked={sound}
          onChange={setSound}
        />
      </div>

      {isNative && (
        <p class="pi-note">Wearing your Apple Watch? It shows the clock, taps before spins and tracks your heart rate.</p>
      )}

      <button class="btn power-go" disabled={done || starting || loading.value} onClick={start}>
        {done ? 'Resting' : starting ? 'Getting ready…' : `Start ${minutes} minutes ${mode === 'calm' ? '🌿' : '⚡'}`}
      </button>
    </div>
  )
}

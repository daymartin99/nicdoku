import { useState } from 'preact/hooks'
import { go } from '../router'
import { startPower, powerDoneToday } from './state'
import { unlockPowerAudio } from './sound'
import { loading } from '../flow'
import { Toggle } from '../components/Toggle'
import { MoodTap } from '../components/MoodTap'
import { BackIcon } from '../components/Icons'
import './power.css'

/** The start ritual: settle in, know it ends, then go. */
export function PowerIntroScreen() {
  const [sound, setSound] = useState(true)
  const [mood, setMood] = useState<number | undefined>(undefined)
  const [asked, setAsked] = useState(false)
  const [starting, setStarting] = useState(false)
  const done = powerDoneToday()

  const start = async () => {
    if (starting) return
    setStarting(true)
    // must happen inside this tap for iOS to allow sound
    const ok = sound && unlockPowerAudio()
    await startPower({ sound: !!ok, moodBefore: mood })
  }

  return (
    <div class="screen power-intro fade-in">
      <div class="topbar">
        <button class="round-btn" onClick={() => go('home')} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Power Hour</h1>
        <span style={{ width: 52 }} />
      </div>

      <div class="card pi-hero">
        <div class="pi-bolt" aria-hidden="true">⚡</div>
        <p class="pi-lead">
          One hour. It starts gentle and builds: harder puzzles, a quicker heartbeat, and the board starts to
          <b> spin</b>. At 60:00 it stops, wherever you are.
        </p>
        <ul class="pi-stages">
          <li><i class="d warm" />Warm up <span>0–15</span></li>
          <li><i class="d build" />Build <span>15–35</span></li>
          <li><i class="d surge" />Surge <span>35–50 · spins</span></li>
          <li><i class="d cres" />Crescendo <span>50–60 · boss</span></li>
        </ul>
      </div>

      <div class="card pi-ready">
        <b>Before you start</b>
        <p>Comfy? Drink nearby? Clean solves in a row build a combo; a slip resets it.</p>
        <p class="pi-rest">When the hour ends, everything rests until tomorrow, breaks included.</p>
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
          label="Heartbeat sound"
          note="Quickens through the hour. Your silent switch still mutes it."
          checked={sound}
          onChange={setSound}
        />
      </div>

      <button class="btn power-go" disabled={done || starting || loading.value} onClick={start}>
        {done ? 'Done for today' : starting ? 'Getting ready…' : 'Start the hour ⚡'}
      </button>
    </div>
  )
}

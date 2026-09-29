import { useState } from 'preact/hooks'
import { go } from '../router'
import { updateSettings, settings } from '../state/settings'
import { setStartLevel } from '../flow'
import { MAKER_NAME } from '../config'
import { pieceArt } from '../state/theme'
import { Piece } from '../components/Piece'

export function OnboardingScreen() {
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState('1')
  const finish = () => {
    const l = parseInt(level, 10)
    setStartLevel(Number.isFinite(l) ? l : 1)
    updateSettings({ onboarded: true })
    go('home')
  }
  return (
    <div class="screen onboarding fade-in">
      {step === 0 && (
        <div class="ob-card">
          <div class="ob-art">
            <Piece art={pieceArt.value} />
          </div>
          <h1>{settings.value.name ? `Hi ${settings.value.name} 👋` : 'Hi 👋'}</h1>
          <p>
            Your own colour puzzle. <b>No ads, ever.</b> No pop-ups, no fake timers, nothing trying to sell you
            anything. Just the game.
          </p>
          <p class="muted">{MAKER_NAME ? `Made by ${MAKER_NAME}, just for you.` : 'Made with care, just for you.'}</p>
          <button class="btn" onClick={() => setStep(1)}>
            Let's go
          </button>
        </div>
      )}
      {step === 1 && (
        <div class="ob-card">
          <h1>Where were you up to?</h1>
          <p>Starting fresh? Keep it at 1. Coming from another puzzle app? Put the level you reached so the puzzles start at the right size.</p>
          <input
            class="level-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={level}
            onInput={(e) => setLevel((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
            aria-label="Starting level"
          />
          <p class="muted small">Brand new? Put 1 and it'll teach you gently.</p>
          <button class="btn" onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}
      {step === 2 && (
        <div class="ob-card">
          <h1>How breaks work</h1>
          <ul class="ob-list">
            <li><b>A break = 5 puzzles</b>, warm-up to a tricky one. About 10 minutes.</li>
            <li><b>Then it rests for an hour</b>, so it stays a break and doesn't turn into a scroll.</li>
            <li><b>The daily puzzle</b> is always there, same one all day.</li>
            <li><b>Every hint is free.</b> Mistakes cost a heart, but you can always finish.</li>
            <li><b>The theme changes</b> with the calendar, birthdays included.</li>
          </ul>
          <button class="btn" onClick={finish}>
            Start playing
          </button>
        </div>
      )}
      <div class="ob-dots">
        {[0, 1, 2].map((i) => <span key={i} class={i === step ? 'on' : ''} />)}
      </div>
    </div>
  )
}

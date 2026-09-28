// Power Hour sound: a soft heartbeat that quickens through the hour, a riser before each spin,
// a whoosh on the spin and one deep hit at "TIME.". All synthesised, no audio files.
// 'ambient' audio session means the iPhone silent switch mutes it.

import { bpmAt, stageAt, nextSpin } from './timeline'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let timer: ReturnType<typeof setInterval> | undefined
let nextBeatAt = 0
let risenFor = -1

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

/** Must be called from a tap (iOS only starts audio after a user gesture). */
export function unlockPowerAudio(): boolean {
  try {
    const nav = navigator as AudioSessionNav
    if (nav.audioSession) nav.audioSession.type = 'ambient'
    ctx ??= new AudioContext()
    void ctx.resume()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = 0.9
      master.connect(ctx.destination)
    }
    return true
  } catch {
    ctx = null
    return false
  }
}

function thump(at: number, freq: number, gain: number) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq * 1.6, at)
  o.frequency.exponentialRampToValueAtTime(freq, at + 0.06)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
  o.connect(g).connect(master)
  o.start(at)
  o.stop(at + 0.25)
}

function noiseSweep(at: number, dur: number, fromHz: number, toHz: number, gain: number) {
  if (!ctx || !master) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 2.5
  bp.frequency.setValueAtTime(fromHz, at)
  bp.frequency.exponentialRampToValueAtTime(toHz, at + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.85)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(bp).connect(g).connect(master)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/** Start the scheduler. `elapsed` returns ms into the hour (already scaled). */
export function startPowerSound(elapsed: () => number) {
  if (!ctx) return
  stopPowerSound()
  nextBeatAt = ctx.currentTime + 0.1
  risenFor = -1
  timer = setInterval(() => {
    if (!ctx || document.hidden) return
    const ms = elapsed()
    const { intensity } = stageAt(ms)
    const beat = 60 / bpmAt(ms)
    // schedule a little ahead so timers never cause a stumble
    while (nextBeatAt < ctx.currentTime + 0.25) {
      const g = 0.18 + 0.32 * intensity
      thump(nextBeatAt, 58, g) // lub
      thump(nextBeatAt + beat * 0.28, 48, g * 0.7) // dub
      nextBeatAt += beat
    }
    // riser in the 2.5 s before each spin, once per spin
    const n = nextSpin(ms)
    if (n && n.at - ms < 2500 && risenFor !== n.at) {
      risenFor = n.at
      noiseSweep(ctx.currentTime, Math.max(0.4, (n.at - ms) / 1000), 300, 2400, 0.12 + 0.12 * intensity)
    }
  }, 100)
}

export function whoosh() {
  if (!ctx) return
  noiseSweep(ctx.currentTime, 0.45, 2600, 320, 0.2)
}

export function finalHit() {
  if (!ctx) return
  const t = ctx.currentTime
  thump(t, 42, 0.9)
  thump(t + 0.02, 84, 0.35)
  noiseSweep(t, 1.6, 1800, 120, 0.18)
}

export function stopPowerSound() {
  clearInterval(timer)
  timer = undefined
}

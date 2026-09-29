// Power sound: a heartbeat that quickens through the run, a riser before each spin,
// a whoosh on the spin and one deep hit at "TIME.". All synthesised, no audio files.
// Calm is a soft, slow pulse; wild is a pounding filtered bass with hi-hat ticks and glitch blips.
// 'ambient' audio session means the iPhone silent switch mutes it.

import { bpmAt, stageAt, nextSpin, type PowerMode } from './timeline'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let timer: ReturnType<typeof setInterval> | undefined
let nextBeatAt = 0
let beatCount = 0
let risenFor = -1
let soundMode: PowerMode = 'normal'

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

/** Must be called from a tap (iOS only starts audio after a user gesture). */
export function unlockPowerAudio(mode: PowerMode = 'normal'): boolean {
  soundMode = mode
  try {
    const nav = navigator as AudioSessionNav
    if (nav.audioSession) nav.audioSession.type = 'ambient'
    ctx ??= new AudioContext()
    void ctx.resume()
    if (!master) {
      master = ctx.createGain()
      master.connect(ctx.destination)
    }
    master.gain.value = mode === 'calm' ? 0.55 : 0.9
    return true
  } catch {
    ctx = null
    return false
  }
}

function thump(at: number, freq: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq * 1.6, at)
  o.frequency.exponentialRampToValueAtTime(freq, at + 0.06)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + (type === 'sine' ? 0.22 : 0.16))
  if (type !== 'sine') {
    // tame the buzz: a low-pass keeps wild's bass punchy rather than harsh
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    o.connect(lp).connect(g).connect(master)
  } else {
    o.connect(g).connect(master)
  }
  o.start(at)
  o.stop(at + 0.25)
}

function noise(at: number, dur: number, fromHz: number, toHz: number, gain: number, q = 2.5) {
  if (!ctx || !master) return
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(fromHz, at)
  bp.frequency.exponentialRampToValueAtTime(toHz, at + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.01, dur * 0.3) + dur * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(bp).connect(g).connect(master)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/** A short digital chirp (wild mode). */
function blip(at: number, gain: number) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  const f = 900 + Math.random() * 1800
  o.frequency.setValueAtTime(f, at)
  o.frequency.setValueAtTime(f * (Math.random() < 0.5 ? 0.5 : 1.5), at + 0.03)
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
  o.connect(g).connect(master)
  o.start(at)
  o.stop(at + 0.08)
}

/**
 * Start the scheduler. `arc` returns ms on the 60-minute arc; `arcPerRealMs` converts real
 * seconds into arc time (6 for a 10-minute run) so the riser always starts 2.5 real seconds
 * before a spin.
 */
export function startPowerSound(arc: () => number, mode: PowerMode, arcPerRealMs: number) {
  if (!ctx) return
  stopPowerSound()
  soundMode = mode
  nextBeatAt = ctx.currentTime + 0.1
  beatCount = 0
  risenFor = -1
  timer = setInterval(() => {
    if (!ctx || document.hidden) return
    const ms = arc()
    const { intensity } = stageAt(ms, mode)
    const beat = 60 / bpmAt(ms, mode)
    // schedule a little ahead so timers never cause a stumble
    while (nextBeatAt < ctx.currentTime + 0.25) {
      if (mode === 'calm') {
        thump(nextBeatAt, 52, 0.12 + 0.08 * intensity)
      } else if (mode === 'wild') {
        const g = 0.22 + 0.3 * intensity
        thump(nextBeatAt, 46, g, 'sawtooth')
        thump(nextBeatAt + beat * 0.5, 46, g * 0.55, 'sawtooth')
        // off-beat hi-hat ticks, doubling up as it builds
        noise(nextBeatAt + beat * 0.25, 0.04, 7000, 9000, 0.05 + 0.08 * intensity, 6)
        if (intensity > 0.4) noise(nextBeatAt + beat * 0.75, 0.04, 7000, 9000, 0.05 + 0.08 * intensity, 6)
        if (Math.random() < 0.12 + 0.3 * intensity) blip(nextBeatAt + beat * (0.3 + Math.random() * 0.4), 0.04)
      } else {
        const g = 0.18 + 0.32 * intensity
        thump(nextBeatAt, 58, g) // lub
        thump(nextBeatAt + beat * 0.28, 48, g * 0.7) // dub
      }
      nextBeatAt += beat
      beatCount++
    }
    // riser in the 2.5 real seconds before each spin, once per spin
    const n = nextSpin(ms, mode)
    const lead = 2500 * arcPerRealMs
    if (n && n.at - ms < lead && risenFor !== n.at) {
      risenFor = n.at
      const dur = Math.max(0.4, (n.at - ms) / arcPerRealMs / 1000)
      noise(ctx.currentTime, dur, 300, mode === 'wild' ? 5200 : 2400, 0.12 + 0.12 * intensity)
    }
  }, 100)
}

export function whoosh() {
  if (!ctx) return
  noise(ctx.currentTime, 0.45, 2600, 320, 0.2)
  if (soundMode === 'wild') {
    for (let i = 0; i < 4; i++) blip(ctx.currentTime + 0.05 + i * 0.06, 0.05)
  }
}

/** A glitch sting for a solve in wild mode. */
export function glitchSting() {
  if (!ctx || soundMode !== 'wild') return
  for (let i = 0; i < 6; i++) blip(ctx.currentTime + i * 0.035, 0.05)
}

export function finalHit() {
  if (!ctx) return
  const t = ctx.currentTime
  if (soundMode === 'calm') {
    thump(t, 60, 0.3)
    noise(t, 2.2, 900, 160, 0.06)
    return
  }
  thump(t, 42, 0.9)
  thump(t + 0.02, 84, 0.35)
  noise(t, 1.6, 1800, 120, 0.18)
  if (soundMode === 'wild') for (let i = 0; i < 10; i++) blip(t + 0.1 + i * 0.05, 0.05)
}

export function stopPowerSound() {
  clearInterval(timer)
  timer = undefined
  void beatCount
}

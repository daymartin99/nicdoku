// Soft sounds (off by default) and haptics where supported (not on iPhone web apps).
import { settings } from './state/settings'

let ctx: AudioContext | null = null

/** iOS only allows audio after a user gesture: call from the first tap. */
export function unlockAudio() {
  if (ctx || !settings.value.sound) return
  try {
    ctx = new AudioContext()
    ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, delay = 0) {
  if (!settings.value.sound) return
  unlockAudio()
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function buzz(ms: number | number[]) {
  if (!settings.value.haptics) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}

export function feedback(kind: 'tap' | 'place' | 'wrong' | 'win') {
  switch (kind) {
    case 'tap':
      tone(520, 0.05, 'triangle', 0.03)
      buzz(5)
      break
    case 'place':
      tone(660, 0.09, 'sine')
      tone(990, 0.12, 'sine', 0.05, 0.06)
      buzz(12)
      break
    case 'wrong':
      tone(180, 0.18, 'square', 0.04)
      buzz([30, 40, 30])
      break
    case 'win':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.06, i * 0.09))
      buzz([20, 30, 20, 30, 40])
      break
  }
}

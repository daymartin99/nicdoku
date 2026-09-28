import { useEffect, useState } from 'preact/hooks'
import { power, powerHistory, setPowerMoodAfter, leavePowerDone, type PowerRun } from './state'
import { POWER_MS } from './timeline'
import { MoodTap } from '../components/MoodTap'
import { BarChart, LineChart } from '../components/charts'
import type { HrSample } from '../native/bridge'
import { formatTime } from '../stats/metrics'
import './power.css'

const BLOCK = 5 * 60_000
/** bar colour per 5-min block, matching the stages: warm, build, surge, crescendo */
const STAGE_COLOURS = [...Array(3).fill('#8dd67e'), ...Array(4).fill('#f7a05e'), ...Array(3).fill('#f0507a'), ...Array(2).fill('#9b7be0')]

function blocks(r: PowerRun) {
  const out = Array.from({ length: 12 }, () => 0)
  for (const s of r.solves) out[Math.min(11, Math.floor(s.at / BLOCK))]++
  return out
}

/** Minute-by-minute median heart rate, plus resting / peak / end summaries. */
function heartSummary(hr: HrSample[]) {
  const mins = new Map<number, number[]>()
  for (const s of hr) {
    const m = Math.floor(s.t / 60_000)
    mins.set(m, [...(mins.get(m) ?? []), s.bpm])
  }
  const med = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y)
    return a[Math.floor(a.length / 2)]
  }
  const last = Math.max(...mins.keys())
  const series = Array.from({ length: last + 1 }, (_, m) => (mins.has(m) ? med(mins.get(m)!) : null))
  const real = series.map((v, m) => ({ v, m })).filter((x): x is { v: number; m: number } => x.v !== null)
  const peak = real.reduce((a, b) => (b.v > a.v ? b : a), real[0])
  const start = med(real.slice(0, 3).map((x) => x.v))
  const end = med(real.slice(-2).map((x) => x.v))
  return { series, peak, start, end }
}

function endLine(r: PowerRun) {
  const last = r.solves[r.solves.length - 1]
  if (r.endReason === 'early') return `You called it at ${formatTime((r.endedAt ?? r.startedAt) - r.startedAt)}. That counts.`
  if (r.bossDone) return last?.boss ? 'You beat the boss right at the end.' : 'Boss beaten, and you kept going to the bell.'
  return 'The bell went mid-puzzle: right in the thick of it.'
}

/** Results after the crescendo: what she did, the peak and the end, then rest until tomorrow. */
export function PowerDoneScreen() {
  const r = power.value
  const [prev, setPrev] = useState<PowerRun | null>(null)
  const [mood, setMood] = useState<number | undefined>(r?.moodAfter)
  useEffect(() => {
    powerHistory()
      .then((list) => {
        const older = list.filter((x) => x.id !== r?.id && x.endedAt).sort((a, b) => b.startedAt - a.startedAt)
        setPrev(older[0] ?? null)
      })
      .catch(() => {})
  }, [r?.id])
  if (!r) {
    leavePowerDone()
    return null
  }

  const b = blocks(r)
  const n = r.solves.length
  const clean = r.solves.filter((s) => s.clean).length
  const up = prev && n > prev.solves.length ? n - prev.solves.length : 0
  const scoreUp = prev && r.score > prev.score
  const minutes = Math.round(((r.endedAt ?? r.startedAt) - r.startedAt) / 60_000)

  return (
    <div class="screen power-done fade-in">
      <div class="pd-hero">
        <div class="pd-bolt" aria-hidden="true">⚡</div>
        <h1>Power Hour done</h1>
        <p class="muted">{r.endReason === 'early' ? `${minutes} minutes` : 'The full hour'} · rest until tomorrow</p>
      </div>

      <div class="card pd-stats">
        <div>
          <span class="label">Puzzles</span>
          <b class="big-num">{n}</b>
          {up > 0 && <span class="badge good">+{up} vs last</span>}
        </div>
        <div>
          <span class="label">Score</span>
          <b class="big-num">{r.score.toLocaleString('en-GB')}</b>
          {scoreUp && <span class="badge gold">Up on last</span>}
        </div>
        <div>
          <span class="label">Top combo</span>
          <b class="big-num">{r.bestCombo}</b>
        </div>
      </div>

      <div class="card">
        <span class="label">Your crescendo (puzzles per 5 min)</span>
        <BarChart
          data={b.map((v, i) => ({ label: `${i * 5}–${i * 5 + 5} min`, value: v, tick: i % 3 === 0 ? `${i * 5}` : undefined }))}
          format={(v: number) => `${v} puzzle${v === 1 ? '' : 's'}`}
          ariaLabel="Puzzles solved in each 5-minute block of the hour"
          colors={STAGE_COLOURS}
        />
      </div>

      {r.hr && r.hr.length >= 5 && (() => {
        const h = heartSummary(r.hr!)
        return (
          <div class="card pd-heart">
            <span class="label">Your heart through the hour (Apple Watch)</span>
            <LineChart
              points={h.series.map((v, m) => ({ label: `${m} min`, value: v, highlight: m === h.peak.m }))}
              format={(v: number) => `${Math.round(v)} bpm`}
              ariaLabel="Heart rate each minute of the hour"
              axisNote="bpm"
            />
            <p>
              Started around <b>{h.start}</b>, peaked at <b>{h.peak.v}</b> ({h.peak.m} min in), finished at <b>{h.end}</b> bpm.
            </p>
            <p class="muted small">
              Sitting and concentrating usually nudges heart rate only a little, so this is simply your own pattern, not a score.
            </p>
          </div>
        )
      })()}

      <div class="card pd-peak">
        <b>Peak and end</b>
        <p>
          {r.bestCombo >= 2
            ? `Your peak: ${r.bestCombo} clean in a row at ${formatTime(Math.min(r.peakAt, POWER_MS))}.`
            : `${clean} clean solve${clean === 1 ? '' : 's'} this hour.`}{' '}
          {endLine(r)}
        </p>
        <p class="muted small">
          Psychology's peak–end rule: we tend to remember an experience by its most intense moment and how it ended.
        </p>
      </div>

      {mood === undefined ? (
        <MoodTap
          compact
          prompt="How do you feel now?"
          onPick={(v) => {
            setMood(v)
            setPowerMoodAfter(v)
          }}
          onSkip={() => setMood(0)}
        />
      ) : (
        mood > 0 && <p class="muted pd-thanks">Noted. It'll show up in your stats.</p>
      )}

      <button class="btn" onClick={leavePowerDone}>
        See you tomorrow
      </button>
    </div>
  )
}

import { useEffect, useState } from 'preact/hooks'
import { power, powerHistory, setPowerMoodAfter, leavePowerDone, runDuration, runMinutes, runMode, type PowerRun } from './state'
import { progress, restingToday, powerMinutesLeft } from '../state/progress'
import { MoodTap } from '../components/MoodTap'
import { BarChart, LineChart } from '../components/charts'
import type { HrSample } from '../native/bridge'
import { formatTime } from '../stats/metrics'
import './power.css'

/** bar colour per twelfth of the run, matching the stages: warm, build, surge, crescendo */
const STAGE_COLOURS = [...Array(3).fill('#8dd67e'), ...Array(4).fill('#f7a05e'), ...Array(3).fill('#f0507a'), ...Array(2).fill('#9b7be0')]

/** Puzzles solved in each twelfth of the run (5-minute slices of an hour, 50 s of a 10-minute run). */
function blocks(r: PowerRun) {
  const slice = runDuration(r) / 12
  const out = Array.from({ length: 12 }, () => 0)
  for (const s of r.solves) out[Math.min(11, Math.floor(s.at / slice))]++
  return out
}

const MODE_LABEL = { calm: 'Calm', normal: 'Normal', wild: 'Wild' } as const

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

/** "7:30" style minute labels for any run length */
function fmtMin(m: number) {
  const secs = Math.round(m * 60)
  return secs % 60 === 0 ? `${secs / 60}` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Results after the crescendo: what she did, the peak and the end, then rest until tomorrow. */
export function PowerDoneScreen() {
  const r = power.value
  const [prev, setPrev] = useState<PowerRun | null>(null)
  const [mood, setMood] = useState<number | undefined>(r?.moodAfter)
  useEffect(() => {
    powerHistory()
      .then((list) => {
        // compare only with an earlier run of the same length
        const older = list
          .filter((x) => x.id !== r?.id && x.endedAt && (x.durationMs ?? 3_600_000) === (r?.durationMs ?? 3_600_000))
          .sort((a, b) => b.startedAt - a.startedAt)
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
  const chosen = runMinutes(r)
  const mode = runMode(r)
  const sliceMin = chosen / 12
  const restLine = restingToday()
    ? 'rest until tomorrow'
    : `rest until ${new Date(progress.value.powerRestUntil).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`
  const left = powerMinutesLeft()

  return (
    <div class="screen power-done fade-in">
      <div class="pd-hero">
        <div class="pd-bolt" aria-hidden="true">⚡</div>
        <h1>{mode === 'wild' ? 'Run complete' : 'Power run done'}</h1>
        <p class="muted">
          {r.endReason === 'early' ? `${minutes} of ${chosen} minutes` : `The full ${chosen} minutes`} · {MODE_LABEL[mode]} · {restLine}
        </p>
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
        <span class="label">Your crescendo (puzzles per {sliceMin >= 1 ? `${Math.round(sliceMin * 10) / 10} min` : `${Math.round(sliceMin * 60)} s`})</span>
        <BarChart
          data={b.map((v, i) => ({
            label: `${fmtMin(i * sliceMin)}–${fmtMin((i + 1) * sliceMin)}`,
            value: v,
            tick: i % 3 === 0 ? fmtMin(i * sliceMin) : undefined,
          }))}
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
            ? `Your peak: ${r.bestCombo} clean in a row at ${formatTime(Math.min(r.peakAt, runDuration(r)))}.`
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
        {restingToday() ? 'See you tomorrow' : left > 0 ? `Rest now · ${left} min of Power left today` : 'Done'}
      </button>
    </div>
  )
}

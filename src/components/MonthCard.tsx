import { useMemo, useState } from 'preact/hooks'
import type { SolveRecord } from '../db'
import type { PowerRun } from '../power/state'
import { monthSummary, monthsPlayed, monthOf, type MonthSummary } from '../stats/monthly'
import { formatTime } from '../stats/metrics'
import { settings } from '../state/settings'
import { APP_NAME } from '../config'
import './MonthCard.css'

type Cell = { label: string; value: string; hex?: string }

function cells(m: MonthSummary): Cell[] {
  const out: Cell[] = [
    { label: 'Puzzles', value: String(m.puzzles) },
    { label: 'Days played', value: String(m.daysPlayed) },
  ]
  if (m.breaks) out.push({ label: 'Breaks', value: String(m.breaks) })
  if (m.powerRuns) out.push({ label: 'Power runs', value: `${m.powerRuns} · ${m.powerMinutes} min` })
  if (m.fastest) out.push({ label: `Fastest ${m.fastest.n}×${m.fastest.n}`, value: formatTime(m.fastest.timeMs) })
  if (m.bestRun) out.push({ label: `Best run · ${m.bestRun.format}`, value: m.bestRun.score.toLocaleString('en-GB') })
  if (m.pbs) out.push({ label: 'Personal bests', value: String(m.pbs) })
  if (m.cleanPct !== null) out.push({ label: 'Clean solves', value: `${m.cleanPct}%` })
  if (m.dailies) out.push({ label: 'Dailies', value: String(m.dailies) })
  if (m.firstColour) out.push({ label: 'Colour you spot first', value: m.firstColour.name, hex: m.firstColour.hex })
  if (m.comebacks) out.push({ label: 'Comebacks', value: String(m.comebacks) })
  return out.slice(0, 10)
}

function footer(m: MonthSummary): string {
  if (m.vsLastMonth !== null && m.vsLastMonth > 0) return `${m.vsLastMonth} more puzzles than last month`
  return 'Just me against me. No ads, no leaderboards.'
}

async function draw(m: MonthSummary, name: string): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  if (!x) return null
  try {
    await Promise.all([document.fonts.load('700 64px Fredoka'), document.fonts.load('500 32px Fredoka')])
  } catch {
    /* system font is fine */
  }
  const F = (w: number, px: number) => `${w} ${px}px Fredoka, ui-rounded, system-ui, sans-serif`
  const round = (X: number, Y: number, w: number, h: number, r: number) => {
    x.beginPath()
    x.roundRect(X, Y, w, h, r)
  }

  x.fillStyle = '#f7f1ec'
  x.fillRect(0, 0, W, H)
  // soft corner glow
  const g = x.createRadialGradient(W, 0, 40, W, 0, 700)
  g.addColorStop(0, 'rgba(242,146,47,0.28)')
  g.addColorStop(1, 'rgba(242,146,47,0)')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)

  x.fillStyle = '#a88b80'
  x.font = F(500, 34)
  x.fillText(name ? `${name}'s month` : 'My month', 80, 130)
  x.fillStyle = '#5c3d33'
  x.font = F(700, 84)
  x.fillText(m.label, 80, 225)

  const list = cells(m)
  const cols = 2
  const gap = 28
  const cw = (W - 160 - gap) / cols
  const ch = 150
  list.forEach((cell, i) => {
    const cx = 80 + (i % cols) * (cw + gap)
    const cy = 290 + Math.floor(i / cols) * (ch + gap)
    // a lone last tile spans the full width
    const w = i === list.length - 1 && i % cols === 0 ? cw * cols + gap : cw
    x.shadowColor = 'rgba(122,85,72,0.12)'
    x.shadowBlur = 24
    x.shadowOffsetY = 6
    x.fillStyle = '#ffffff'
    round(cx, cy, w, ch, 32)
    x.fill()
    x.shadowColor = 'transparent'
    let tx = cx + 36
    if (cell.hex) {
      x.fillStyle = cell.hex
      round(tx, cy + 78, 44, 44, 12)
      x.fill()
      tx += 60
    }
    x.fillStyle = '#a88b80'
    x.font = F(500, 28)
    x.fillText(cell.label, cx + 36, cy + 54, w - 72)
    x.fillStyle = '#5c3d33'
    x.font = F(700, 50)
    x.fillText(cell.value, tx, cy + 118, w - (tx - cx) - 30)
  })

  x.fillStyle = '#7a5548'
  x.font = F(500, 34)
  x.textAlign = 'center'
  x.fillText(footer(m), W / 2, H - 120, W - 160)
  x.fillStyle = '#f2922f'
  x.font = F(700, 30)
  x.fillText(APP_NAME, W / 2, H - 66)

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

/** Stats: this month at a glance, and a picture of it she can share if she likes. */
export function MonthCard({ solves, runs, today }: { solves: SolveRecord[]; runs: PowerRun[]; today: string }) {
  const months = useMemo(() => {
    const list = monthsPlayed(solves, runs)
    const cur = monthOf(today)
    return (list.includes(cur) ? list : [cur, ...list]).slice(0, 3)
  }, [solves, runs, today])
  const [month, setMonth] = useState(months[0])
  const m = useMemo(() => monthSummary(solves, runs, month), [solves, runs, month])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const share = async () => {
    setBusy(true)
    setMsg('')
    try {
      const blob = await draw(m, settings.value.name)
      if (!blob) throw new Error('no canvas')
      const file = new File([blob], `${APP_NAME.toLowerCase()}-${m.month}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${m.label}` }).catch(() => {})
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        setMsg('Saved to your downloads')
      }
    } catch {
      setMsg("Couldn't make the picture this time")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="card month-card">
      <div class="chart-caption">
        <h3>Your month</h3>
        {months.length > 1 && (
          <div class="mc-months" role="tablist">
            {months.map((mo) => (
              <button key={mo} role="tab" aria-selected={mo === month} onClick={() => setMonth(mo)}>
                {new Date(mo + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short' })}
              </button>
            ))}
          </div>
        )}
      </div>
      {m.puzzles ? (
        <>
          <div class="mc-grid">
            {cells(m).map((c) => (
              <div key={c.label} class="mc-cell">
                <span class="label">{c.label}</span>
                <b>
                  {c.hex && <i class="mc-swatch" style={{ background: c.hex }} />}
                  {c.value}
                </b>
              </div>
            ))}
          </div>
          <p class="label mc-foot">{footer(m)}</p>
          <button class="btn mc-share" disabled={busy} onClick={() => void share()}>
            {busy ? 'Making it…' : 'Share as a picture'}
          </button>
          {msg && <p class="label mc-msg" role="status">{msg}</p>}
        </>
      ) : (
        <p class="label">Nothing yet this month. It'll fill in as you play.</p>
      )}
    </div>
  )
}

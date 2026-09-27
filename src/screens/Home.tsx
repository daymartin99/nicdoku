import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { game } from '../state/game'
import { progress, inCooldown } from '../state/progress'
import { settings } from '../state/settings'
import { resolved, theme, pieceArt } from '../state/theme'
import { startBreak, startDaily, startExtra, continueGame, loading, warmUp } from '../flow'
import { allSolves, localDay, type SolveRecord } from '../db'
import { headline, streak, formatTime } from '../stats/metrics'
import { JUST_ONE_MORE, SESSION_SIZE } from '../config'
import { Piece } from '../components/Piece'
import { ChartIcon, CalendarIcon, GearIcon } from '../components/Icons'

function greeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
  return `${part}, ${name}`
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function HomeScreen() {
  const [solves, setSolves] = useState<SolveRecord[] | null>(null)
  const [factOpen, setFactOpen] = useState(false)
  const now = useNow()
  useEffect(() => {
    allSolves().then(setSolves).catch(() => setSolves([]))
    warmUp()
  }, [])

  const pr = progress.value
  const r = resolved.value
  const t = theme.value
  const g = game.value
  const today = localDay()
  const cooling = inCooldown(now)
  const sessionOpen = pr.session && !pr.session.finishedAt
  const dailyDone = pr.daily?.day === today
  const st = solves ? streak(solves, today) : null
  const head = solves ? headline(solves, today) : ''
  const left = Math.max(0, pr.cooldownUntil - now)
  const mins = Math.floor(left / 60000), secs = Math.floor((left % 60000) / 1000)

  return (
    <div class="screen home">
      <div class="topbar">
        <div class="home-hello">
          <h1>{greeting(settings.value.name)}</h1>
          <span class="muted">Level {pr.level} · {pr.totalScore.toLocaleString('en-GB')} pts</span>
        </div>
        <button class="round-btn" onClick={() => go('settings')} aria-label="Settings">
          <GearIcon />
        </button>
      </div>

      <div class={`theme-card card${r.isBigDay ? ' big-day' : ''}`} onClick={() => go('themes')}>
        <div class="theme-art">
          <Piece art={pieceArt.value} />
        </div>
        <div class="theme-text">
          <span class="label">Today's theme</span>
          <b>{t.name}</b>
          {t.tagline && <span class="tagline">{t.tagline}</span>}
          {r.countdowns.map((c) => (
            <span key={c} class="countdown">{c}</span>
          ))}
        </div>
        <div class="theme-swatches" aria-hidden="true">
          {t.palette.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}
        </div>
      </div>

      {t.fact && (
        <div class="card fact-card" onClick={() => setFactOpen(!factOpen)}>
          <div class="fact-head">
            <span class="label">Did you know?</span>
            <b>{t.fact.title}</b>
          </div>
          {factOpen && (
            <div class="fact-body fade-in">
              <p>{t.fact.body}</p>
              {t.fact.link && (
                <a href={t.fact.link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {t.fact.link.label} ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {g && !g.done ? (
        <button class="btn main-cta" onClick={continueGame}>
          Continue puzzle
        </button>
      ) : cooling && !sessionOpen ? (
        <div class="card cooldown-card">
          <span class="label">Break done ✓</span>
          <b class="big-num">
            {mins}:{String(secs).padStart(2, '0')}
          </b>
          <span class="muted">until your next break unlocks</span>
          {pr.extrasUsed < JUST_ONE_MORE && (
            <button class="btn secondary small" disabled={loading.value} onClick={startExtra}>
              Just one more (not counted)
            </button>
          )}
        </div>
      ) : (
        <button class="btn main-cta" disabled={loading.value} onClick={startBreak}>
          {loading.value ? 'Shuffling…' : sessionOpen ? pr.session!.index >= SESSION_SIZE ? 'See your break summary' : `Resume break · ${pr.session!.index + 1} of ${SESSION_SIZE}` : 'Start a break'}
          <small>{sessionOpen ? '' : `${SESSION_SIZE} puzzles · about 10 min`}</small>
        </button>
      )}

      <button class={`card daily-card${dailyDone ? ' done' : ''}`} disabled={loading.value || dailyDone} onClick={startDaily}>
        <span class="daily-star">★</span>
        <span class="daily-text">
          <b>Daily puzzle</b>
          <span class="muted">{dailyDone ? `Solved in ${formatTime(pr.daily!.timeMs)} ✓` : 'Same puzzle all day · tap to play'}</span>
        </span>
      </button>

      {st && (
        <div class="card streak-card">
          <div>
            <span class="label">This week</span>
            <b class="big-num">{st.activeLast7}<small>/7 days</small></b>
          </div>
          <div class="headline">{head}</div>
        </div>
      )}

      <div class="home-nav">
        <button class="nav-btn" onClick={() => go('stats')}>
          <ChartIcon /> Stats
        </button>
        <button class="nav-btn" onClick={() => go('themes')}>
          <CalendarIcon /> Themes
        </button>
      </div>
    </div>
  )
}

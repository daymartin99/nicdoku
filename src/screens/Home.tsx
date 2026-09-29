import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { game } from '../state/game'
import { progress, inCooldown } from '../state/progress'
import { settings } from '../state/settings'
import { resolved, theme, pieceArt, nextPersonal } from '../state/theme'
import { startBreak, startDaily, startExtra, continueGame, loading, warmUp } from '../flow'
import { allSolves, localDay, lsGet, lsSet, type SolveRecord } from '../db'
import { headline, streak, formatTime } from '../stats/metrics'
import { JUST_ONE_MORE, SESSION_SIZE } from '../config'
import { Piece } from '../components/Piece'
import { InstallHint } from '../components/InstallHint'
import { ChartIcon, CalendarIcon, GearIcon } from '../components/Icons'
import { powerDoneToday, power, runMinutes } from '../power/state'
import { sickToday, setSickToday, restingToday, powerWaiting, powerMinutesLeft } from '../state/progress'
import { MoodTap } from '../components/MoodTap'
import { saveMood, type MoodValue } from '../mood'
import './home.css'
import '../power/power.css'

const CONFETTI = ['#8E7BDB', '#F7A05E', '#8DD67E', '#F5A2DE', '#A8C8E6', '#FFC53D']
const CONFETTI_KEY = 'nd:bigdayConfetti'

function greeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
  return name ? `${part}, ${name}` : `Good ${part.toLowerCase()}`
}

/** Re-renders every `ms`, and once more exactly at `wakeAt` (if it's in the future). */
function useNow(ms: number, wakeAt = 0) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  useEffect(() => {
    const wait = wakeAt - Date.now()
    if (wait <= 0) return
    const id = setTimeout(() => setNow(Date.now()), wait + 50)
    return () => clearTimeout(id)
  }, [wakeAt])
  return now
}

function Tick() {
  return (
    <svg class="tick" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="done" role="img">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** One short burst the first time Home opens on a big day. */
function BigDayConfetti() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const day = localDay()
    if (lsGet<string>(CONFETTI_KEY, '') === day) return
    lsSet(CONFETTI_KEY, day)
    setOn(true)
    const id = setTimeout(() => setOn(false), 1800)
    return () => clearTimeout(id)
  }, [])
  if (!on) return null
  return (
    <div class="confetti home-confetti" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI[i % CONFETTI.length],
            animationDelay: `${(i % 7) * 0.05}s`,
            transform: `rotate(${i * 29}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export function HomeScreen() {
  const [solves, setSolves] = useState<SolveRecord[] | null>(null)
  const [factOpen, setFactOpen] = useState(false)
  const [askMood, setAskMood] = useState(false)
  const pr = progress.value
  const wakeAt = Math.max(pr.cooldownUntil > Date.now() ? pr.cooldownUntil : 0, pr.powerRestUntil > Date.now() ? pr.powerRestUntil : 0)
  const now = useNow(inCooldown() || powerWaiting() ? 30_000 : 60_000, wakeAt)
  useEffect(() => {
    allSolves().then(setSolves).catch(() => setSolves([]))
    warmUp()
  }, [])

  const r = resolved.value
  const t = theme.value
  const g = game.value
  const name = settings.value.name
  const today = localDay()
  const cooling = inCooldown(now)
  const sessionOpen = pr.session && !pr.session.finishedAt
  const dailyDone = pr.daily?.day === today
  const otherGameOpen = !!g && !g.done && g.mode !== 'daily'
  const st = solves && solves.length > 0 ? streak(solves, today) : null
  const head = solves ? headline(solves, today) : ''
  const herBirthday = r.isBigDay && t.id === 'birthday-queen'
  // resting = today's Power minutes are used up, or the rest after a Power run
  const doneForDay = restingToday(today)
  const waiting = powerWaiting(now)
  const resting = doneForDay || waiting
  const powerLeft = powerMinutesLeft(today)
  const canPower = !powerDoneToday(today)
  const backAt = new Date(pr.powerRestUntil).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  const sick = sickToday(today)
  const run = power.value
  const ranToday = run?.day === today && run.endedAt ? run : null

  // a quick, skippable mood tap before a fresh break (not when resuming one)
  const beginBreak = async (v?: MoodValue) => {
    setAskMood(false)
    await startBreak()
    const id = progress.value.session?.id
    if (v && id) void saveMood({ kind: 'break', ref: id, when: 'before', v })
  }
  const onStart = () => (sessionOpen ? void startBreak() : setAskMood(true))
  const nextAt = new Date(pr.cooldownUntil).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })

  return (
    <div class="screen home">
      {r.isBigDay && <BigDayConfetti />}
      <div class="topbar">
        <div class="home-hello">
          <h1 class={r.isBigDay ? 'big-day-h' : undefined}>{r.isBigDay ? t.tagline || `Happy ${t.name}!` : greeting(name)}</h1>
          <span class="muted">Level {pr.level} · {pr.totalScore.toLocaleString('en-GB')} pts</span>
        </div>
        <button class="round-btn" onClick={() => go('settings')} aria-label="Settings">
          <GearIcon />
        </button>
      </div>

      <button
        type="button"
        class={`theme-card card${r.isBigDay ? ' big-day' : ''}`}
        aria-label={`Today's theme: ${t.name}. Change theme`}
        onClick={() => go('themes')}
      >
        <div class="theme-art">
          <Piece art={pieceArt.value} />
        </div>
        <div class="theme-text">
          <span class="label">Today's theme</span>
          <b>{t.name}</b>
          {t.tagline && !r.isBigDay && <span class="tagline">{t.tagline}</span>}
          {!r.isBigDay && r.countdowns.length === 0 && nextPersonal.value && (
            <span class="countdown soon">{nextPersonal.value}</span>
          )}
          {r.countdowns.map((c) => (
            <span key={c} class="countdown">{c}</span>
          ))}
        </div>
      </button>

      <InstallHint />

      {sick && !resting && (
        <div class="card gentle-card" role="status">
          <span class="gentle-emoji" aria-hidden="true">🫖</span>
          <span class="gentle-text">
            <b>Gentle day</b>
            <span class="muted">Shorter rests (20 min) and easier puzzles. Look after yourself.</span>
          </span>
          <button class="link-btn" onClick={() => setSickToday(false)}>Turn off</button>
        </div>
      )}

      {resting ? (
        <div class="card rest-card">
          <span class="rest-bolt" aria-hidden="true">⚡</span>
          <b>{doneForDay ? `All done for today, ${name}` : `Resting after your ${runMinutes(ranToday)}-minute run`}</b>
          <span class="muted">
            {ranToday
              ? `Power: ${ranToday.solves.length} puzzle${ranToday.solves.length === 1 ? '' : 's'}, ${ranToday.score.toLocaleString('en-GB')} points. `
              : ''}
            {doneForDay ? "Everything's resting until tomorrow." : `Everything's resting until ${backAt}.`}
          </span>
          {!doneForDay && powerLeft > 0 && (
            <span class="rest-left">{powerLeft} Power minutes left today</span>
          )}
          <button class="link-btn" onClick={() => go('stats')}>See your Power stats</button>
        </div>
      ) : askMood ? (
        <div class="card mood-card">
          <MoodTap prompt="Quick check: how are you feeling?" onPick={(v) => void beginBreak(v)} onSkip={() => void beginBreak()} />
        </div>
      ) : g && !g.done && g.mode !== 'power' ? (
        <button class="btn main-cta" onClick={continueGame}>
          Continue puzzle
          <small>{g.mode === 'daily' ? 'Daily puzzle' : `Level ${g.level} · ${g.puzzle.n}×${g.puzzle.n}`}</small>
        </button>
      ) : cooling && !sessionOpen ? (
        <div class="card cooldown-card">
          <span class="label">Nice break, {name}. Enjoy the rest of your day.</span>
          <b class="cooldown-time">Next break from {nextAt}</b>
          {pr.extrasUsed < JUST_ONE_MORE && (
            <button class="link-btn" disabled={loading.value} onClick={startExtra}>
              One more, just for fun
            </button>
          )}
        </div>
      ) : (
        <button class="btn main-cta" disabled={loading.value} onClick={onStart}>
          {loading.value
            ? 'Shuffling…'
            : sessionOpen
              ? pr.session!.index >= SESSION_SIZE
                ? 'See your break summary'
                : `Resume break · ${pr.session!.index + 1} of ${SESSION_SIZE}`
              : herBirthday
                ? 'Start a birthday break'
                : 'Start a break'}
          <small>{sessionOpen ? '' : `${SESSION_SIZE} puzzles · about 10 min`}</small>
        </button>
      )}

      {!resting && (
      <button
        class={`card daily-card${dailyDone ? ' done' : ''}`}
        disabled={loading.value || dailyDone || otherGameOpen}
        onClick={startDaily}
      >
        <span class="daily-star">★</span>
        <span class="daily-text">
          <b>Daily puzzle</b>
          <span class="muted">
            {dailyDone ? (
              <>
                Solved in {formatTime(pr.daily!.timeMs)} <Tick />
              </>
            ) : otherGameOpen ? (
              'Finish your puzzle first'
            ) : (
              'Same puzzle all day · tap to play'
            )}
          </span>
        </span>
      </button>
      )}

      {!resting && (
        <button class="card power-card" disabled={loading.value || otherGameOpen || !canPower} onClick={() => go('power-intro')}>
          <span class="power-bolt" aria-hidden="true">⚡</span>
          <span class="daily-text">
            <b>Power</b>
            <span class="muted">
              {otherGameOpen
                ? 'Finish your puzzle first'
                : powerLeft >= 60
                  ? '10, 30, 45 or 60 minutes · calm, normal or wild'
                  : `${powerLeft} minutes left today · calm, normal or wild`}
            </span>
          </span>
        </button>
      )}

      {t.fact && (
        <div class="card fact-card">
          <button type="button" class="fact-head" aria-expanded={factOpen} onClick={() => setFactOpen(!factOpen)}>
            <span class="fact-title">
              <span class="label">Did you know?</span>
              <b>{t.fact.title}</b>
            </span>
            <span class="chev" aria-hidden="true">▾</span>
          </button>
          {factOpen && (
            <div class="fact-body fade-in">
              <p>{t.fact.body}</p>
              {t.fact.link && (
                <a href={t.fact.link.url} target="_blank" rel="noopener noreferrer">
                  {t.fact.link.label} ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {st && st.activeLast7 > 0 && (
        <div class="card streak-card">
          <span class="label">Last 7 days</span>
          <div class="week-dots" role="img" aria-label={`Played on ${st.activeLast7} of the last 7 days`}>
            {st.days.slice(-7).map((d) => (
              <i key={d.day} class={d.played ? 'on' : ''} />
            ))}
          </div>
          {head && <div class="headline">{head}</div>}
        </div>
      )}

      {!sick && !resting && (
        <button class="link-btn gentle-link" onClick={() => setSickToday(true)}>
          Not feeling great today?
        </button>
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

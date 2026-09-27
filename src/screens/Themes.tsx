import { useEffect, useRef, useState } from 'preact/hooks'
import { go } from '../router'
import { settings, updateSettings, type ThemeOverride } from '../state/settings'
import { family, today, resolved, calendarResolved, activeOverrideId, overrideLocked } from '../state/theme'
import { upcoming, allThemes } from '../themes/calendar'
import { localDay } from '../db'
import { Piece } from '../components/Piece'
import { BackIcon } from '../components/Icons'
import './home.css'

function prettyDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

type Toast = { name: string; prev: ThemeOverride | null }

export function ThemesScreen() {
  const list = upcoming(today.value, family.value, 60)
  const override = activeOverrideId.value
  const locked = overrideLocked.value
  const current = resolved.value.theme
  const calendarId = calendarResolved.value.theme.id
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const showToast = (t: Toast | null) => {
    clearTimeout(timer.current)
    setToast(t)
    if (t) timer.current = window.setTimeout(() => setToast(null), 4000)
  }

  const pick = (id: string, name: string) => {
    const prev = settings.value.themeOverride
    // picking the calendar's own theme just means "follow the calendar"
    updateSettings({ themeOverride: id === calendarId ? null : { id, day: localDay(today.value) } })
    showToast({ name, prev })
  }

  const undo = () => {
    if (!toast) return
    updateSettings({ themeOverride: toast.prev })
    showToast(null)
  }

  return (
    <div class="screen themes fade-in">
      <div class="topbar">
        <button class="round-btn" onClick={() => go('home')} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Themes</h1>
        <span style={{ width: 52 }} />
      </div>

      <div class="card">
        <span class="label">Now showing</span>
        <div class="theme-now">
          <span class="theme-art sm"><Piece art={current.piece} /></span>
          <b>{current.name}</b>
        </div>
        {locked && <p class="muted theme-locked">Today is a special day, so its theme stays on.</p>}
        {override && !locked && (
          <button class="btn secondary small" onClick={() => updateSettings({ themeOverride: null })}>
            Follow the calendar again
          </button>
        )}
      </div>

      <h2 class="section-h">Coming up</h2>
      <div class="card upcoming">
        {list.length === 0 && <p class="muted">Nothing special in the next few weeks.</p>}
        {list.map((u) => (
          <div key={u.date + u.title} class="up-row">
            <span class="up-emoji">{u.emoji}</span>
            <span class="up-title">{u.title}</span>
            <span class="up-date muted">{prettyDate(u.date)}</span>
          </div>
        ))}
      </div>

      <h2 class="section-h">Pick one for today</h2>
      <p class="muted theme-pick-note">Tomorrow it goes back to the calendar, so birthdays and holidays still show up.</p>
      <div class="theme-grid">
        {allThemes().map((t) => (
          <button
            key={t.id}
            class={`theme-tile${current.id === t.id ? ' on' : ''}`}
            disabled={locked}
            aria-pressed={current.id === t.id}
            onClick={() => pick(t.id, t.name)}
          >
            {t.id === calendarId && <span class="tt-today">Today</span>}
            <span class="theme-art sm"><Piece art={t.piece} /></span>
            <span class="tt-name">{t.name}</span>
            <span class="tt-sw">
              {t.palette.slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}
            </span>
          </button>
        ))}
      </div>

      {toast && (
        <div class="home-toast fade-in" role="status">
          <span>Now showing: {toast.name}</span>
          <button class="toast-undo" onClick={undo}>Undo</button>
        </div>
      )}
    </div>
  )
}

import { go } from '../router'
import { settings, updateSettings } from '../state/settings'
import { family, today, resolved } from '../state/theme'
import { upcoming, allThemes } from '../themes/calendar'
import { Piece } from '../components/Piece'
import { BackIcon } from '../components/Icons'

function prettyDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function ThemesScreen() {
  const list = upcoming(today.value, family.value, 60)
  const override = settings.value.themeOverride
  const current = resolved.value.theme
  return (
    <div class="screen themes">
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
        {override && (
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

      <h2 class="section-h">Pick one yourself</h2>
      <div class="theme-grid">
        {allThemes().map((t) => (
          <button
            key={t.id}
            class={`theme-tile${override === t.id ? ' on' : ''}`}
            onClick={() => updateSettings({ themeOverride: t.id })}
          >
            <span class="theme-art sm"><Piece art={t.piece} /></span>
            <span class="tt-name">{t.name}</span>
            <span class="tt-sw">
              {t.palette.slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

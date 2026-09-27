// iPhone-only card (in Safari, not yet installed) explaining Add to Home Screen.
import { signal } from '@preact/signals'
import { lsGet, lsSet } from '../db'
import { isIos, isStandalone } from '../pwa'
import { CloseIcon } from './Icons'

const DISMISS_KEY = 'nd:installHintDismissed'
const dismissed = signal<boolean>(lsGet(DISMISS_KEY, false))

/** The iOS share glyph: a box with an arrow coming out of the top. */
export function ShareGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2f7cf6"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-label="Share"
      role="img"
      style={{ verticalAlign: '-4px' }}
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  )
}

function PlusBox() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" aria-hidden="true" style={{ verticalAlign: '-4px' }}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

export function shouldShowInstallHint(): boolean {
  return isIos() && !isStandalone() && !dismissed.value
}

export function InstallHint() {
  if (!shouldShowInstallHint()) return null
  const close = () => {
    dismissed.value = true
    lsSet(DISMISS_KEY, true)
  }
  return (
    <div class="card fade-in" style={{ position: 'relative', paddingRight: '52px' }}>
      <button
        type="button"
        aria-label="Hide this tip"
        onClick={close}
        style={{
          position: 'absolute', top: '4px', right: '4px', width: '44px', height: '44px',
          display: 'grid', placeItems: 'center', color: 'var(--ink-soft)',
        }}
      >
        <CloseIcon size={20} />
      </button>
      <div style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink-strong)', marginBottom: '6px' }}>
        Put Nicdoku on your Home Screen
      </div>
      <div style={{ fontSize: '15px', color: 'var(--ink-soft)', marginBottom: '10px', lineHeight: 1.35 }}>
        It keeps your stats safe and works offline, like a proper app.
      </div>
      <ol style={{ margin: 0, paddingLeft: '22px', display: 'grid', gap: '8px', fontSize: '16px', lineHeight: 1.35 }}>
        <li>
          Tap the Share button <ShareGlyph /> in Safari
          <span class="muted"> (bottom of the screen, or next to the address bar)</span>
        </li>
        <li>
          Scroll down and tap <b>Add to Home Screen</b> <PlusBox />
        </li>
        <li>Tap <b>Add</b>, then open Nicdoku from its new icon</li>
      </ol>
    </div>
  )
}

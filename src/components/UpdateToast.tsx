// Bottom pill shown when a new version is waiting. Only reloads when she taps it.
import { signal } from '@preact/signals'
import { updateReady, applyUpdate } from '../pwa'

/** 'Later' hides the pill for this launch; Settings still offers the update. */
const hidden = signal(false)

export function UpdateToast() {
  if (!updateReady.value || hidden.value) return null
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(var(--safe-bottom) + 16px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
    <div
      role="status"
      class="fade-in"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 4px 4px 18px',
        borderRadius: '999px',
        background: 'var(--ink-strong)',
        color: '#fff',
        boxShadow: 'var(--shadow-lg)',
        fontSize: '16px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span>New version ready</span>
      <span aria-hidden="true" style={{ opacity: 0.6 }}>·</span>
      <button
        type="button"
        onClick={() => void applyUpdate()}
        style={{
          minHeight: '44px',
          padding: '0 16px',
          borderRadius: '999px',
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
      <button
        type="button"
        aria-label="Later"
        onClick={() => (hidden.value = true)}
        style={{ minWidth: '44px', minHeight: '44px', color: '#fff', opacity: 0.7, fontSize: '20px' }}
      >
        ×
      </button>
    </div>
    </div>
  )
}

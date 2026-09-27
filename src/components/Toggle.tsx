// Large iOS-style switch row. The whole row is the tap target (min 56px tall).
import type { ComponentChildren } from 'preact'
import './Toggle.css'

type Props = {
  label: ComponentChildren
  note?: ComponentChildren
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

export function Toggle({ label, note, checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      class="toggle-row"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span class="toggle-text">
        <span class="toggle-label">{label}</span>
        {note && <span class="toggle-note">{note}</span>}
      </span>
      <span class={`toggle-switch${checked ? ' on' : ''}`} aria-hidden="true">
        <span class="toggle-knob" />
      </span>
    </button>
  )
}

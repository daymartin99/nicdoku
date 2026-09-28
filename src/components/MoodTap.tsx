// One-tap mood check-in: five soft, hand-drawn faces from "Rough" to "Great", plus a quiet Skip.
// Pair it with saveMood() from ../mood. No animation beyond a gentle press.

import { useState } from 'preact/hooks'
import { MOOD_LABELS, type MoodValue } from '../mood'
import './MoodTap.css'

export type MoodTapProps = {
  /** e.g. "How do you feel now?" */
  prompt: string
  onPick: (v: MoodValue) => void
  /** shows a small "Skip" text button when given */
  onSkip?: () => void
  /** smaller faces, labels only for screen readers, prompt and Skip on one line */
  compact?: boolean
}

// warm, soft fills: dusty rose → peach → butter → apricot → orange (no alarm red)
const FILL: Record<MoodValue, string> = { 1: '#e8c3b5', 2: '#f2d2b0', 3: '#f7e0a3', 4: '#f8c878', 5: '#f5a85a' }
// mouth curves from a gentle frown to a wide smile
const MOUTH: Record<MoodValue, string> = {
  1: 'M15 33.5c3-3.2 7-4.6 9-4.6s6 1.4 9 4.6',
  2: 'M16 32c2.7-1 5.3-1.4 8-1.4s5.3.4 8 1.4',
  3: 'M16.5 31h15',
  4: 'M16 29.5c2.4 2.6 5.1 3.8 8 3.8s5.6-1.2 8-3.8',
  5: 'M14.5 28.5c2.4 4.6 5.9 6.6 9.5 6.6s7.1-2 9.5-6.6c-6.3 1.2-12.7 1.2-19 0Z',
}

export function MoodFace({ v }: { v: MoodValue }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" class="mood-face">
      <circle cx="24" cy="24" r="21" fill={FILL[v]} />
      {/* a slightly wobbly outline so it feels drawn rather than stamped */}
      <path
        d="M24 3.4c11.6-.3 20.8 9.2 20.6 20.8-.2 11.3-9.4 20.4-20.8 20.4C12.4 44.6 3.3 35.4 3.4 23.9 3.5 12.6 12.7 3.7 24 3.4Z"
        fill="none" stroke="var(--ink-strong)" stroke-width="2" stroke-linejoin="round" opacity="0.55"
      />
      {v === 1 ? (
        <>
          {/* worried brows */}
          <path d="M13.5 18.5l6-2.2M34.5 18.5l-6-2.2" stroke="var(--ink-strong)" stroke-width="2.2" stroke-linecap="round" />
          <circle cx="17.5" cy="22" r="2.1" fill="var(--ink-strong)" />
          <circle cx="30.5" cy="22" r="2.1" fill="var(--ink-strong)" />
        </>
      ) : v === 5 ? (
        <>
          {/* happy closed eyes */}
          <path d="M14 21.5c1.5-2.4 5-2.4 6.5 0M27.5 21.5c1.5-2.4 5-2.4 6.5 0" fill="none" stroke="var(--ink-strong)" stroke-width="2.3" stroke-linecap="round" />
          <circle cx="12.5" cy="27.5" r="2.6" fill="#f08a6a" opacity="0.35" />
          <circle cx="35.5" cy="27.5" r="2.6" fill="#f08a6a" opacity="0.35" />
        </>
      ) : (
        <>
          <circle cx="17.5" cy="21" r="2.2" fill="var(--ink-strong)" />
          <circle cx="30.5" cy="21" r="2.2" fill="var(--ink-strong)" />
          {v === 4 && (
            <>
              <circle cx="12.5" cy="27" r="2.4" fill="#f08a6a" opacity="0.3" />
              <circle cx="35.5" cy="27" r="2.4" fill="#f08a6a" opacity="0.3" />
            </>
          )}
        </>
      )}
      <path
        d={MOUTH[v]}
        fill={v === 5 ? 'var(--ink-strong)' : 'none'}
        stroke="var(--ink-strong)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"
      />
    </svg>
  )
}

const VALUES: MoodValue[] = [1, 2, 3, 4, 5]

export function MoodTap({ prompt, onPick, onSkip, compact }: MoodTapProps) {
  const [picked, setPicked] = useState<MoodValue | null>(null)
  const pick = (v: MoodValue) => {
    if (picked !== null) return
    setPicked(v)
    onPick(v)
  }
  return (
    <div class={`mood-tap${compact ? ' compact' : ''}`} role="group" aria-label={prompt}>
      <div class="mood-head">
        <span class="mood-prompt">{prompt}</span>
        {onSkip && compact && (
          <button class="mood-skip" onClick={onSkip}>Skip</button>
        )}
      </div>
      <div class="mood-faces">
        {VALUES.map((v) => (
          <button
            key={v}
            class="mood-btn"
            aria-label={MOOD_LABELS[v]}
            aria-pressed={picked === v}
            disabled={picked !== null && picked !== v}
            onClick={() => pick(v)}
          >
            <MoodFace v={v} />
            {!compact && <span class="mood-label">{MOOD_LABELS[v]}</span>}
          </button>
        ))}
      </div>
      {onSkip && !compact && (
        <button class="mood-skip" onClick={onSkip}>Skip</button>
      )}
    </div>
  )
}

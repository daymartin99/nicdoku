import { useEffect, useRef, useState } from 'preact/hooks'
import { resetEverything, resetSummary, type ResetSummary } from '../reset'
import { Toggle } from './Toggle'
import './ResetSection.css'

const HOLD_MS = 2000

/** Settings → Start again. Explains what goes, offers a backup, and needs a 2-second hold to wipe. */
export function ResetSection({ onBackup, busy }: { onBackup: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [sum, setSum] = useState<ResetSummary | null>(null)
  const [keepFamily, setKeepFamily] = useState(true)
  const [keepSettings, setKeepSettings] = useState(true)
  const [held, setHeld] = useState(0) // 0..1
  const [wiping, setWiping] = useState(false)
  const raf = useRef(0)
  const start = useRef(0)

  useEffect(() => {
    if (open) resetSummary().then(setSum).catch(() => setSum(null))
  }, [open])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const tick = () => {
    const k = Math.min(1, (performance.now() - start.current) / HOLD_MS)
    setHeld(k)
    if (k >= 1) {
      setWiping(true)
      void resetEverything({ keepFamily, keepSettings })
      return
    }
    raf.current = requestAnimationFrame(tick)
  }
  const down = (e: PointerEvent) => {
    if (wiping) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    start.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }
  const up = () => {
    if (wiping) return
    cancelAnimationFrame(raf.current)
    setHeld(0)
  }

  return (
    <section class="set-group">
      <h2>Start again</h2>
      <div class="card reset-card">
        {!open ? (
          <div class="set-row">
            <div class="grow">
              <div class="title">Play from the very start</div>
              <div class="sub">Back to level 1 with a clean slate. You'll see exactly what goes before anything happens.</div>
            </div>
            <button class="btn small secondary" onClick={() => setOpen(true)}>Start again…</button>
          </div>
        ) : (
          <div class="set-stack reset-open">
            <p class="reset-warn">
              <b>This wipes your progress on this phone.</b> It can't be undone, unless you back up first.
            </p>
            <ul class="reset-list">
              <li>Level {sum?.level ?? '…'} goes back to level 1, and {sum ? sum.score.toLocaleString('en-GB') : '…'} points to 0</li>
              <li>{sum?.solves ?? '…'} solved puzzles and all your graphs</li>
              <li>{sum?.runs ?? '…'} Power runs, every record, and the weekly challenge</li>
              <li>Any puzzle or break in progress</li>
            </ul>

            <button class="btn small" onClick={onBackup} disabled={busy}>Back up first (recommended)</button>

            <div class="reset-keep">
              <Toggle label="Keep family birthdays & photos" checked={keepFamily} onChange={setKeepFamily} />
              <Toggle label="Keep my settings" note="Name, controls, sound and look" checked={keepSettings} onChange={setKeepSettings} />
            </div>

            <button
              class={`reset-hold${held > 0.5 || wiping ? ' past' : ''}`}
              style={{ '--held': held } as never}
              onPointerDown={down}
              onPointerUp={up}
              onPointerCancel={up}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Hold for two seconds to wipe everything and start again"
              disabled={wiping}
            >
              <span class="reset-fill" aria-hidden="true" />
              <span class="reset-text">{wiping ? 'Starting again…' : held > 0 ? 'Keep holding…' : 'Hold to wipe and start again'}</span>
            </button>
            <button class="link-btn" onClick={() => setOpen(false)} disabled={wiping}>
              Cancel, keep everything
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

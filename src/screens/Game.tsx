import { useEffect, useRef, useState } from 'preact/hooks'
import { go } from '../router'
import {
  game, win, activeHint, status, flash, showHint, applyHint, revealPiece, tidyUp, undo, togglePencil, applyDrafts,
  resetBoard, resumeClock, pauseClock,
} from '../state/game'
import { progress } from '../state/progress'
import { SESSION_SIZE } from '../config'
import { feedback } from '../feedback'
import { Board } from '../components/Board'
import { Header, Tracker, Rules, Timer } from '../components/Hud'
import { WinOverlay } from '../components/WinOverlay'
import { BulbIcon, WandIcon, BroomIcon } from '../components/ToolIcons'
import { UndoIcon, PencilIcon, ResetIcon, CloseIcon } from '../components/Icons'
import { PowerDriver, PowerHeader, ComboPill, StageBar, Burst, TimeSlam, Breathe, powerStyle, stageClass } from '../power/PowerHud'
import { powerPhase } from '../power/state'
import { spin } from '../power/spin'
import '../power/power.css'

export function GameScreen() {
  const g = game.value
  // Reveal needs a confirming second tap so a stray thumb can't spoil a clean solve
  const [armed, setArmed] = useState(false)
  const armT = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    resumeClock()
    return () => {
      pauseClock()
      clearTimeout(armT.current)
    }
  }, [])
  useEffect(() => {
    if (!g && !win.value) go('home')
  }, [g])
  if (!g) return null
  const s = progress.value.session
  const hint = activeHint.value
  const inSession = g.mode === 'session' && s && s.id === g.sessionId
  const note = status.value

  const say = (text: string) => {
    feedback('tap')
    flash(text)
  }

  const onReveal = () => {
    clearTimeout(armT.current)
    if (!armed) {
      setArmed(true)
      armT.current = setTimeout(() => setArmed(false), 2500)
      return
    }
    setArmed(false)
    revealPiece()
  }

  const onHint = () => {
    showHint()
    if (!activeHint.value) say('No simple step found. Try Reveal')
  }

  const onTidy = () => {
    if (!tidyUp()) say('Nothing to tidy yet')
  }

  const onRestart = () => {
    if (confirm('Restart this puzzle? Your marks will be cleared (the timer keeps going).')) resetBoard()
  }

  const isPower = g.mode === 'power'
  const sp = spin.value
  const phase = isPower ? powerPhase.value : 'playing'

  return (
    <div
      class={`screen game-screen${isPower ? ` power ${stageClass()}` : ''}`}
      style={isPower ? (powerStyle() as never) : undefined}
    >
      {isPower && <PowerDriver />}
      {isPower ? <PowerHeader /> : <Header onBack={() => go('home')} onSettings={() => go('settings')} />}
      <Tracker right={isPower ? <ComboPill /> : undefined} />
      {!isPower && <Rules />}
      {isPower ? <StageBar /> : (
      <div class="game-sub">
        {inSession ? (
          <span class="session-dots" aria-label={`Puzzle ${Math.min(s!.index + 1, SESSION_SIZE)} of ${SESSION_SIZE}`}>
            {Array.from({ length: SESSION_SIZE }, (_, i) => (
              <span key={i} class={i < s!.index ? 'd done' : i === s!.index ? 'd now' : 'd'} />
            ))}
          </span>
        ) : (
          <span class="mode-chip">{g.mode === 'daily' ? 'Daily puzzle' : 'Bonus puzzle · not counted'}</span>
        )}
        <span class={`diff-chip ${g.puzzle.difficulty}`}>{g.puzzle.difficulty}</span>
        <span class="sub-right">
          <Timer />
          {!g.done && (
            <button class="restart-btn" onClick={onRestart} aria-label="Restart this puzzle">
              <ResetIcon size={18} />
            </button>
          )}
        </span>
      </div>
      )}

      <div class="board-wrap">
        {isPower ? (
          <div class="spin-outer" style={{ transform: `rotate(${sp.deg}deg) scaleX(${sp.mirror ? -1 : 1})` }}>
            <div key={sp.pulse?.t ?? 0} class={`spin-inner${sp.pulse ? ` pulse-${sp.pulse.kind}` : ''}`}>
              <Board />
            </div>
          </div>
        ) : (
          <Board />
        )}
        {isPower && <Burst />}
      </div>

      <div class={`controls${hint ? ' has-hint' : ''}`}>
        {hint ? (
          <div class="hint-bubble fade-in" role="status">
            <p>{hint.text}</p>
            <div class="hint-actions">
              <button class="btn small" onClick={applyHint}>Do it for me</button>
              <button class="round-btn small" onClick={() => (activeHint.value = null)} aria-label="Close hint">
                <CloseIcon size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div class="tools">
            <button class="tool-wrap" onClick={undo} disabled={!g.history.length} aria-label="Undo">
              <span class="tool"><UndoIcon size={28} /></span>
              <span class="tool-label">Undo</span>
            </button>
            {g.drafts ? (
              <button class="tool-wrap on" onClick={applyDrafts} aria-label="Apply pencil marks">
                <span class="tool"><PencilIcon size={28} /></span>
                <span class="tool-label">Apply</span>
              </button>
            ) : (
              <button class="tool-wrap" onClick={togglePencil} aria-label="Pencil">
                <span class="tool"><PencilIcon size={28} /></span>
                <span class="tool-label">Pencil</span>
              </button>
            )}
            <button class="tool-wrap" onClick={onHint} aria-label="Explain the next step">
              <span class="tool primary"><BulbIcon /></span>
              <span class="tool-label">Hint</span>
            </button>
            {g.drafts ? (
              <button class="tool-wrap" onClick={togglePencil} aria-label="Cancel pencil marks">
                <span class="tool"><CloseIcon size={28} /></span>
                <span class="tool-label">Cancel</span>
              </button>
            ) : (
              <button class="tool-wrap" onClick={onTidy} aria-label="Cross out impossible cells">
                <span class="tool"><BroomIcon /></span>
                <span class="tool-label">Tidy</span>
              </button>
            )}
            <button class="tool-wrap" onClick={onReveal} aria-label="Place a piece for me">
              <span class={`tool${armed ? ' armed' : ''}`}><WandIcon /></span>
              <span class="tool-label">{armed ? 'Tap again' : 'Reveal'}</span>
            </button>
          </div>
        )}
        {note && (
          <p key={note.t} class="status-line fade-in" role="status">
            {note.text}
          </p>
        )}
      </div>

      {!isPower && win.value && <WinOverlay />}
      {isPower && phase === 'time' && <TimeSlam />}
      {isPower && phase === 'breathe' && <Breathe />}
    </div>
  )
}

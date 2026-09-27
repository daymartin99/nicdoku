import { useEffect } from 'preact/hooks'
import { go } from '../router'
import {
  game, win, activeHint, showHint, applyHint, revealPiece, tidyUp, undo, togglePencil, applyDrafts,
  resetBoard, resumeClock, pauseClock,
} from '../state/game'
import { progress } from '../state/progress'
import { SESSION_SIZE } from '../config'
import { Board } from '../components/Board'
import { Header, Tracker, Rules, Timer } from '../components/Hud'
import { WinOverlay } from '../components/WinOverlay'
import { BulbIcon, WandIcon, BroomIcon } from '../components/ToolIcons'
import { UndoIcon, PencilIcon, ResetIcon, CloseIcon } from '../components/Icons'

export function GameScreen() {
  const g = game.value
  useEffect(() => {
    resumeClock()
    return () => pauseClock()
  }, [])
  useEffect(() => {
    if (!g && !win.value) go('home')
  }, [g])
  if (!g) return null
  const s = progress.value.session
  const hint = activeHint.value
  const inSession = g.mode === 'session' && s && !s.finishedAt

  return (
    <div class="screen game-screen">
      <Header onBack={() => go('home')} onSettings={() => go('settings')} />
      <Tracker />
      <Rules />
      <div class="game-sub">
        {inSession ? (
          <span class="session-dots" aria-label={`Puzzle ${s!.index + 1} of ${SESSION_SIZE}`}>
            {Array.from({ length: SESSION_SIZE }, (_, i) => (
              <span key={i} class={i < s!.index ? 'd done' : i === s!.index ? 'd now' : 'd'} />
            ))}
          </span>
        ) : (
          <span class="mode-chip">{g.mode === 'daily' ? 'Daily puzzle' : 'Bonus puzzle · not counted'}</span>
        )}
        <span class={`diff-chip ${g.puzzle.difficulty}`}>{g.puzzle.difficulty}</span>
        <Timer />
      </div>

      <Board />

      {hint ? (
        <div class="hint-bubble fade-in" role="status">
          <p>{hint.text}</p>
          <div class="hint-actions">
            <button class="btn small" onClick={applyHint}>Show me</button>
            <button class="round-btn small" onClick={() => (activeHint.value = null)} aria-label="Close hint">
              <CloseIcon size={20} />
            </button>
          </div>
        </div>
      ) : (
        <div class="mini-tools">
          <button class="chip-btn" onClick={undo} disabled={!g.history.length}>
            <UndoIcon size={20} /> Undo
          </button>
          {g.drafts ? (
            <button class="chip-btn on" onClick={applyDrafts}>
              <PencilIcon size={20} /> Apply
            </button>
          ) : (
            <button class="chip-btn" onClick={togglePencil}>
              <PencilIcon size={20} /> Pencil
            </button>
          )}
          {g.drafts && (
            <button class="chip-btn" onClick={togglePencil}>
              Cancel
            </button>
          )}
          <button class="chip-btn" onClick={resetBoard}>
            <ResetIcon size={20} /> Reset
          </button>
        </div>
      )}

      <div class="tools">
        <button class="tool" onClick={revealPiece} aria-label="Place a piece for me">
          <WandIcon />
          <span>Reveal</span>
        </button>
        <button class="tool" onClick={showHint} aria-label="Explain the next step">
          <BulbIcon />
          <span>Hint</span>
        </button>
        <button class="tool" onClick={() => tidyUp()} aria-label="Cross out impossible cells">
          <BroomIcon />
          <span>Tidy</span>
        </button>
      </div>

      {win.value && <WinOverlay />}
    </div>
  )
}

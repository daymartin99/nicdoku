import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { game } from '../state/game'
import { restingToday, powerWaiting } from '../state/progress'
import { dailyLineup, KIND_INFO } from '../dailies'
import { startReplay, archiveLeft, continueGame, loading } from '../flow'
import { allSolves, localDay, type SolveRecord } from '../db'
import { archiveDays, shortDay } from '../stats/archive'
import { formatTime } from '../stats/metrics'
import { ARCHIVE_DAYS, ARCHIVE_PER_DAY } from '../config'
import { BackIcon } from '../components/Icons'
import './home.css'
import './archive.css'

/** Past dailies: replay one and race the time she set on the day. Two replays a day. */
export function ArchiveScreen() {
  const [solves, setSolves] = useState<SolveRecord[] | null>(null)
  useEffect(() => {
    allSolves().then(setSolves).catch(() => setSolves([]))
  }, [])
  const today = localDay()
  const left = archiveLeft(today)
  const resting = restingToday(today) || powerWaiting()
  const g = game.value
  const open = !!g && !g.done && g.mode !== 'power'
  const days = solves ? archiveDays(solves, today, dailyLineup, ARCHIVE_DAYS) : []

  return (
    <div class="screen archive fade-in">
      <div class="topbar">
        <button class="round-btn" onClick={() => go('home')} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Past dailies</h1>
        <span style={{ width: 52 }} />
      </div>

      <div class="card archive-intro">
        <b>
          {resting
            ? 'Resting for now'
            : left > 0
              ? `${left} of ${ARCHIVE_PER_DAY} replays left today`
              : 'No replays left today'}
        </b>
        <span class="muted">
          Race the time you set on the day. Replays don't count in your stats, as you've seen the puzzle before.
        </span>
        {open && (
          <button class="btn archive-continue" onClick={continueGame}>
            Finish your open puzzle first
          </button>
        )}
      </div>

      <ul class="archive-list">
        {days.map((d) => {
          const can = !resting && !open && left > 0 && !loading.value
          return (
            <li key={d.day} class="card archive-day">
              <b class="ad-date">{shortDay(d.day)}</b>
              {d.entries.map((e) => {
                const info = KIND_INFO[e.kind]
                return (
                  <div key={e.slot} class="archive-row">
                    <span class="ar-date">
                      <b>
                        <span aria-hidden="true">{info.icon}</span> {info.title}
                      </b>
                      <span class="muted">
                        {e.n}×{e.n} · {e.difficulty}
                      </span>
                    </span>
                    <span class="ar-times">
                      {e.onDay ? (
                        <span>On the day <b>{formatTime(e.onDay.timeMs)}</b></span>
                      ) : (
                        <span class="muted">Missed</span>
                      )}
                      {e.bestReplay && (
                        <span class="ar-replay">
                          Replay <b>{formatTime(e.bestReplay.timeMs)}</b>
                          {e.onDay && e.bestReplay.timeMs < e.onDay.timeMs ? ' ↑' : ''}
                        </span>
                      )}
                    </span>
                    <button
                      class="ar-play"
                      disabled={!can}
                      onClick={() => void startReplay(d.day, e.slot)}
                      aria-label={`${e.onDay ? 'Replay' : 'Play'} the ${info.title} daily from ${shortDay(d.day)}`}
                    >
                      {e.onDay || e.bestReplay ? '↺' : '▶'}
                    </button>
                  </div>
                )
              })}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

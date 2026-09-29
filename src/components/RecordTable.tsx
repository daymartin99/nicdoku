import type { Rec, RecordGroup } from '../stats/records'
import './RecordTable.css'

const GROUP_TITLE: Record<RecordGroup, string> = { run: 'The run', speed: 'Speed', colour: 'Fastest to each colour' }

/**
 * Her personal record book: this week next to all time, grouped. `highlight` marks
 * records a given run holds (e.g. the one she just played).
 */
export function RecordTable({ allTime, week, highlight }: { allTime: Rec[]; week: Rec[]; highlight?: string }) {
  if (!allTime.length) return null
  const weekById = new Map(week.map((r) => [r.id, r]))
  const groups = (['run', 'speed', 'colour'] as RecordGroup[]).map((g) => ({ g, rows: allTime.filter((r) => r.group === g) }))
  return (
    <div class="rt">
      <div class="rt-head" aria-hidden="true">
        <span />
        <span>This week</span>
        <span>All time</span>
      </div>
      {groups.map(({ g, rows }) =>
        rows.length ? (
          <div key={g} class="rt-group">
            <div class="rt-title">{GROUP_TITLE[g]}</div>
            {rows.map((r) => {
              const w = weekById.get(r.id)
              const weekIsBest = w && w.ref === r.ref
              const mine = highlight && (r.ref === highlight || w?.ref === highlight)
              return (
                <div key={r.id} class={`rt-row${mine ? ' mine' : ''}`}>
                  <span class="rt-label">
                    {r.hex && <i class="rt-swatch" style={{ background: r.hex }} />}
                    {r.label}
                  </span>
                  <span class={`rt-val${w && w.ref === highlight ? ' hot' : ''}`}>{w ? w.display : '–'}</span>
                  <span class={`rt-val best${r.ref === highlight ? ' hot' : ''}`}>
                    {r.display}
                    {weekIsBest && <em aria-label="set this week">★</em>}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null,
      )}
    </div>
  )
}

import type { DayCell } from '../../stats/metrics'
import './charts.css'

const Snowflake = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={2.6} stroke-linecap="round">
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={3.2} stroke-linecap="round" stroke-linejoin="round">
    <path d="m5.5 12.5 4 4 9-9" />
  </svg>
)

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function weekday(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return WD[new Date(y, m - 1, d).getDay()]
}

/** 14 dots: played (orange ✓), frozen (blue ❄), not played (soft grey – never red). */
export function StreakDots({ days }: { days: DayCell[] }) {
  const played = days.filter((d) => d.played).length
  return (
    <div class="streak-dots" role="img" aria-label={`Played on ${played} of the last ${days.length} days`}>
      {days.map((d, i) => {
        const state = d.played ? 'played' : d.frozen ? 'frozen' : 'rest'
        const cls = `${state}${i === days.length - 1 ? ' today' : ''}`
        const what = d.played ? 'played' : d.frozen ? 'freeze used' : 'rest day'
        return (
          <span key={d.day} class={cls} title={`${weekday(d.day)} ${d.day.slice(8)}: ${what}`}>
            {d.played ? <Check /> : d.frozen ? <Snowflake /> : null}
          </span>
        )
      })}
    </div>
  )
}

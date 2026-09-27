import { useEffect, useMemo, useState } from 'preact/hooks'
import { allSolves, localDay, type SolveRecord } from '../db'
import { go } from '../router'
import { BackIcon, InfoIcon } from '../components/Icons'
import { BarChart, Heatmap, LineChart, Snowflake, StreakDots } from '../components/charts'
import '../components/charts/charts.css'
import {
  daysBetween,
  dailySeries,
  formatDuration,
  formatTime,
  headline,
  heatmap,
  medianTime,
  pbSet,
  personalBests,
  sizeLabel,
  sizesPlayed,
  sizeStats,
  streak,
  totals,
  trend,
} from '../stats/metrics'

type Tab = 'overview' | 'size' | 'history'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}
function dayHeading(day: string, today: string): string {
  if (day === today) return 'Today'
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (day === localDay(yest)) return 'Yesterday'
  return `${WD[date.getDay()]} ${d} ${MONTHS[m - 1]}`
}
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)
const secs = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)}s`)

export function StatsScreen() {
  const [solves, setSolves] = useState<SolveRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    let alive = true
    allSolves()
      .then((s) => alive && setSolves(s.sort((a, b) => a.at - b.at)))
      .catch(() => alive && setSolves([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div class="screen">
      <div class="topbar">
        <button class="round-btn" aria-label="Back" onClick={() => go('home')}>
          <BackIcon />
        </button>
        <h1>Your stats</h1>
        <div style={{ width: 52 }} />
      </div>

      {solves === null ? (
        <p class="muted" style={{ textAlign: 'center' }}>Loading…</p>
      ) : !solves.length ? (
        <div class="card st-empty fade-in">
          Solve a few puzzles and your graphs will grow here 🌱
        </div>
      ) : (
        <>
          <div class="tabs" role="tablist">
            {(['overview', 'size', 'history'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === 'overview' ? 'Overview' : t === 'size' ? 'By size' : 'History'}
              </button>
            ))}
          </div>
          {tab === 'overview' && <Overview solves={solves} />}
          {tab === 'size' && <BySize solves={solves} />}
          {tab === 'history' && <History solves={solves} />}
        </>
      )}

      {tab === 'overview' && (
        <div class="st-note">
          <button aria-label="About Nicdoku" onClick={() => go('about')}>
            <InfoIcon />
          </button>
          <span>These numbers only compare you with you. Play as much or as little as you like.</span>
        </div>
      )}
    </div>
  )
}

function Overview({ solves }: { solves: SolveRecord[] }) {
  const today = localDay()
  const data = useMemo(() => {
    const t = totals(solves)
    const st = streak(solves, today)
    const series = dailySeries(solves, 30, today)
    // Only as many weeks as she has been playing (4–12), so a new player isn't faced with a sea of blanks.
    const first = solves.reduce((a, s) => (s.day < a ? s.day : a), today)
    const weeks = Math.min(12, Math.max(4, Math.ceil(daysBetween(first, today) / 7) + 1))
    return { t, st, series, head: headline(solves, today), heat: heatmap(solves, weeks, today), weeks, first }
  }, [solves, today])
  const { t, st, series, head, heat, weeks, first } = data

  const bars = series.map((d, i) => ({
    label: shortDate(d.day),
    value: d.minutes,
    tick: i % 7 === 2 ? shortDate(d.day) : undefined,
  }))

  return (
    <div class="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {head && (
        <div class="card">
          <div class="label">Lately</div>
          <p class="st-headline">{head}</p>
        </div>
      )}

      <div class="st-tiles">
        <Tile label="Puzzles solved" value={String(t.puzzles)} />
        <Tile label="Clean solves" value={pct(t.cleanRate)} />
        <Tile label="Time played" value={formatDuration(t.totalTimeMs)} />
        <Tile label="Best session score" value={t.bestSessionScore ? t.bestSessionScore.toLocaleString('en-GB') : '–'} />
      </div>

      <div class="card">
        <div class="chart-caption">
          <h3>{st.activeLast7} of the last 7 days</h3>
          {st.current >= 2 && <span class="label">{st.current}-day run</span>}
        </div>
        <StreakDots days={st.days} />
        <p class="label" style={{ margin: '10px 0 0' }}>
          {st.current > 0 && st.freezesLeftThisWeek > 0 ? (
            <>
              <span class="st-icon" aria-hidden="true"><Snowflake /></span>
              {`${st.freezesLeftThisWeek} rest day${st.freezesLeftThisWeek === 1 ? '' : 's'} left this week. Your run is safe if you skip.`}
            </>
          ) : (
            'Rest days are part of it. Pick up whenever suits you.'
          )}
          {st.best >= 3 ? ` Longest run: ${st.best} days.` : ''}
        </p>
      </div>

      <div class="card">
        <div class="chart-caption">
          <h3>Minutes played</h3>
          <span class="label">last 30 days</span>
        </div>
        <BarChart data={bars} format={(v) => `${Math.round(v * 10) / 10} min`} ariaLabel="Minutes played per day, last 30 days" />
      </div>

      <div class="card">
        <div class="chart-caption">
          <h3>Puzzle calendar</h3>
          <span class="label">{weeks} weeks</span>
        </div>
        <Heatmap data={heat} startDay={first} ariaLabel={`Puzzles solved per day over the last ${weeks} weeks`} />
      </div>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div class="card st-tile">
      <span class="big-num">{value}</span>
      <span class="label">{label}</span>
    </div>
  )
}

function BySize({ solves }: { solves: SolveRecord[] }) {
  const sizes = useMemo(() => sizesPlayed(solves), [solves])
  const mostPlayed = useMemo(() => {
    let best = sizes[0], c = -1
    for (const n of sizes) {
      const k = solves.filter((s) => s.n === n && s.mode !== 'extra').length
      if (k > c) (best = n), (c = k)
    }
    return best
  }, [solves, sizes])
  const [n, setN] = useState<number | undefined>(undefined)
  const size = n ?? mostPlayed
  const today = localDay()

  const d = useMemo(() => {
    if (size === undefined) return null
    const pbs = pbSet(solves)
    return {
      pb: personalBests(solves).get(size),
      med: medianTime(solves, size, 10),
      tr: trend(solves, size, 8, today),
      st: sizeStats(solves, size),
      pbs,
    }
  }, [solves, size, today])

  if (size === undefined || !d) {
    return <div class="card st-empty">Only bonus puzzles so far — size records start with regular ones.</div>
  }
  // Trim empty weeks before she started this size (but keep at least 2 points for a line).
  const firstReal = d.tr.points.findIndex((p) => p.median !== null)
  const start = Math.max(0, Math.min(firstReal < 0 ? 0 : firstReal, d.tr.points.length - 2))
  const points = d.tr.points
    .slice(start)
    .map((p) => ({ label: shortDate(p.week), value: p.median, highlight: p.hasPB }))
  const hasTrend = points.filter((p) => p.value !== null).length >= 2
  const hasGold = points.some((p) => p.highlight && p.value !== null)

  return (
    <div class="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div class="st-chips" role="group" aria-label="Board size">
        {sizes.map((s) => (
          <button key={s} class="st-chip" aria-pressed={s === size} onClick={() => setN(s)}>
            {sizeLabel(s)}
          </button>
        ))}
      </div>

      <div class="st-tiles">
        <div class="card st-tile">
          <span class="label">Best {sizeLabel(size)}</span>
          <span class="big-num">{d.pb ? formatTime(d.pb.timeMs) : '–'}</span>
          {d.pb && <span class="label">{shortDate(d.pb.day)}</span>}
        </div>
        <div class="card st-tile">
          <span class="label">Typical (last 10)</span>
          <span class="big-num">{d.med !== null ? formatTime(d.med) : '–'}</span>
          <span class="label">{d.st.count} solved</span>
        </div>
      </div>

      <div class="card">
        <div class="chart-caption">
          <h3>Typical time by week</h3>
          {d.tr.improvementPct !== null && d.tr.baselineWeek && (
            <span class="st-good">{d.tr.improvementPct}% faster than w/c {shortDate(d.tr.baselineWeek)}</span>
          )}
        </div>
        {hasTrend ? (
          <>
            <LineChart points={points} format={formatTime}
              ariaLabel={`Weekly median ${sizeLabel(size)} time over ${points.length} weeks; gold dots are weeks with a new best`} />
            {hasGold && (
              <p class="label chart-legend"><i class="dot-gold" aria-hidden="true" /> gold = a week you set a new best</p>
            )}
          </>
        ) : (
          <p class="muted" style={{ margin: 0 }}>Play this size across a couple of weeks and your line appears here.</p>
        )}
      </div>

      <div class="card">
        <div class="chart-caption"><h3>Your fastest 5</h3></div>
        {d.st.fastest.map((s, i) => (
          <div class="st-row" key={s.id ?? s.at}>
            <span>{i + 1}. <strong>{formatTime(s.timeMs)}</strong></span>
            <span class="label">{shortDate(s.day)} · {s.difficulty}{s.clean ? ' · clean' : ''}</span>
          </div>
        ))}
      </div>

      <div class="st-tiles">
        <Tile label="Avg first tap" value={secs(d.st.avgFirstTapMs)} />
        <Tile label="Clean solves" value={pct(d.st.cleanRate)} />
      </div>
    </div>
  )
}

function History({ solves }: { solves: SolveRecord[] }) {
  const today = localDay()
  const groups = useMemo(() => {
    const pbs = pbSet(solves)
    const recent = solves.slice(-80).reverse()
    const out: { day: string; items: SolveRecord[] }[] = []
    for (const s of recent) {
      const g = out[out.length - 1]
      if (g && g.day === s.day) g.items.push(s)
      else out.push({ day: s.day, items: [s] })
    }
    return { out, pbs }
  }, [solves])

  return (
    <div class="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.out.map((g) => (
        <div key={g.day}>
          <div class="st-day">{dayHeading(g.day, today)}</div>
          <div class="card" style={{ padding: '4px 16px', marginTop: 6 }}>
            {g.items.map((s) => (
              <div class="st-row" key={s.id ?? s.at}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ minWidth: 44 }}>{formatTime(s.timeMs)}</strong>
                  <span>{sizeLabel(s.n)}</span>
                  <span class="st-tag">{s.difficulty}</span>
                  {s.clean && <span class="st-tag clean" aria-label="clean solve">
                      {/* ✓ renders as √ in Fredoka, so draw the tick */}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>}
                  {groups.pbs.has(s) && <span class="st-tag pb">best!</span>}
                </span>
                <span class="label">{s.score.toLocaleString('en-GB')} pts</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

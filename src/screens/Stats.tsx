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
import {
  runLength,
  runLengthMin,
  sliceMs,
  crescendo,
  focusStats,
  moodLift,
  peakEnd,
  powerBests,
  realLife,
  settlingMs,
  steadyBlocks,
  vsLastTime,
  warmUp,
  weekMinutes,
} from '../stats/psych'
import { powerHistory, type PowerRun } from '../power/state'
import { allMoods, moodPairs, moodsFromRuns, type MoodPair } from '../mood'

type Tab = 'overview' | 'size' | 'history' | 'power'
const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', size: 'Sizes', history: 'History', power: 'Power' }
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
  const [runs, setRuns] = useState<PowerRun[]>([])
  const [pairs, setPairs] = useState<MoodPair[]>([])
  const [tab, setTab] = useState<Tab | null>(null)

  useEffect(() => {
    let alive = true
    // each source fails soft: missing moods or Power Hours never hide the rest
    Promise.all([allSolves().catch(() => [] as SolveRecord[]), powerHistory(), allMoods()]).then(([s, r, m]) => {
      if (!alive) return
      setRuns(r)
      setPairs(moodPairs([...m, ...moodsFromRuns(r)]))
      setSolves(s.sort((a, b) => a.at - b.at))
    })
    return () => {
      alive = false
    }
  }, [])

  // with only Power Hours so far, open on the Power tab
  const active: Tab = tab ?? (solves && !solves.length && runs.length ? 'power' : 'overview')
  const noSolves = (
    <div class="card st-empty fade-in">
      Solve a few puzzles and your graphs will grow here 🌱
    </div>
  )

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
      ) : !solves.length && !runs.length ? (
        noSolves
      ) : (
        <>
          <div class="tabs" role="tablist">
            {(['overview', 'size', 'history', 'power'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={active === t} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          {active === 'overview' && (solves.length ? <Overview solves={solves} runs={runs} pairs={pairs} /> : noSolves)}
          {active === 'size' && (solves.length ? <BySize solves={solves} /> : noSolves)}
          {active === 'history' && (solves.length ? <History solves={solves} /> : noSolves)}
          {active === 'power' && <PowerTab runs={runs} pairs={pairs} />}
        </>
      )}

      {active === 'overview' && (
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

function Overview({ solves, runs, pairs }: { solves: SolveRecord[]; runs: PowerRun[]; pairs: MoodPair[] }) {
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
  const psych = useMemo(() => {
    const mins = weekMinutes(solves, runs, today)
    return { lift: moodLift(pairs, 'break'), warm: warmUp(solves), mins, life: realLife(mins) }
  }, [solves, runs, pairs, today])

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

      {psych.life && (
        <div class="card">
          <div class="label">This week</div>
          <p class="ps-value">{Math.round(psych.mins)} min of puzzles</p>
          <p class="label ps-sub">{`That's ${psych.life}.`}</p>
        </div>
      )}

      {psych.lift && (
        <Insight
          title="Mood lift"
          value={psych.lift.line}
          sub={psych.lift.sub}
          info={MOOD_INFO}
        />
      )}

      {psych.warm && (
        <Insight
          title="Warm-up effect"
          value={psych.warm.line}
          sub={`First puzzle about ${formatTime(psych.warm.firstMs)}, then about ${formatTime(psych.warm.restMs)} · ${psych.warm.sessions} breaks`}
          info="Most people take a moment to settle into a task. This compares the first puzzle of each break with the next ones of the same size in that same break."
        />
      )}

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
                  {s.clean && <span class="st-tag clean" aria-label="clean solve"><Tick /></span>}
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

// ---------- shared bits ----------

const MOOD_INFO =
  'From your own before-and-after taps. Research on short breaks (Albulescu et al., 2022) found small boosts in energy and less tiredness on average; this shows what happens for you.'

/** ✓ renders as √ in Fredoka, so draw the tick */
function Tick({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** A stat with a plain-English (i) explanation that opens in place. */
function Insight({ title, value, sub, info }: { title: string; value: string; sub?: string | null; info: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div class="card ps-card">
      <div class="ps-head">
        <span class="label">{title}</span>
        <button class="ps-i" aria-expanded={open} aria-label={`About ${title.toLowerCase()}`} onClick={() => setOpen(!open)}>
          <InfoIcon size={20} />
        </button>
      </div>
      <p class="ps-value">{value}</p>
      {sub && <p class="label ps-sub">{sub}</p>}
      {open && <p class="ps-info">{info}</p>}
    </div>
  )
}

// ---------- Power Hour ----------

const MIN = 60_000
const mins = (ms: number) => `${Math.max(1, Math.round(ms / MIN))} min`

// soft butter → apricot → deep orange: bars get warmer toward the end of the hour (no alarm red)
const WARM_FROM = [247, 214, 160], WARM_MID = [242, 146, 47], WARM_TO = [222, 104, 40]
function warmth(i: number, k: number): string {
  const t = k <= 1 ? 1 : i / (k - 1)
  const [a, b, u] = t < 0.5 ? [WARM_FROM, WARM_MID, t * 2] as const : [WARM_MID, WARM_TO, (t - 0.5) * 2] as const
  const c = a.map((x, j) => Math.round(x + (b[j] - x) * u))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function PowerTab({ runs, pairs }: { runs: PowerRun[]; pairs: MoodPair[] }) {
  const d = useMemo(() => {
    if (!runs.length) return null
    const sorted = [...runs].sort((a, b) => b.startedAt - a.startedAt)
    const latest = sorted[0]
    // compare like with like: the previous run of the same length
    const prev = sorted.slice(1).find((r) => runLength(r) === runLength(latest))
    const sameLength = runs.filter((r) => runLength(r) === runLength(latest))
    const settle = settlingMs(latest)
    const prevSettle = prev ? settlingMs(prev) : null
    return {
      sorted,
      latest,
      blocks: crescendo(latest),
      bests: powerBests(sameLength),
      vs: vsLastTime(runs),
      settle,
      settleQuicker: settle !== null && prevSettle !== null && settle < prevSettle,
      focus: focusStats(latest),
      pe: peakEnd(latest),
      steady: steadyBlocks(latest),
      lift: moodLift(pairs, 'power'),
    }
  }, [runs, pairs])

  if (!d) return <div class="card st-empty fade-in">Your first Power run will show up here ⚡</div>
  const { latest, blocks, bests, vs, focus, pe, steady } = d
  const slice = sliceMs(latest) / MIN
  const m = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1))
  const bars = blocks.map((v, i) => ({
    label: `${m(i * slice)}–${m((i + 1) * slice)} min`,
    value: v,
    tick: i % 3 === 0 ? `${m(i * slice)}m` : undefined,
  }))
  const lenLabel = `${runLengthMin(latest)}-min`

  return (
    <div class="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div class="card">
        <div class="chart-caption">
          <h3>Your latest {lenLabel} run</h3>
          <span class="label">{shortDate(latest.day)}</span>
        </div>
        <BarChart
          data={bars}
          colors={bars.map((_, i) => warmth(i, bars.length))}
          format={(v) => `${v} puzzle${v === 1 ? '' : 's'}`}
          ariaLabel="Puzzles solved in each twelfth of your latest Power run"
        />
        {vs && (
          <p class={`label chart-legend${vs.lines.length ? ' st-good' : ''}`}>
            {vs.lines.length ? vs.lines.join(' · ') : vs.neutral}
          </p>
        )}
      </div>

      <div class="st-tiles three">
        <Tile label={`Most puzzles (${lenLabel})`} value={String(bests.puzzles)} />
        <Tile label="Top score" value={bests.score.toLocaleString('en-GB')} />
        <Tile label="Longest combo" value={String(bests.combo)} />
      </div>

      {d.settle !== null && (
        <Insight
          title="Settling in"
          value={`${formatTime(d.settle)} to your first clean solve`}
          sub={d.settleQuicker ? 'Quicker than last time' : null}
          info="How long it took to find your rhythm. Most people need a little while to settle into a task; that's normal, not slow."
        />
      )}

      <Insight
        title="Longest focus"
        value={`${formatDuration(focus.longestMs)} without leaving the app`}
        sub={focus.switches === 0 ? 'You stayed in the app the whole time' : `Stepped away ${focus.switches} time${focus.switches === 1 ? '' : 's'}`}
        info="Staying with one task over time is what psychologists call sustained attention. This only counts time in the app; stepping away is fine and often sensible."
      />

      <Insight
        title="Peak and end"
        value={pe.peak ? `Peak: ${pe.peak.combo} clean in a row, ${mins(pe.peak.at)} in` : pe.end.text}
        sub={pe.peak ? `End: ${pe.end.text}` : null}
        info="Psychology's peak–end rule (Kahneman): we tend to remember an experience by its most intense moment and how it ended."
      />

      {steady.total > 0 && (
        <Insight
          title="Steady-pace blocks"
          value={`${steady.steady} of ${steady.total} blocks`}
          sub="Blocks are twelfths of the run. Solved at least one, close to your usual pace for that run"
          info="Being absorbed in something challenging but doable is what psychologists call flow (Csikszentmihalyi). We can't measure flow, but a steady pace is one outward sign. Pace here is time per square, within about a third of your median for that hour."
        />
      )}

      {d.lift && (
        <Insight
          title="Mood lift"
          value={d.lift.line}
          sub={d.lift.sub}
          info="From your own taps before and after each Power Hour. It shows your pattern so far, not a rule, and a rough day afterwards is allowed too."
        />
      )}

      <div>
        <div class="st-day">All Power runs</div>
        <div class="card" style={{ padding: '4px 16px', marginTop: 6 }}>
          {d.sorted.map((r) => (
            <div class="st-row" key={r.id}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ minWidth: 52 }}>{shortDate(r.day)}</strong>
                <span class="st-tag">{runLengthMin(r)} min{r.mode && r.mode !== 'normal' ? ` · ${r.mode}` : ''}</span>
                <span>{r.solves.length} puzzle{r.solves.length === 1 ? '' : 's'}</span>
                {r.bestCombo >= 2 && <span class="st-tag">×{r.bestCombo} combo</span>}
                {r.bossDone && (
                  <span class="st-tag clean ps-boss" aria-label="boss beaten">
                    boss <Tick size={13} />
                  </span>
                )}
              </span>
              <span class="label">{r.score.toLocaleString('en-GB')} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

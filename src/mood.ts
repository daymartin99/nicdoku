// Mood check-ins: an optional one-tap "how do you feel?" before and after a break or a Power Hour.
// Stored in IndexedDB kv 'moods' as MoodEntry[]. Nothing here ever throws: storage can fail
// (private mode, quota) and the game must carry on regardless.
//
// Usage (the before-mood for a break is saved when the break starts):
//   saveMood({ kind: 'break', ref: session.id, when: 'before', v: 3 })
//   saveMood({ kind: 'power', ref: run.id, when: 'after', v: 4 })

import { kvGet, kvSet, localDay } from './db'

export type MoodValue = 1 | 2 | 3 | 4 | 5
export type MoodKind = 'break' | 'power'
export type MoodWhen = 'before' | 'after'

export type MoodEntry = {
  /** epoch ms when tapped */
  at: number
  /** local day YYYY-MM-DD */
  day: string
  kind: MoodKind
  /** session id (breaks) or power run id */
  ref: string
  when: MoodWhen
  v: MoodValue
}

/** What callers pass: `at` and `day` default to now. */
export type MoodInput = Omit<MoodEntry, 'at' | 'day'> & { at?: number; day?: string }

export type MoodPair = { kind: MoodKind; ref: string; day: string; before: MoodValue; after: MoodValue }
export type MoodSummary = { n: number; better: number; same: number; worse: number; avgChange: number | null }

/** 1 Rough · 2 Meh · 3 Okay · 4 Good · 5 Great */
export const MOOD_LABELS: Record<MoodValue, string> = { 1: 'Rough', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' }

const KEY = 'moods'

export function isMoodValue(v: unknown): v is MoodValue {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5
}

function valid(e: unknown): e is MoodEntry {
  if (!e || typeof e !== 'object') return false
  const m = e as MoodEntry
  return (
    typeof m.at === 'number' &&
    typeof m.day === 'string' &&
    (m.kind === 'break' || m.kind === 'power') &&
    typeof m.ref === 'string' &&
    !!m.ref &&
    (m.when === 'before' || m.when === 'after') &&
    isMoodValue(m.v)
  )
}

// Writes are chained so two quick taps can't overwrite each other's read-modify-write.
let chain: Promise<unknown> = Promise.resolve()

/** Save (or replace) one check-in. Re-tapping the same kind/ref/when replaces the earlier tap. Never throws. */
export function saveMood(input: MoodInput): Promise<void> {
  const at = input.at ?? Date.now()
  const entry: MoodEntry = {
    at,
    day: input.day ?? localDay(new Date(at)),
    kind: input.kind,
    ref: input.ref,
    when: input.when,
    v: input.v,
  }
  if (!valid(entry)) return Promise.resolve()
  const job = chain.then(async () => {
    try {
      const list = await allMoods()
      const rest = list.filter((m) => !(m.kind === entry.kind && m.ref === entry.ref && m.when === entry.when))
      await kvSet(KEY, [...rest, entry])
    } catch {
      /* storage unavailable: a missed check-in is fine */
    }
  })
  chain = job
  return job
}

/** Every stored check-in (invalid rows dropped). Never throws. */
export async function allMoods(): Promise<MoodEntry[]> {
  try {
    const raw = await kvGet<unknown>(KEY)
    return Array.isArray(raw) ? raw.filter(valid) : []
  } catch {
    return []
  }
}

/** The check-in for one break/run, if she gave one. Never throws. */
export async function getMood(kind: MoodKind, ref: string, when: MoodWhen): Promise<MoodEntry | undefined> {
  const list = await allMoods()
  return latest(list.filter((m) => m.kind === kind && m.ref === ref && m.when === when))
}

// ---------- pure ----------

function latest(list: MoodEntry[]): MoodEntry | undefined {
  let best: MoodEntry | undefined
  for (const m of list) if (!best || m.at >= best.at) best = m
  return best
}

/**
 * Power Hour runs also carry moodBefore/moodAfter on the run itself.
 * Turn those into entries so they can be merged with the kv list (moodPairs de-duplicates).
 */
export function moodsFromRuns(
  runs: { id: string; day: string; startedAt: number; endedAt?: number; moodBefore?: number; moodAfter?: number }[],
): MoodEntry[] {
  const out: MoodEntry[] = []
  for (const r of runs) {
    if (isMoodValue(r.moodBefore)) {
      out.push({ at: r.startedAt, day: r.day, kind: 'power', ref: r.id, when: 'before', v: r.moodBefore })
    }
    if (isMoodValue(r.moodAfter)) {
      out.push({ at: r.endedAt ?? r.startedAt, day: r.day, kind: 'power', ref: r.id, when: 'after', v: r.moodAfter })
    }
  }
  return out
}

/** Before/after pairs, only where both exist. If a slot was tapped twice the latest tap wins. Oldest first. */
export function moodPairs(moods: MoodEntry[]): MoodPair[] {
  const slots = new Map<string, { before?: MoodEntry; after?: MoodEntry }>()
  for (const m of moods) {
    if (!valid(m)) continue
    const k = `${m.kind}|${m.ref}`
    const s = slots.get(k) ?? {}
    const cur = s[m.when]
    if (!cur || m.at >= cur.at) s[m.when] = m
    slots.set(k, s)
  }
  const out: (MoodPair & { at: number })[] = []
  for (const s of slots.values()) {
    if (!s.before || !s.after) continue
    out.push({
      kind: s.before.kind,
      ref: s.before.ref,
      day: s.before.day,
      before: s.before.v,
      after: s.after.v,
      at: s.before.at,
    })
  }
  return out.sort((a, b) => a.at - b.at).map(({ at: _at, ...p }) => p)
}

export function moodSummary(pairs: MoodPair[]): MoodSummary {
  let better = 0, same = 0, worse = 0, sum = 0
  for (const p of pairs) {
    const d = p.after - p.before
    sum += d
    if (d > 0) better++
    else if (d < 0) worse++
    else same++
  }
  const n = pairs.length
  return { n, better, same, worse, avgChange: n ? Math.round((sum / n) * 100) / 100 : null }
}

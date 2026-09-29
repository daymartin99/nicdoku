// Weekly challenge: one target a week, picked from her own record books.
// Fixed for the week once chosen (so it doesn't move as she improves). Pure, tested.

import type { PowerRun } from '../power/state'
import type { SolveRecord } from '../db'
import { makeRng } from '../engine/rng'
import { breakRecords, formatKey, formatLabel, formatRecords, formatsPlayed, type Rec } from './records'
import { sizesPlayed } from './metrics'

export type Challenge = {
  /** local ISO date of the Monday this challenge belongs to */
  week: string
  kind: 'power' | 'break' | 'starter'
  /** format key ("10-wild") or board size ("9") */
  key: string
  recId: string
  title: string
  /** e.g. "2.4s to beat" */
  sub: string
  target: number
  better: 'low' | 'high'
  targetDisplay: string
  /** epoch ms when it was set; only play after this counts */
  setAt: number
  done?: { at: number; display: string }
}

/** Records worth setting as a weekly target (beatable, meaningful). */
const GOOD = (r: Rec) =>
  r.id !== 'mistakes' && // "fewer than 0" can't be beaten
  !(r.better === 'low' && r.value < 400) && // a 0.3 s tap is luck, not a target
  !(r.better === 'high' && r.value <= 0)

function phrase(r: Rec, where: string): { title: string; sub: string } {
  const what = r.label.charAt(0).toLowerCase() + r.label.slice(1)
  return { title: `Beat your ${what} in ${where}`, sub: `${r.display} to beat` }
}

export function pickChallenge(runs: PowerRun[], solves: SolveRecord[], week: string, now: number, salt = ''): Challenge {
  const rng = makeRng(`nicdoku:weekly:${week}:${salt}`)
  const candidates: { kind: 'power' | 'break'; key: string; rec: Rec; where: string }[] = []
  for (const f of formatsPlayed(runs).slice(0, 4)) {
    const recs = formatRecords(runs.filter((r) => formatKey(r) === f)).filter(GOOD)
    for (const rec of recs) candidates.push({ kind: 'power', key: f, rec, where: formatLabel(f) })
  }
  for (const n of sizesPlayed(solves.filter((s) => s.mode !== 'extra')).slice(0, 3)) {
    for (const rec of breakRecords(solves, n).filter(GOOD)) candidates.push({ kind: 'break', key: String(n), rec, where: `${n}×${n} breaks` })
  }
  if (!candidates.length) {
    return {
      week, kind: 'starter', key: '10-normal', recId: 'play', title: 'Play a Power run, any length',
      sub: 'Your first run becomes the target for next week', target: 1, better: 'high', targetDisplay: '1 run', setAt: now,
    }
  }
  // lean towards speed and colour records: they're the quick, satisfying wins
  const weighted = candidates.flatMap((c) => (c.rec.group === 'run' ? [c] : [c, c]))
  const c = weighted[Math.floor(rng.next() * weighted.length)]
  const { title, sub } = phrase(c.rec, c.where)
  return {
    week, kind: c.kind, key: c.key, recId: c.rec.id, title, sub,
    target: c.rec.value, better: c.rec.better, targetDisplay: c.rec.display, setAt: now,
  }
}

/** Has play since the challenge was set beaten its target? Returns the winning value if so. */
export function checkChallenge(ch: Challenge, runs: PowerRun[], solves: SolveRecord[]): { display: string } | null {
  if (ch.kind === 'starter') {
    const played = runs.some((r) => r.startedAt >= ch.setAt && r.endedAt)
    return played ? { display: 'done' } : null
  }
  const recs =
    ch.kind === 'power'
      ? formatRecords(runs.filter((r) => r.startedAt >= ch.setAt && formatKey(r) === ch.key))
      : breakRecords(solves.filter((s) => s.at >= ch.setAt), Number(ch.key))
  const rec = recs.find((r) => r.id === ch.recId)
  if (!rec) return null
  const beaten = ch.better === 'low' ? rec.value < ch.target : rec.value > ch.target
  return beaten ? { display: rec.display } : null
}

// DEV ONLY – synthetic history for eyeballing the Stats screen. Never auto-run.
// Demo records are tagged with a sessionId starting "demo-" so they can be removed.
import { addSolve, allSolves, localDay, replaceSolves, type SolveRecord } from '../db'
import type { Difficulty } from '../engine/types'

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
const BASE_SEC: Record<number, number> = { 8: 150, 9: 210, 10: 300 }

/** ~6 weeks of plausible solves: improving times, some missed days, sizes 8–10. Pure. */
export function makeDemoSolves(end = new Date(), days = 42, seed = 7): SolveRecord[] {
  const r = rng(seed)
  const out: SolveRecord[] = []
  for (let k = days - 1; k >= 0; k--) {
    if (r() < 0.25) continue // a missed day now and then
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k, 8 + Math.floor(r() * 12), Math.floor(r() * 60))
    const day = localDay(date)
    const progress = 1 - k / days // 0 → 1 over the period
    const count = 1 + Math.floor(r() * 4)
    const sessionId = `demo-${day}`
    for (let j = 0; j < count; j++) {
      const n = 8 + Math.min(2, Math.floor(r() * (progress > 0.5 ? 3 : 2.2)))
      const grade = 1 + Math.floor(r() * (2 + progress * 3))
      const difficulty = DIFFS[Math.min(3, Math.max(0, grade - 2))]
      const mistakes = r() < 0.3 - progress * 0.15 ? 1 + Math.floor(r() * 2) : 0
      const hints = r() < 0.12 ? 1 : 0
      const skill = 1 - 0.35 * progress // up to ~35% faster by the end
      const noise = 0.75 + r() * 0.6 + (r() < 0.08 ? 0.8 : 0) // occasional distracted solve
      const timeMs = Math.round(BASE_SEC[n] * skill * noise * (0.8 + grade * 0.1) * 1000)
      const clean = !mistakes && !hints
      out.push({
        at: date.getTime() + j * (timeMs + 20_000),
        day,
        mode: 'session',
        sessionId,
        level: out.length + 1,
        n,
        difficulty,
        grade,
        timeMs,
        firstTapMs: Math.round(1500 + r() * 6000),
        mistakes,
        hints,
        assists: 0,
        undos: Math.floor(r() * 4),
        clean,
        score: Math.round((n * n * 10 * (clean ? 1.5 : 1)) / Math.max(1, timeMs / 60000)),
        themeId: 'default',
      })
    }
  }
  return out
}

/** Appends demo solves to IndexedDB (never clears real data). Returns how many were added. */
export async function seedDemoSolves(): Promise<number> {
  const recs = makeDemoSolves()
  for (const rec of recs) await addSolve(rec)
  return recs.length
}

/** Removes only the demo solves again. */
export async function clearDemoSolves(): Promise<void> {
  const keep = (await allSolves()).filter((s) => !s.sessionId?.startsWith('demo-'))
  await replaceSolves(keep)
}

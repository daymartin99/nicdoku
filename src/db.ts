// Persistence. localStorage for small synchronous state (settings, current game),
// IndexedDB for history (one record per solve), private family data and photos.

import { openDB, type IDBPDatabase } from 'idb'
import type { Difficulty } from './engine/types'

export type SolveRecord = {
  id?: number
  /** epoch ms when finished */
  at: number
  /** local date YYYY-MM-DD */
  day: string
  mode: 'session' | 'daily' | 'extra'
  sessionId?: string
  level: number
  n: number
  difficulty: Difficulty
  grade: number
  timeMs: number
  firstTapMs: number
  mistakes: number
  hints: number
  assists: number
  undos: number
  clean: boolean
  score: number
  themeId: string
  /** each correct piece: ms into the puzzle, colour shown, placed by a hint */
  picks?: { t: number; c: string; h?: boolean }[]
  /** a replay of this day's daily puzzle (saved as 'extra', so never counted in stats) */
  replayOf?: string
}

let dbp: Promise<IDBPDatabase> | null = null

function db() {
  dbp ??= openDB('nicdoku', 1, {
    upgrade(d) {
      const solves = d.createObjectStore('solves', { keyPath: 'id', autoIncrement: true })
      solves.createIndex('day', 'day')
      solves.createIndex('n', 'n')
      d.createObjectStore('kv')
    },
  })
  return dbp
}

export async function addSolve(rec: SolveRecord): Promise<number> {
  return (await db()).add('solves', rec) as Promise<number>
}

export async function allSolves(): Promise<SolveRecord[]> {
  return (await db()).getAll('solves')
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key)
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key)
}

export async function kvDel(key: string): Promise<void> {
  await (await db()).delete('kv', key)
}

export async function kvKeys(): Promise<string[]> {
  return (await (await db()).getAllKeys('kv')) as string[]
}

export async function replaceSolves(recs: SolveRecord[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('solves', 'readwrite')
  await tx.store.clear()
  for (const r of recs) await tx.store.put(r)
  await tx.done
}

// ---- localStorage helpers (never throw) ----
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked – game keeps running */
  }
}

export function localDay(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

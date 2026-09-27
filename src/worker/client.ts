// Puzzle generation off the main thread, with a cache and a main-thread fallback
// so a worker failure can never block play.

import type { Difficulty, Puzzle } from '../engine/types'

type Pending = { resolve: (p: Puzzle) => void; reject: (e: unknown) => void }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()
const cache = new Map<string, Promise<Puzzle>>()

function getWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./gen.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; puzzle?: Puzzle; error?: string }>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.puzzle) p.resolve(e.data.puzzle)
      else p.reject(new Error(e.data.error))
    }
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('worker crashed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

async function onMainThread(n: number, seed: string, difficulty?: Difficulty): Promise<Puzzle> {
  const { generatePuzzle } = await import('../engine/generate')
  return generatePuzzle(n, seed, { difficulty })
}

export function requestPuzzle(n: number, seed: string, difficulty?: Difficulty): Promise<Puzzle> {
  const key = `${n}|${seed}|${difficulty ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const w = getWorker()
  const viaWorker = w
    ? new Promise<Puzzle>((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        w.postMessage({ id, n, seed, difficulty })
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id)
            reject(new Error('timeout'))
          }
        }, 6000)
      })
    : Promise.reject(new Error('no worker'))
  const p = viaWorker.catch(() => onMainThread(n, seed, difficulty))
  cache.set(key, p)
  p.catch(() => cache.delete(key))
  return p
}

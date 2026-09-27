import { generatePuzzle } from '../engine/generate'
import type { Difficulty } from '../engine/types'

type Req = { id: number; n: number; seed: string; difficulty?: Difficulty }

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, n, seed, difficulty } = e.data
  try {
    const puzzle = generatePuzzle(n, seed, { difficulty })
    self.postMessage({ id, puzzle })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}

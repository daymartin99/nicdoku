import { generatePuzzle, type GenerateOptions } from '../engine/generate'

type Req = { id: number; n: number; seed: string; opts: GenerateOptions }

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, n, seed, opts } = e.data
  try {
    const puzzle = generatePuzzle(n, seed, opts)
    self.postMessage({ id, puzzle })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}

// Assign palette colours to regions so touching regions look as different as possible.
// Greedy graph colouring on perceptual (CIELAB) distance, deterministic per puzzle.

import { neighbors4 } from './types'

function hexToLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = v.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function dist(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

const cache = new Map<string, number[]>()

/** Returns colour index for each region id. */
export function assignColours(n: number, regions: ArrayLike<number>, palette: string[]): number[] {
  const key = `${n}|${Array.prototype.join.call(regions, '')}|${palette.join()}`
  const hit = cache.get(key)
  if (hit) return hit

  const adj = Array.from({ length: n }, () => new Set<number>())
  for (let i = 0; i < n * n; i++) {
    for (const j of neighbors4(n, i)) {
      if (regions[i] !== regions[j]) adj[regions[i]].add(regions[j])
    }
  }
  const labs = palette.map(hexToLab)
  const order = [...Array(n).keys()].sort((a, b) => adj[b].size - adj[a].size || a - b)
  const out = new Array<number>(n).fill(-1)
  const used = new Set<number>()
  for (const r of order) {
    let best = -1, bestScore = -Infinity
    for (let c = 0; c < palette.length; c++) {
      if (used.has(c) && used.size < palette.length) continue
      let minD = Infinity
      for (const nb of adj[r]) if (out[nb] >= 0) minD = Math.min(minD, dist(labs[c], labs[out[nb]]))
      // prefer the most distinct from neighbours; tie-break keeps palette order (designer's intent)
      const score = (minD === Infinity ? 1000 : minD) - c * 0.01
      if (score > bestScore) { bestScore = score; best = c }
    }
    out[r] = best
    used.add(best)
  }
  cache.set(key, out)
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  return out
}

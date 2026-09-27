export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type Puzzle = {
  id: string
  n: number
  /** region id (0..n-1) for each cell, row-major, length n*n */
  regions: number[]
  /** solution[row] = column of the piece in that row */
  solution: number[]
  /** hardest human-logic rule level needed (1..5) */
  grade: number
  difficulty: Difficulty
}

export const DIFFICULTY_BY_GRADE: Record<number, Difficulty> = {
  0: 'easy',
  1: 'easy',
  2: 'easy',
  3: 'medium',
  4: 'hard',
  5: 'expert',
}

export const GRADE_RANGE: Record<Difficulty, [number, number]> = {
  easy: [1, 2],
  medium: [3, 3],
  hard: [4, 4],
  expert: [5, 5],
}

export function neighbors8(n: number, i: number): number[] {
  const r = (i / n) | 0, c = i % n
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const rr = r + dr, cc = c + dc
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc)
    }
  }
  return out
}

export function neighbors4(n: number, i: number): number[] {
  const r = (i / n) | 0, c = i % n
  const out: number[] = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}

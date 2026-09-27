// Theme contract shared by the calendar, the board and the win screen.

export type PieceArt =
  /** inline SVG markup, viewBox "0 0 100 100", no width/height attributes */
  | { kind: 'svg'; svg: string }
  | { kind: 'emoji'; char: string }
  /** a photo she picked, stored in IndexedDB (kv store key `photo:<id>`) */
  | { kind: 'photo'; photoId: string }

export type Fact = {
  title: string
  /** 2–3 short sentences, verified */
  body: string
  link?: { label: string; url: string }
}

export type Theme = {
  id: string
  name: string
  /** the piece placed on the board */
  piece: PieceArt
  /** region colours; at least 11 entries, readable with a white X on top */
  palette: string[]
  /** page background tint (defaults to cream) */
  bg?: string
  /** accent for buttons/score (defaults to warm orange) */
  accent?: string
  /** big bubbly words on the win screen, one picked at random */
  winWords: string[]
  /** optional one-liner under the greeting on Home */
  tagline?: string
  fact?: Fact
}

export type FamilyMember = {
  name: string
  /** ISO date YYYY-MM-DD */
  birthday: string
  /** optional emoji for their week */
  emoji?: string
}

export type SpecialDate = {
  /** MM-DD */
  date: string
  title: string
  message: string
  emoji?: string
}

/** Private data imported on her phone only (family.json). Never bundled. */
export type FamilyData = {
  members: FamilyMember[]
  specials: SpecialDate[]
}

export type ResolvedTheme = {
  theme: Theme
  /** e.g. "Alex turns 14 in 3 days 🎂" – extra lines for overlapping events */
  countdowns: string[]
  /** true on the actual birthday/special day */
  isBigDay: boolean
}

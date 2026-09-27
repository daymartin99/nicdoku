import { describe, expect, it } from 'vitest'
import {
  allThemes,
  dayNum,
  easterSunday,
  ENTRY_COUNT,
  nthWeekday,
  resolveTheme,
  themeById,
  upcoming,
} from './calendar'
import { PALETTES } from './palettes'
import { PIECES } from './pieces'
import type { FamilyData } from './types'

// NOTE: deliberately fictional sample data – the real family.json is private and
// lives outside the repo. Dates are chosen to exercise the same edge cases.
const FAMILY: FamilyData = {
  members: [
    { name: 'Alex', birthday: '2014-01-28', emoji: '🦋' },
    { name: 'Robin', birthday: '2019-01-04', emoji: '🌈' },
    { name: 'Sam', birthday: '2015-05-12' },
    { name: 'Kit', birthday: '2010-05-17' },
    { name: 'Nicola', birthday: '1990-11-24' },
  ],
  specials: [{ date: '12-31', title: 'Two reasons to celebrate', message: 'Test special message ❤️', emoji: '❤️' }],
}

const d = (iso: string) => {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day, 12, 0, 0) // local noon
}
const iso = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10)

describe('date rules', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2025)).toEqual({ m: 4, d: 20 })
    expect(easterSunday(2026)).toEqual({ m: 4, d: 5 })
    expect(easterSunday(2027)).toEqual({ m: 3, d: 28 })
    expect(easterSunday(2024)).toEqual({ m: 3, d: 31 })
  })

  it('finds Shrove Tuesday and Mothering Sunday 2026', () => {
    expect(resolveTheme(d('2026-02-17'), null).theme.id).toBe('pancake-day')
    expect(resolveTheme(d('2026-03-15'), null).theme.id).toBe('mothering-sunday')
  })

  it('finds UK bank holidays and Remembrance Sunday', () => {
    expect(iso(nthWeekday(2026, 5, 1, 1))).toBe('2026-05-04') // early May BH
    expect(iso(nthWeekday(2026, 5, 1, -1))).toBe('2026-05-25') // spring BH
    expect(iso(nthWeekday(2026, 8, 1, -1))).toBe('2026-08-31') // summer BH
    expect(iso(nthWeekday(2026, 11, 0, 2))).toBe('2026-11-08') // Remembrance Sunday
    expect(iso(nthWeekday(2026, 6, 0, 3))).toBe('2026-06-21') // Father's Day
    expect(resolveTheme(d('2026-05-04'), null).theme.id).toBe('may-bank-holiday')
    expect(resolveTheme(d('2026-11-08'), null).theme.id).toBe('remembrance-sunday')
  })

  it('covers the Easter weekend Good Friday to Easter Monday', () => {
    for (const day of ['2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06']) {
      expect(resolveTheme(d(day), null).theme.id).toBe('easter')
    }
    expect(resolveTheme(d('2026-04-07'), null).theme.id).not.toBe('easter')
  })

  it('holidays beat ranges; ranges beat the month fallback', () => {
    expect(resolveTheme(d('2026-12-25'), null).theme.id).toBe('christmas')
    expect(resolveTheme(d('2026-12-10'), null).theme.id).toBe('christmas-countdown')
    expect(resolveTheme(d('2026-10-31'), null).theme.id).toBe('halloween')
    expect(resolveTheme(d('2026-10-27'), null).theme.id).toBe('halloween-week')
    expect(resolveTheme(d('2026-02-03'), null).theme.id).toBe('season-feb')
  })

  it('only has a leap day in leap years', () => {
    expect(resolveTheme(d('2032-02-29'), null).theme.id).toBe('leap-day')
    // 2028: Shrove Tuesday lands on 29 Feb – the holiday wins, leap day is an extra line
    const r = resolveTheme(d('2028-02-29'), null)
    expect(r.theme.id).toBe('pancake-day')
    expect(r.countdowns).toContain('Also today: Leap Day 🐸')
  })
})

describe('coverage', () => {
  it('has 60–80 calendar entries', () => {
    expect(ENTRY_COUNT).toBeGreaterThanOrEqual(60)
    expect(ENTRY_COUNT).toBeLessThanOrEqual(80)
  })

  it('every day of 2026 and 2027 resolves to a valid theme', () => {
    const pieceSvgs = new Set(Object.values(PIECES))
    for (let n = dayNum(2026, 1, 1); n <= dayNum(2027, 12, 31); n++) {
      const date = d(iso(n))
      for (const fam of [null, FAMILY]) {
        const { theme } = resolveTheme(date, fam)
        expect(theme.palette.length, `${iso(n)} ${theme.id}`).toBeGreaterThanOrEqual(11)
        expect(theme.piece.kind).toBe('svg')
        if (theme.piece.kind === 'svg') expect(pieceSvgs.has(theme.piece.svg)).toBe(true)
        expect(theme.winWords.length).toBeGreaterThan(0)
      }
    }
  })

  it('allThemes have unique ids and valid palettes', () => {
    const ids = allThemes().map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of allThemes()) {
      expect(t.palette.length).toBeGreaterThanOrEqual(11)
      expect(themeById(t.id)).toBe(t)
    }
  })

  it('facts are short and link to https sources', () => {
    for (const t of allThemes()) {
      if (!t.fact?.link) continue
      expect(t.fact.link.url.startsWith('https://')).toBe(true)
      expect(t.fact.body.length).toBeLessThan(330)
    }
  })
})

describe('pieces and palettes', () => {
  it('pieces are self-contained SVGs', () => {
    expect(Object.keys(PIECES).length).toBeGreaterThanOrEqual(30)
    for (const [k, s] of Object.entries(PIECES)) {
      expect(s.startsWith('<svg'), k).toBe(true)
      expect(s).toContain('viewBox="0 0 100 100"')
      expect(s).not.toMatch(/<svg[^>]*\s(width|height)=/)
      expect(s).not.toContain('id=')
      expect(s).not.toContain('NaN')
    }
  })

  const lum = (h: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  // "redmean" perceptual-ish distance
  const dist = (a: string, b: string) => {
    const [r1, g1, b1] = rgb(a)
    const [r2, g2, b2] = rgb(b)
    const rm = (r1 + r2) / 2
    return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
  }

  it('palettes keep a white X readable and colours distinct', () => {
    for (const [name, pal] of Object.entries(PALETTES)) {
      expect(pal.length, name).toBeGreaterThanOrEqual(11)
      for (const c of pal) {
        expect(c, name).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(1.05 / (lum(c) + 0.05), `${name} ${c}`).toBeGreaterThanOrEqual(1.7)
      }
      for (let i = 0; i < pal.length; i++)
        for (let j = i + 1; j < pal.length; j++)
          expect(dist(pal[i], pal[j]), `${name} ${pal[i]} ${pal[j]}`).toBeGreaterThan(55)
    }
  })
})

describe('family birthdays', () => {
  it('a birthday week is the 7 days ending on the birthday', () => {
    expect(resolveTheme(d('2026-01-23'), FAMILY).theme.id).not.toBe('birthday-alex')
    for (const day of ['2026-01-24', '2026-01-27', '2026-01-30']) {
      expect(resolveTheme(d(day), FAMILY).theme.id).toBe('birthday-alex')
    }
    expect(resolveTheme(d('2026-01-31'), FAMILY).theme.id).not.toBe('birthday-alex')
  })

  it('personal beats holidays (Burns Night inside a birthday week)', () => {
    const r = resolveTheme(d('2026-01-25'), FAMILY)
    expect(r.theme.id).toBe('birthday-alex')
    expect(r.countdowns).toContain('Also today: Burns Night 🏴󠁧󠁢󠁳󠁣󠁴󠁿')
  })

  it('writes countdown and big-day text with correct ages', () => {
    const before = resolveTheme(d('2026-01-27'), FAMILY)
    expect(before.theme.tagline).toBe('Alex turns 13 in 3 days 🎂')
    expect(before.isBigDay).toBe(false)
    expect(resolveTheme(d('2026-01-29'), FAMILY).theme.tagline).toBe('Alex turns 13 tomorrow 🎂')
    const day = resolveTheme(d('2026-01-30'), FAMILY)
    expect(day.theme.tagline).toBe("It's Alex's birthday! 13 today 🎉")
    expect(day.isBigDay).toBe(true)
  })

  it('overlapping weeks: the nearest birthday owns the theme, others become countdowns', () => {
    // Sam 16 May, Kit 21 May – both weeks cover 15–16 May
    const r = resolveTheme(d('2026-05-15'), FAMILY)
    expect(r.theme.id).toBe('birthday-sam')
    expect(r.countdowns).toContain('Kit turns 15 in 6 days 🎂')
    expect(resolveTheme(d('2026-05-17'), FAMILY).theme.id).toBe('birthday-kit')
  })

  it('handles year rollover (5 Jan viewed from 31 Dec)', () => {
    const r = resolveTheme(d('2026-12-31'), FAMILY)
    expect(r.countdowns).toContain('Robin turns 9 in 5 days 🎂')
    const ny = resolveTheme(d('2027-01-01'), FAMILY)
    expect(ny.theme.id).toBe('birthday-robin')
    expect(ny.theme.tagline).toBe('Robin turns 9 in 4 days 🎂')
  })

  it("gives Nicola's week the Birthday Queen treatment", () => {
    const r = resolveTheme(d('2026-11-18'), FAMILY)
    expect(r.theme.id).toBe('birthday-queen')
    expect(r.theme.palette).toEqual(PALETTES.queen)
    expect(r.theme.winWords).toContain('Birthday Queen!')
    expect(r.theme.tagline).toContain('3 days to go')
    const day = resolveTheme(d('2026-11-21'), FAMILY)
    expect(day.isBigDay).toBe(true)
    expect(day.theme.tagline).toContain('Happy birthday, Nicola!')
  })

  it('no family data means no personal themes', () => {
    const r = resolveTheme(d('2026-01-30'), null)
    expect(r.theme.id.startsWith('birthday')).toBe(false)
    expect(r.isBigDay).toBe(false)
  })
})

describe('special dates', () => {
  it('31 Dec merges the special with New Year’s Eve', () => {
    const r = resolveTheme(d('2026-12-31'), FAMILY)
    expect(r.isBigDay).toBe(true)
    expect(r.theme.name).toBe('Two reasons to celebrate')
    expect(r.theme.tagline).toBe('Test special message ❤️')
    expect(r.theme.palette).toEqual(PALETTES.nye)
    expect(r.theme.piece).toEqual({ kind: 'svg', svg: PIECES.firework })
    expect(r.theme.fact?.title).toBe('Hogmanay')
    expect(r.countdowns[0]).toBe("Also today: New Year's Eve 🎆")
  })

  it('without family data 31 Dec is plain NYE', () => {
    const r = resolveTheme(d('2026-12-31'), null)
    expect(r.theme.id).toBe('nye')
    expect(r.isBigDay).toBe(false)
  })

  it('specials show a countdown in the days before', () => {
    const r = resolveTheme(d('2026-12-28'), FAMILY)
    expect(r.countdowns).toContain('Two reasons to celebrate in 3 days ❤️')
  })
})

describe('override and upcoming', () => {
  it('a manual pick wins but countdowns remain', () => {
    const r = resolveTheme(d('2026-01-27'), FAMILY, 'classic')
    expect(r.theme.id).toBe('classic')
    const bad = resolveTheme(d('2026-02-03'), null, 'nope')
    expect(bad.theme.id).toBe('season-feb')
  })

  it('lists what is coming up, in date order', () => {
    const list = upcoming(d('2026-12-20'), FAMILY, 20)
    const titles = list.map((u) => u.title)
    expect(titles).toContain('Christmas Day')
    expect(titles).toContain("New Year's Eve")
    expect(titles).toContain('Two reasons to celebrate')
    expect(titles).toContain("Robin's birthday (9)")
    const dates = list.map((u) => u.date)
    expect([...dates].sort()).toEqual(dates)
    expect(list.every((u) => u.date >= '2026-12-20' && u.date < '2027-01-09')).toBe(true)
  })

  it('upcoming defaults to 60 days and includes her birthday', () => {
    const list = upcoming(d('2026-09-27'), FAMILY)
    expect(list.some((u) => u.themeId === 'birthday-queen')).toBe(true)
    expect(list.some((u) => u.title === 'Halloween')).toBe(true)
  })
})

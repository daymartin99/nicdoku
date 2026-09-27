// The theme calendar: which theme is showing today, what's coming up, and the
// list of themes she can pick by hand. Everything here is pure and synchronous.
//
// Priority for a given day:
//   personal (family birthday weeks, special dates)
//   > holidays > fun/awareness days > multi-day weeks > seasonal ranges
//   > month fallback (so every day has something).
//
// Facts: only things we're confident are true. Each has a link to a reputable
// source; the full list with claims lives in facts-sources.md for checking.

import type { FamilyData, FamilyMember, Fact, ResolvedTheme, SpecialDate, Theme } from './types'
import { PIECES, DEFAULT_PIECE } from './pieces'
import { PALETTES } from './palettes'

/** Nicola – her own birthday week gets the royal treatment. */
export const HER_NAME = 'Nicola'

// ---------------------------------------------------------------------------
// Date helpers (all dates are local calendar days; maths done on UTC day numbers
// so DST never shifts anything).

const DAY_MS = 86_400_000

/** days since 1970-01-01 for a calendar date (month 1–12) */
export function dayNum(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

function dayOf(date: Date): number {
  return dayNum(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function isoOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

function ymdOf(n: number): { y: number; m: number; d: number } {
  const dt = new Date(n * DAY_MS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Easter Sunday (Anonymous Gregorian algorithm). Returns month 1–12 and day. */
export function easterSunday(y: number): { m: number; d: number } {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31)
  const day = ((h + l - 7 * mm + 114) % 31) + 1
  return { m: month, d: day }
}

/**
 * nth weekday of a month. weekday 0 = Sunday … 6 = Saturday.
 * n = 1..5 for first..fifth, -1 for last.
 */
export function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  if (n < 0) {
    const last = daysInMonth(y, m)
    const wl = new Date(Date.UTC(y, m - 1, last)).getUTCDay()
    return dayNum(y, m, last - ((wl - weekday + 7) % 7))
  }
  const w1 = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  return dayNum(y, m, 1 + ((weekday - w1 + 7) % 7) + (n - 1) * 7)
}

// ---------------------------------------------------------------------------
// Calendar entries

type Tier = 'holiday' | 'fun' | 'week' | 'range'
const TIER_RANK: Record<Tier, number> = { holiday: 4, fun: 3, week: 2, range: 1 }

type Rule =
  | { t: 'fixed'; m: number; d: number }
  | { t: 'nth'; m: number; wd: number; n: number }
  | { t: 'easter'; off: number; len?: number }
  | { t: 'range'; m: number; d: number; m2: number; d2: number }

type Entry = {
  id: string
  name: string
  emoji: string
  tier: Tier
  rule: Rule
  piece: string
  palette: string
  winWords: string[]
  tagline: string
  fact?: Fact
  /** made-up in-joke day – no real facts */
  joke?: boolean
  bg?: string
  accent?: string
}

const SUN = 0
const MON = 1
const FRI = 5

const fixed = (m: number, d: number): Rule => ({ t: 'fixed', m, d })
const nth = (m: number, wd: number, n: number): Rule => ({ t: 'nth', m, wd, n })
const easter = (off: number, len?: number): Rule => ({ t: 'easter', off, len })
const range = (m: number, d: number, m2: number, d2: number): Rule => ({ t: 'range', m, d, m2, d2 })

const wiki = (page: string, label = 'Wikipedia') => ({ label, url: `https://en.wikipedia.org/wiki/${page}` })
const un = (slug: string) => ({ label: 'United Nations', url: `https://www.un.org/en/observances/${slug}` })
const GOV_BH = { label: 'GOV.UK', url: 'https://www.gov.uk/bank-holidays' }
const RBL = { label: 'Royal British Legion', url: 'https://www.britishlegion.org.uk/' }

const jokeFact = (what: string): Fact => ({
  title: 'Is this a real day?',
  body: `Nope – ${what} is completely made up, just for you. No facts here, only vibes.`,
})

/** Order matters only as a tie-break inside a tier (earlier wins). */
const ENTRIES: Entry[] = [
  // ----- January
  {
    id: 'new-year', name: "New Year's Day", emoji: '🥂', tier: 'holiday', rule: fixed(1, 1),
    piece: 'champagne', palette: 'nye',
    winWords: ['Cheers!', 'Fresh start!', 'Hello, new year!', 'Sparkling!'],
    tagline: 'Happy New Year! A fresh grid for a fresh year ✨',
    fact: {
      title: "New Year's Day",
      body: "New Year's Day became a bank holiday in England, Wales and Northern Ireland in 1974. Scotland gets 2 January off as well.",
      link: wiki('Public_holidays_in_the_United_Kingdom'),
    },
  },
  {
    id: 'twelfth-night', name: 'Twelfth Night', emoji: '⭐', tier: 'fun', rule: fixed(1, 5),
    piece: 'star', palette: 'winter',
    winWords: ['Twinkly!', 'Stellar!', 'All done!'],
    tagline: 'Decorations down day (some say tomorrow – we won’t tell) ⭐',
    fact: {
      title: 'Twelfth Night',
      body: 'Twelfth Night marks the end of the twelve days of Christmas. Tradition says decorations should come down by then, or it’s bad luck.',
      link: wiki('Twelfth_Night_(holiday)'),
    },
  },
  {
    id: 'blue-monday', name: 'Blue Monday', emoji: '🌈', tier: 'fun', rule: nth(1, MON, 3),
    piece: 'rainbow', palette: 'default',
    winWords: ['Not blue at all!', 'Sunshine!', 'Brilliant!'],
    tagline: 'Supposedly the gloomiest day of the year. We disagree 🌈',
    fact: {
      title: 'Blue Monday is made up (really)',
      body: "'Blue Monday' began as a 2005 press release for a UK travel company. There's no real science behind it – so be kind to yourself anyway.",
      link: wiki('Blue_Monday_(date)'),
    },
  },
  {
    id: 'hug-day', name: 'Hug Day', emoji: '🤗', tier: 'fun', rule: fixed(1, 21),
    piece: 'bean', palette: 'pastel',
    winWords: ['Squeeze!', 'Cosy!', 'Huggable!'],
    tagline: 'Go and claim a hug. That’s an order 🤗',
  },
  {
    id: 'burns-night', name: 'Burns Night', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tier: 'holiday', rule: fixed(1, 25),
    piece: 'thistle', palette: 'winter',
    winWords: ['Braw!', 'Bonnie!', 'Magic!'],
    tagline: 'Haggis, neeps and tatties – and a puzzle 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    fact: {
      title: 'Burns Night',
      body: "Robert Burns, Scotland's national poet, was born on 25 January 1759 in Alloway, Ayrshire. Burns suppers feature haggis and a reading of his poem 'Address to a Haggis'.",
      link: wiki('Burns_supper'),
    },
  },

  // ----- February
  {
    id: 'pizza-day', name: 'National Pizza Day', emoji: '🍕', tier: 'fun', rule: fixed(2, 9),
    piece: 'pizza', palette: 'summer',
    winWords: ['Cheesy!', 'Delizioso!', 'A slice of genius!'],
    tagline: 'Pizza for tea? It would be rude not to 🍕',
    fact: {
      title: 'Pizza',
      body: "The art of the Neapolitan pizza-maker was added to UNESCO's Intangible Cultural Heritage list in 2017. A Margherita's toppings match the Italian flag: red tomato, white mozzarella, green basil.",
      link: wiki('Neapolitan_pizza'),
    },
  },
  {
    id: 'pancake-day', name: 'Pancake Day', emoji: '🥞', tier: 'holiday', rule: easter(-47),
    piece: 'pancake', palette: 'autumn',
    winWords: ['Flippin’ brilliant!', 'Stacked!', 'Tossed it!'],
    tagline: 'Lemon and sugar or Nutella? Choose wisely 🥞',
    fact: {
      title: 'Shrove Tuesday',
      body: "Shrove Tuesday is the day before Ash Wednesday, when Lent begins. 'Shrove' comes from 'shrive', an old word meaning to confess. Pancakes used up eggs, butter and milk before the Lent fast.",
      link: wiki('Shrove_Tuesday'),
    },
  },
  {
    id: 'valentines', name: "Valentine's Day", emoji: '💘', tier: 'holiday', rule: fixed(2, 14),
    piece: 'heart', palette: 'valentine',
    winWords: ['Lovely!', 'Heart-eyes!', 'Swoon!', 'Adorable!'],
    tagline: 'Sending you all the love today 💘',
    fact: {
      title: "Valentine's Day",
      body: "The day is named after St Valentine, an early Christian martyr. Geoffrey Chaucer's 14th-century poem 'Parlement of Foules' is one of the earliest writings to link it with romance.",
      link: wiki('Valentine%27s_Day'),
    },
  },
  {
    id: 'leap-day', name: 'Leap Day', emoji: '🐸', tier: 'fun', rule: fixed(2, 29),
    piece: 'frog', palette: 'spring',
    winWords: ['Ribbit!', 'Leapin’ lovely!', 'Hop-tastic!'],
    tagline: 'A bonus day! Only comes round every four years 🐸',
    fact: {
      title: 'Why leap years?',
      body: 'A year is about 365¼ days long, so we add an extra day every four years. Without it, the calendar would slowly drift away from the seasons.',
      link: wiki('Leap_year'),
    },
  },

  // ----- March
  {
    id: 'st-davids', name: "St David's Day", emoji: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', tier: 'holiday', rule: fixed(3, 1),
    piece: 'daffodil', palette: 'spring',
    winWords: ['Tidy!', 'Lush!', 'Da iawn!'],
    tagline: 'Dydd Gŵyl Dewi Hapus! 🌼',
    fact: {
      title: "St David's Day",
      body: 'St David (Dewi Sant) is the patron saint of Wales, and is traditionally said to have died on 1 March 589. People wear daffodils or leeks, the national emblems of Wales.',
      link: wiki('Saint_David%27s_Day'),
    },
  },
  {
    id: 'womens-day', name: "International Women's Day", emoji: '💜', tier: 'fun', rule: fixed(3, 8),
    piece: 'blossom', palette: 'valentine',
    winWords: ['Queen!', 'Unstoppable!', 'Iconic!'],
    tagline: 'Celebrating brilliant women – starting with you 💜',
    fact: {
      title: "International Women's Day",
      body: "The first International Women's Day rallies were held in 1911 in Austria, Denmark, Germany and Switzerland. The United Nations began marking it in 1975.",
      link: un('womens-day'),
    },
  },
  {
    id: 'pi-day', name: 'Pi Day', emoji: '🥧', tier: 'fun', rule: fixed(3, 14),
    piece: 'pie', palette: 'autumn',
    winWords: ['Easy as pie!', 'Irrational(ly good)!', 'Nerd!'],
    tagline: '3.14159… and a slice of pie 🥧',
    fact: {
      title: 'Pi Day',
      body: "Pi Day is 14 March because in the US the date is written 3/14, like pi's first digits. It's also Albert Einstein's birthday – he was born on 14 March 1879.",
      link: wiki('Pi_Day'),
    },
  },
  {
    id: 'st-patricks', name: "St Patrick's Day", emoji: '☘️', tier: 'holiday', rule: fixed(3, 17),
    piece: 'clover', palette: 'spring',
    winWords: ['Lucky!', 'Grand!', 'Deadly!'],
    tagline: 'Luck of the Irish to you ☘️',
    fact: {
      title: "St Patrick's Day",
      body: "St Patrick is the patron saint of Ireland, and 17 March is traditionally the date of his death. It's a bank holiday in Northern Ireland and in the Republic of Ireland.",
      link: wiki('Saint_Patrick%27s_Day'),
    },
  },
  {
    id: 'happiness-day', name: 'Day of Happiness', emoji: '😊', tier: 'fun', rule: fixed(3, 20),
    piece: 'smiley', palette: 'default',
    winWords: ['Happy!', 'Joyful!', 'Grinning!'],
    tagline: 'Officially a happy day. UN’s orders 😊',
    fact: {
      title: 'International Day of Happiness',
      body: 'The United Nations created the International Day of Happiness, first celebrated in 2013. It falls on 20 March every year.',
      link: un('happiness-day'),
    },
  },
  {
    id: 'poetry-day', name: 'World Poetry Day', emoji: '📖', tier: 'fun', rule: fixed(3, 21),
    piece: 'book', palette: 'pastel',
    winWords: ['Poetic!', 'Lyrical!', 'Verse-atile!'],
    tagline: 'Roses are red, this grid is too… 📖',
    fact: {
      title: 'World Poetry Day',
      body: 'UNESCO chose 21 March as World Poetry Day in 1999.',
      link: un('world-poetry-day'),
    },
  },
  {
    id: 'mothering-sunday', name: 'Mothering Sunday', emoji: '💐', tier: 'holiday', rule: easter(-21),
    piece: 'blossom', palette: 'pastel',
    winWords: ['Lovely!', 'Blooming marvellous!', 'Super mum!'],
    tagline: 'Happy Mother’s Day to a brilliant mum 💐',
    fact: {
      title: 'Mothering Sunday',
      body: "Mothering Sunday is the fourth Sunday of Lent, so it moves with Easter. It began as a day to visit your 'mother church' – the main church or cathedral of your area.",
      link: wiki('Mothering_Sunday'),
    },
  },
  {
    id: 'clocks-forward', name: 'Clocks Go Forward', emoji: '⏰', tier: 'fun', rule: nth(3, SUN, -1),
    piece: 'clock', palette: 'spring',
    winWords: ['Right on time!', 'Tick tock!', 'Springy!'],
    tagline: 'One less hour in bed – but lighter evenings! ⏰',
    fact: {
      title: 'British Summer Time',
      body: 'British Summer Time was first introduced in 1916, during the First World War. The idea was championed by builder William Willett, who hated seeing summer mornings wasted.',
      link: wiki('British_Summer_Time'),
    },
  },

  // ----- Easter & April
  {
    id: 'easter', name: 'Easter Weekend', emoji: '🐣', tier: 'holiday', rule: easter(-2, 4),
    piece: 'bunny', palette: 'spring',
    winWords: ['Egg-cellent!', 'Hoppy days!', 'Egg-straordinary!', 'Choc-tastic!'],
    tagline: 'Hoppy Easter! Chocolate for breakfast is allowed 🐣',
    fact: {
      title: 'Why Easter moves',
      body: 'Easter is the first Sunday after the first full moon on or after 21 March (worked out with church tables). So it can land anywhere from 22 March to 25 April.',
      link: wiki('Date_of_Easter'),
    },
  },
  {
    id: 'april-fools', name: "April Fools' Day", emoji: '🤡', tier: 'holiday', rule: fixed(4, 1),
    piece: 'bean', palette: 'birthday',
    winWords: ['Gotcha!', 'No joke!', 'Genius (really)!'],
    tagline: 'Trust nothing today. Except this puzzle 🤡',
    fact: {
      title: 'The spaghetti harvest',
      body: "On 1 April 1957 the BBC's Panorama showed a Swiss family harvesting spaghetti from trees. Lots of viewers phoned in asking how to grow their own.",
      link: wiki('Spaghetti-tree_hoax'),
    },
  },
  {
    id: 'earth-day', name: 'Earth Day', emoji: '🌍', tier: 'fun', rule: fixed(4, 22),
    piece: 'globe', palette: 'spring',
    winWords: ['Out of this world!', 'Planet-tastic!', 'Green genius!'],
    tagline: 'Be nice to the planet (and yourself) 🌍',
    fact: {
      title: 'Earth Day',
      body: 'The first Earth Day was held on 22 April 1970 in the United States. It is now marked by people all around the world.',
      link: wiki('Earth_Day'),
    },
  },
  {
    id: 'st-georges', name: "St George's Day", emoji: '🌹', tier: 'holiday', rule: fixed(4, 23),
    piece: 'rose', palette: 'spring',
    winWords: ['Smashing!', 'Top notch!', 'Splendid!'],
    tagline: 'Happy St George’s Day! 🌹',
    fact: {
      title: "St George's Day",
      body: 'St George is the patron saint of England, and 23 April is traditionally the date of his death in AD 303. William Shakespeare also died on 23 April, in 1616.',
      link: wiki('Saint_George%27s_Day_in_England'),
    },
  },

  // ----- May
  {
    id: 'may-day', name: 'May Day', emoji: '🌸', tier: 'fun', rule: fixed(5, 1),
    piece: 'blossom', palette: 'spring',
    winWords: ['Blooming!', 'Maypole magic!', 'Marvellous!'],
    tagline: 'May Day & International Workers’ Day – you’ve earned a break 🌸',
    fact: {
      title: 'May Day',
      body: "May Day has been celebrated in Britain for centuries with maypoles and morris dancing. 1 May is also International Workers' Day, which remembers the 1886 Haymarket affair in Chicago.",
      link: wiki('International_Workers%27_Day'),
    },
  },
  {
    id: 'may-bank-holiday', name: 'Early May Bank Holiday', emoji: '🌷', tier: 'holiday', rule: nth(5, MON, 1),
    piece: 'blossom', palette: 'spring',
    winWords: ['Lie-in earned!', 'Lovely!', 'Long weekend!'],
    tagline: 'Bank holiday Monday! Put your feet up 🌷',
    fact: {
      title: 'Early May bank holiday',
      body: 'The early May bank holiday was first held in 1978. In 2020 it moved to Friday 8 May to mark 75 years since VE Day.',
      link: wiki('Public_holidays_in_the_United_Kingdom'),
    },
  },
  {
    id: 'laughter-day', name: 'World Laughter Day', emoji: '😂', tier: 'fun', rule: nth(5, SUN, 1),
    piece: 'smiley', palette: 'birthday',
    winWords: ['Hilarious!', 'LOL!', 'Giggle-worthy!'],
    tagline: 'Laugh at something silly today 😂',
    fact: {
      title: 'World Laughter Day',
      body: 'World Laughter Day was started in 1998 by Dr Madan Kataria, founder of the laughter yoga movement. It is held on the first Sunday of May.',
      link: wiki('World_Laughter_Day'),
    },
  },
  {
    id: 'may-the-fourth', name: 'May the Fourth', emoji: '🪐', tier: 'fun', rule: fixed(5, 4),
    piece: 'planet', palette: 'nye',
    winWords: ['Forceful!', 'Stellar!', 'Out of this galaxy!'],
    tagline: 'May the Fourth be with you 🪐',
    fact: {
      title: 'May the Fourth',
      body: "'May the Fourth be with you' is a pun on the Star Wars line 'May the Force be with you'. One early sighting was a 1979 London newspaper advert congratulating Margaret Thatcher on becoming Prime Minister.",
      link: wiki('Star_Wars_Day'),
    },
  },
  {
    id: 'nurses-day', name: 'International Nurses Day', emoji: '🩺', tier: 'fun', rule: fixed(5, 12),
    piece: 'heart', palette: 'default',
    winWords: ['Heroic!', 'Caring genius!', 'Brilliant!'],
    tagline: 'Three cheers for nurses 🩺',
    fact: {
      title: 'International Nurses Day',
      body: "International Nurses Day is held on 12 May, Florence Nightingale's birthday. She was born in 1820 in Florence, Italy – which is where her name came from.",
      link: wiki('Florence_Nightingale'),
    },
  },
  {
    id: 'lidlish-day', name: 'Lidl-ish Day (made up!)', emoji: '🛒', tier: 'fun', rule: fixed(5, 15), joke: true,
    piece: 'lidlish', palette: 'default',
    winWords: ['Bargain!', 'Middle-aisle magic!', 'Big shop energy!'],
    tagline: 'A totally made-up day for middle-aisle treasures 🛒',
    fact: jokeFact('Lidl-ish Day'),
  },
  {
    id: 'bee-day', name: 'World Bee Day', emoji: '🐝', tier: 'fun', rule: fixed(5, 20),
    piece: 'bee', palette: 'spring',
    winWords: ['Bee-autiful!', 'Buzzing!', 'Un-bee-lievable!'],
    tagline: 'Buzz buzz! Bee kind today 🐝',
    fact: {
      title: 'World Bee Day',
      body: 'The UN declared 20 May World Bee Day in 2017, and it was first marked in 2018. The date is the birthday of Anton Janša, an 18th-century Slovenian beekeeping pioneer.',
      link: un('bee-day'),
    },
  },
  {
    id: 'towel-day', name: 'Towel Day', emoji: '🧺', tier: 'fun', rule: fixed(5, 25),
    piece: 'towel', palette: 'summer',
    winWords: ['Don’t panic!', 'Hoopy!', '42!'],
    tagline: 'Always know where your towel is 🌌',
    fact: {
      title: 'Towel Day',
      body: "Towel Day is a tribute to Douglas Adams, author of 'The Hitchhiker's Guide to the Galaxy'. It was first held on 25 May 2001, two weeks after he died.",
      link: wiki('Towel_Day'),
    },
  },
  {
    id: 'spring-bank-holiday', name: 'Spring Bank Holiday', emoji: '🌼', tier: 'holiday', rule: nth(5, MON, -1),
    piece: 'bee', palette: 'spring',
    winWords: ['Long weekend!', 'Sunny!', 'Lovely!'],
    tagline: 'Another bank holiday – treat yourself 🌼',
    fact: {
      title: 'Spring bank holiday',
      body: 'The spring bank holiday is the last Monday in May. It replaced Whit Monday, which moved around with the date of Easter.',
      link: wiki('Public_holidays_in_the_United_Kingdom'),
    },
  },

  // ----- June
  {
    id: 'ocean-day', name: 'World Oceans Day', emoji: '🐠', tier: 'fun', rule: fixed(6, 8),
    piece: 'fish', palette: 'summer',
    winWords: ['Fin-tastic!', 'O-fish-ally great!', 'Splash!'],
    tagline: 'Something fishy going on today 🐠',
    fact: {
      title: 'World Oceans Day',
      body: "The UN officially recognised World Oceans Day in 2008. Oceans cover about 71% of the Earth's surface.",
      link: un('oceans-day'),
    },
  },
  {
    id: 'fathers-day', name: "Father's Day", emoji: '👔', tier: 'holiday', rule: nth(6, SUN, 3),
    piece: 'tie', palette: 'summer',
    winWords: ['Dad-tastic!', 'Legend!', 'Top dad!'],
    tagline: 'Happy Father’s Day to all the great dads 👔',
    fact: {
      title: "Father's Day",
      body: 'In the UK, Father’s Day is the third Sunday in June. The idea came from the US, where Sonora Smart Dodd organised one in 1910 to honour her dad, who raised six children on his own.',
      link: wiki('Father%27s_Day'),
    },
  },
  {
    id: 'summer-solstice', name: 'Summer Solstice', emoji: '☀️', tier: 'fun', rule: fixed(6, 21),
    piece: 'sun', palette: 'summer',
    winWords: ['Sunny!', 'Radiant!', 'Glowing!'],
    tagline: 'The longest day (give or take) ☀️',
    fact: {
      title: 'Summer solstice',
      body: 'The summer solstice, on 20 or 21 June, is the longest day of the year in the Northern Hemisphere. Thousands gather at Stonehenge, which lines up with the midsummer sunrise.',
      link: wiki('Stonehenge'),
    },
  },

  // ----- July
  {
    id: 'chocolate-day', name: 'World Chocolate Day', emoji: '🍫', tier: 'fun', rule: fixed(7, 7),
    piece: 'chocolate', palette: 'autumn',
    winWords: ['Choc-tastic!', 'Delicious!', 'Sweet!'],
    tagline: 'Chocolate is basically a food group today 🍫',
    fact: {
      title: 'Chocolate',
      body: 'The Aztecs valued cacao beans so highly they used them as money. In 1824 John Cadbury opened a shop in Birmingham selling tea, coffee and drinking chocolate.',
      link: wiki('History_of_chocolate'),
    },
  },
  {
    id: 'emoji-day', name: 'World Emoji Day', emoji: '📅', tier: 'fun', rule: fixed(7, 17),
    piece: 'smiley', palette: 'birthday',
    winWords: ['😍!', 'Emoji-tional!', '💯!'],
    tagline: 'Speak only in emojis today 😎📅✨',
    fact: {
      title: 'World Emoji Day',
      body: "World Emoji Day was created in 2014 by Jeremy Burge, founder of Emojipedia. 17 July was chosen because it's the date shown on Apple's calendar emoji 📅.",
      link: wiki('World_Emoji_Day'),
    },
  },
  {
    id: 'moon-landing', name: 'Moon Landing Day', emoji: '🌙', tier: 'fun', rule: fixed(7, 20),
    piece: 'moon', palette: 'nye',
    winWords: ['Giant leap!', 'Over the moon!', 'Lunar-tic!'],
    tagline: 'One small step for puzzles… 🌙',
    fact: {
      title: 'Apollo 11',
      body: "On 20 July 1969, Apollo 11's Neil Armstrong and Buzz Aldrin became the first people to land on the Moon.",
      link: wiki('Apollo_11'),
    },
  },
  {
    id: 'summer-holidays', name: 'Summer Holidays', emoji: '🍦', tier: 'range', rule: range(7, 22, 8, 31),
    piece: 'lolly', palette: 'summer',
    winWords: ['Sizzling!', 'Cool as ice!', 'Scorchio!', 'Holiday mode!'],
    tagline: 'School’s out! Sun cream on, puzzles out 🍦',
  },
  {
    id: 'friendship-day', name: 'International Friendship Day', emoji: '🫶', tier: 'fun', rule: fixed(7, 30),
    piece: 'heart', palette: 'pastel',
    winWords: ['Besties!', 'Friend-tastic!', 'Lovely!'],
    tagline: 'Text a friend something nice 🫶',
    fact: {
      title: 'International Day of Friendship',
      body: 'The UN proclaimed 30 July the International Day of Friendship in 2011.',
      link: un('friendship-day'),
    },
  },

  // ----- August
  {
    id: 'yorkshire-day', name: 'Yorkshire Day', emoji: '🤍', tier: 'fun', rule: fixed(8, 1),
    piece: 'whiteRose', palette: 'summer',
    winWords: ['Champion!', 'Grand!', 'Reyt good!'],
    tagline: 'Put the kettle on, it’s Yorkshire Day 🫖',
    fact: {
      title: 'Yorkshire Day',
      body: 'Yorkshire Day has been celebrated on 1 August since 1975. The white rose has been a symbol of Yorkshire since medieval times.',
      link: wiki('Yorkshire_Day'),
    },
  },
  {
    id: 'cat-day', name: 'International Cat Day', emoji: '🚫', tier: 'fun', rule: fixed(8, 8),
    piece: 'noCat', palette: 'default',
    winWords: ['Cat-free!', 'Paws off!', 'Purr-fectly banned!'],
    tagline: 'It’s International Cat Day. The cat is still banned 🚫🐱',
    fact: {
      title: 'International Cat Day',
      body: 'International Cat Day was created in 2002 by the International Fund for Animal Welfare.',
      link: wiki('International_Cat_Day'),
    },
  },
  {
    id: 'left-handers-day', name: 'Left-Handers Day', emoji: '✋', tier: 'fun', rule: fixed(8, 13),
    piece: 'star', palette: 'summer',
    winWords: ['Right on (left on)!', 'Handy!', 'Sinister-ly good!'],
    tagline: 'Try tapping with your other hand today ✋',
    fact: {
      title: 'Left-Handers Day',
      body: 'International Left-Handers Day was first held on 13 August 1976. Roughly one in ten people are left-handed.',
      link: wiki('International_Left-Handers_Day'),
    },
  },
  {
    id: 'photography-day', name: 'World Photography Day', emoji: '📸', tier: 'fun', rule: fixed(8, 19),
    piece: 'camera', palette: 'summer',
    winWords: ['Picture perfect!', 'Snap!', 'Frame-worthy!'],
    tagline: 'Say cheese! 📸',
    fact: {
      title: 'World Photography Day',
      body: 'It marks 19 August 1839, when the French government announced the daguerreotype photography process as a gift free to the world.',
      link: wiki('World_Photography_Day'),
    },
  },
  {
    id: 'summer-bank-holiday', name: 'Summer Bank Holiday', emoji: '🏖️', tier: 'holiday', rule: nth(8, MON, -1),
    piece: 'icedCoffee', palette: 'summer',
    winWords: ['Chill!', 'Iced!', 'Long weekend!'],
    tagline: 'Last bank holiday of summer – iced coffee time 🧋',
    fact: {
      title: 'Summer bank holiday',
      body: 'In England, Wales and Northern Ireland the summer bank holiday is the last Monday in August. In Scotland it is the first Monday in August instead.',
      link: GOV_BH,
    },
  },

  // ----- September
  {
    id: 'roald-dahl-day', name: 'Roald Dahl Day', emoji: '📚', tier: 'fun', rule: fixed(9, 13),
    piece: 'book', palette: 'autumn',
    winWords: ['Whizzpopping!', 'Scrumdiddlyumptious!', 'Phizz-whizzing!'],
    tagline: 'Whizzpopping good fun 📚',
    fact: {
      title: 'Roald Dahl',
      body: "Roald Dahl was born on 13 September 1916 in Llandaff, Cardiff, to Norwegian parents. He wrote 'Matilda', 'The BFG' and 'Charlie and the Chocolate Factory'.",
      link: wiki('Roald_Dahl'),
    },
  },
  {
    id: 'vape-week', name: 'Vape Week (made up!)', emoji: '💨', tier: 'week', rule: range(9, 8, 9, 14), joke: true,
    piece: 'cloud', palette: 'pastel',
    winWords: ['Cloudy genius!', 'Puff-tastic!', 'Big cloud energy!'],
    tagline: 'A completely made-up week in honour of the cloud 💨',
    fact: jokeFact('Vape Week'),
  },
  {
    id: 'peace-day', name: 'International Day of Peace', emoji: '🕊️', tier: 'fun', rule: fixed(9, 21),
    piece: 'rainbow', palette: 'pastel',
    winWords: ['Peaceful!', 'Zen!', 'Calm genius!'],
    tagline: 'Deep breath. Peace and puzzles 🕊️',
    fact: {
      title: 'International Day of Peace',
      body: "The UN's International Day of Peace has been held on 21 September every year since 2002. The Peace Bell at UN headquarters in New York is rung to mark it.",
      link: un('international-day-of-peace'),
    },
  },

  // ----- October
  {
    id: 'coffee-day', name: 'International Coffee Day', emoji: '🧋', tier: 'fun', rule: fixed(10, 1),
    piece: 'icedCoffee', palette: 'autumn',
    winWords: ['Espresso-lent!', 'Brew-tiful!', 'Wide awake!'],
    tagline: 'Iced, hot, or both? Today there are no rules 🧋',
    fact: {
      title: 'International Coffee Day',
      body: 'International Coffee Day was launched by the International Coffee Organization in 2015. Legend says coffee was discovered by an Ethiopian goatherd called Kaldi, whose goats got lively after eating the berries.',
      link: wiki('International_Coffee_Day'),
    },
  },
  {
    id: 'smile-day', name: 'World Smile Day', emoji: '😃', tier: 'fun', rule: nth(10, FRI, 1),
    piece: 'smiley', palette: 'default',
    winWords: ['Beaming!', 'Grinning!', 'Smiley!'],
    tagline: 'Do one kind thing, help one person smile 😃',
    fact: {
      title: 'World Smile Day',
      body: 'World Smile Day was started by Harvey Ball, the American artist who drew the yellow smiley face in 1963. It is held on the first Friday of October.',
      link: wiki('Harvey_Ball'),
    },
  },
  {
    id: 'animal-day', name: 'World Animal Day', emoji: '🐾', tier: 'fun', rule: fixed(10, 4),
    piece: 'hedgehog', palette: 'autumn',
    winWords: ['Pawsome!', 'Wild!', 'Beastly good!'],
    tagline: 'Hug a pet (not the cat, obviously) 🐾',
    fact: {
      title: 'World Animal Day',
      body: 'World Animal Day is held on 4 October, the feast day of St Francis of Assisi, patron saint of animals.',
      link: wiki('World_Animal_Day'),
    },
  },
  {
    id: 'teachers-day', name: "World Teachers' Day", emoji: '🍎', tier: 'fun', rule: fixed(10, 5),
    piece: 'book', palette: 'autumn',
    winWords: ['A+!', 'Top of the class!', 'Gold star!'],
    tagline: 'Gold stars all round 🍎',
    fact: {
      title: "World Teachers' Day",
      body: "UNESCO's World Teachers' Day has been held on 5 October since 1994.",
      link: wiki('World_Teachers%27_Day'),
    },
  },
  {
    id: 'mental-health-day', name: 'World Mental Health Day', emoji: '💚', tier: 'fun', rule: fixed(10, 10),
    piece: 'bean', palette: 'pastel',
    winWords: ['Proud of you!', 'You did it!', 'Gentle genius!'],
    tagline: 'Be gentle with yourself today 💚',
    fact: {
      title: 'World Mental Health Day',
      body: 'World Mental Health Day was first marked in 1992 by the World Federation for Mental Health. Looking after your mind matters as much as your body.',
      link: wiki('World_Mental_Health_Day'),
    },
  },
  {
    id: 'food-day', name: 'World Food Day', emoji: '🍕', tier: 'fun', rule: fixed(10, 16),
    piece: 'pizza', palette: 'autumn',
    winWords: ['Tasty!', 'Delicious!', 'Nom!'],
    tagline: 'Snack break, then puzzle break 🍽️',
    fact: {
      title: 'World Food Day',
      body: 'World Food Day marks the founding of the UN Food and Agriculture Organization on 16 October 1945.',
      link: wiki('World_Food_Day'),
    },
  },
  {
    id: 'clocks-back', name: 'Clocks Go Back', emoji: '🛌', tier: 'fun', rule: nth(10, SUN, -1),
    piece: 'clock', palette: 'autumn',
    winWords: ['Extra hour!', 'Well rested!', 'Timely!'],
    tagline: 'An extra hour in bed! Best Sunday of the year 🛌',
    fact: {
      title: 'Clocks go back',
      body: 'When the clocks go back at the end of October, the UK returns to Greenwich Mean Time (GMT) until spring.',
      link: wiki('British_Summer_Time'),
    },
  },
  {
    id: 'halloween-week', name: 'Spooky Season', emoji: '👻', tier: 'range', rule: range(10, 24, 10, 30),
    piece: 'ghost', palette: 'halloween',
    winWords: ['Boo-tiful!', 'Spooktacular!', 'Ghoulish!'],
    tagline: 'Halloween is coming… boo! 👻',
  },
  {
    id: 'halloween', name: 'Halloween', emoji: '🎃', tier: 'holiday', rule: fixed(10, 31),
    piece: 'pumpkin', palette: 'halloween',
    winWords: ['Spooky!', 'Spooktacular!', 'Frightfully good!', 'Boo-yah!'],
    tagline: 'Trick or treat? Definitely treat 🎃',
    fact: {
      title: 'Halloween',
      body: 'Halloween grew out of Samhain, a Celtic festival marking the end of harvest. In Scotland and Ireland people carved turnips, not pumpkins, into lanterns.',
      link: wiki('Jack-o%27-lantern'),
    },
  },

  // ----- November
  {
    id: 'bonfire-night', name: 'Bonfire Night', emoji: '🎆', tier: 'holiday', rule: fixed(11, 5),
    piece: 'bonfire', palette: 'halloween',
    winWords: ['Explosive!', 'Sparkling!', 'Ooooh! Aaaah!'],
    tagline: 'Remember, remember the fifth of November 🎆',
    fact: {
      title: 'Bonfire Night',
      body: 'Bonfire Night marks the failed Gunpowder Plot of 1605, a plan to blow up Parliament and King James I. Guy Fawkes was caught guarding barrels of gunpowder beneath the House of Lords.',
      link: wiki('Gunpowder_Plot'),
    },
  },
  {
    id: 'remembrance-sunday', name: 'Remembrance Sunday', emoji: '🌺', tier: 'holiday', rule: nth(11, SUN, 2),
    piece: 'poppy', palette: 'remembrance', bg: '#f4efea',
    winWords: ['Well done.', 'Nicely done.', 'Complete.'],
    tagline: 'We will remember them.',
    fact: {
      title: 'Remembrance Sunday',
      body: 'Remembrance Sunday honours those who served and died in the two World Wars and later conflicts. A two-minute silence is held at 11am.',
      link: RBL,
    },
  },
  {
    id: 'armistice-day', name: 'Armistice Day', emoji: '🌺', tier: 'holiday', rule: fixed(11, 11),
    piece: 'poppy', palette: 'remembrance', bg: '#f4efea',
    winWords: ['Well done.', 'Nicely done.', 'Complete.'],
    tagline: 'A moment of quiet at 11 o’clock.',
    fact: {
      title: 'Armistice Day',
      body: "The Armistice that ended the fighting of the First World War took effect at 11am on 11 November 1918. The poppy became a symbol of remembrance thanks to John McCrae's poem 'In Flanders Fields', and the Royal British Legion held its first Poppy Appeal in 1921.",
      link: RBL,
    },
  },
  {
    id: 'kindness-day', name: 'World Kindness Day', emoji: '💛', tier: 'fun', rule: fixed(11, 13),
    piece: 'heart', palette: 'pastel',
    winWords: ['So kind!', 'Lovely!', 'Heart of gold!'],
    tagline: 'Be kind – especially to yourself 💛',
    fact: {
      title: 'World Kindness Day',
      body: 'World Kindness Day was introduced in 1998 by the World Kindness Movement.',
      link: wiki('World_Kindness_Day'),
    },
  },
  {
    id: 'st-andrews', name: "St Andrew's Day", emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tier: 'holiday', rule: fixed(11, 30),
    piece: 'thistle', palette: 'winter',
    winWords: ['Braw!', 'Pure dead brilliant!', 'Magic!'],
    tagline: 'Happy St Andrew’s Day! 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    fact: {
      title: "St Andrew's Day",
      body: "St Andrew is the patron saint of Scotland, and his X-shaped cross – the saltire – is on Scotland's flag. St Andrew's Day became an official bank holiday in Scotland in 2007.",
      link: wiki('Saint_Andrew%27s_Day'),
    },
  },

  // ----- December
  {
    id: 'christmas-countdown', name: 'Christmas Countdown', emoji: '🎄', tier: 'range', rule: range(12, 1, 12, 26),
    piece: 'bauble', palette: 'christmas',
    winWords: ['Cracking!', 'Tree-mendous!', 'Merry!', 'Jolly good!'],
    tagline: 'It’s beginning to look a lot like Christmas 🎄',
  },
  {
    id: 'st-nicholas', name: 'St Nicholas Day', emoji: '🧦', tier: 'fun', rule: fixed(12, 6),
    piece: 'stocking', palette: 'christmas',
    winWords: ['Ho ho ho!', 'Stocking filler!', 'Jolly!'],
    tagline: 'Check your shoes for treats 🧦',
    fact: {
      title: 'St Nicholas',
      body: "St Nicholas was a 4th-century bishop of Myra, in modern-day Turkey, known for secret gift-giving. His Dutch name, Sinterklaas, helped give us 'Santa Claus'.",
      link: wiki('Saint_Nicholas'),
    },
  },
  {
    id: 'winter-solstice', name: 'Winter Solstice', emoji: '🌙', tier: 'fun', rule: fixed(12, 21),
    piece: 'moon', palette: 'winter',
    winWords: ['Cosy!', 'Glowing!', 'Bright spark!'],
    tagline: 'Shortest day (around now) – lighter evenings from here 🌙',
    fact: {
      title: 'Winter solstice',
      body: 'The winter solstice, on 21 or 22 December, is the shortest day of the year in the Northern Hemisphere. After it, the days slowly start getting longer again.',
      link: wiki('Winter_solstice'),
    },
  },
  {
    id: 'christmas-eve', name: 'Christmas Eve', emoji: '🎄', tier: 'holiday', rule: fixed(12, 24),
    piece: 'tree', palette: 'christmas',
    winWords: ['Tree-mendous!', 'Merry!', 'Magical!'],
    tagline: 'Mince pie for Santa, carrot for Rudolph 🥕',
  },
  {
    id: 'christmas', name: 'Christmas Day', emoji: '🎅', tier: 'holiday', rule: fixed(12, 25),
    piece: 'pudding', palette: 'christmas',
    winWords: ['Cracking!', 'Merry Christmas!', 'Sleigh!', 'Jingle-tastic!'],
    tagline: 'Merry Christmas! 🎅',
    fact: {
      title: 'Christmas trees',
      body: "Prince Albert helped make Christmas trees popular in Britain. A picture of Queen Victoria's family around their tree, printed in 1848, started the craze.",
      link: wiki('Christmas_tree'),
    },
  },
  {
    id: 'boxing-day', name: 'Boxing Day', emoji: '🎁', tier: 'holiday', rule: fixed(12, 26),
    piece: 'gift', palette: 'christmas',
    winWords: ['Unwrapped!', 'Cracking!', 'Leftover legend!'],
    tagline: 'Leftovers, sofa, puzzles. Perfect 🎁',
    fact: {
      title: 'Boxing Day',
      body: "Boxing Day became a bank holiday in 1871. Nobody is completely sure where the name comes from – one idea is the 'Christmas box' of money or gifts given to servants and tradespeople.",
      link: wiki('Boxing_Day'),
    },
  },
  {
    id: 'twixmas', name: 'Twixmas', emoji: '🛋️', tier: 'range', rule: range(12, 27, 12, 30),
    piece: 'moon', palette: 'winter',
    winWords: ['Cosy!', 'Snug!', 'What day is it?!'],
    tagline: 'What day is it? Nobody knows. Have a puzzle 🛋️',
  },
  {
    id: 'nye', name: "New Year's Eve", emoji: '🎆', tier: 'holiday', rule: fixed(12, 31),
    piece: 'firework', palette: 'nye',
    winWords: ['Sparkling!', 'Cheers!', 'Explosive!', 'Bang on!'],
    tagline: 'Out with the old, in with the new 🎆',
    fact: {
      title: 'Hogmanay',
      body: "In Scotland New Year's Eve is called Hogmanay. 'Auld Lang Syne', sung at midnight, comes from words Robert Burns wrote down in 1788.",
      link: wiki('Hogmanay'),
    },
  },
]

// ---------------------------------------------------------------------------
// Month fallbacks – every day has a theme.

type Season = Omit<Entry, 'tier' | 'rule'>

const SEASONS: Season[] = [
  { id: 'season-jan', name: 'Frosty January', emoji: '❄️', piece: 'snowflake', palette: 'winter',
    winWords: ['Cool!', 'Ice work!', 'Snow joke!'], tagline: 'Frosty mornings, cosy puzzles ❄️' },
  { id: 'season-feb', name: 'Snowy February', emoji: '⛄', piece: 'snowman', palette: 'winter',
    winWords: ['Chilly genius!', 'Snow-tastic!', 'Frosty!'], tagline: 'Nearly spring. Hang in there ⛄' },
  { id: 'season-mar', name: 'Early Spring', emoji: '🌼', piece: 'daffodil', palette: 'spring',
    winWords: ['Blooming!', 'Fresh!', 'Sprung!'], tagline: 'Daffodils are up – spring is coming 🌼' },
  { id: 'season-apr', name: 'April Blossom', emoji: '🌸', piece: 'blossom', palette: 'spring',
    winWords: ['Blossoming!', 'Lovely!', 'Petal power!'], tagline: 'Showers and flowers 🌸' },
  { id: 'season-may', name: 'Buzzy May', emoji: '🐝', piece: 'bee', palette: 'spring',
    winWords: ['Buzzing!', 'Bee-rilliant!', 'Sweet!'], tagline: 'Longer days, busy bees 🐝' },
  { id: 'season-jun', name: 'Sunny June', emoji: '☀️', piece: 'sun', palette: 'summer',
    winWords: ['Sunny!', 'Glowing!', 'Hot stuff!'], tagline: 'Sunshine and puzzles ☀️' },
  { id: 'season-jul', name: 'High Summer', emoji: '🍦', piece: 'lolly', palette: 'summer',
    winWords: ['Cool!', 'Scorchio!', 'Refreshing!'], tagline: 'Grab an ice lolly and a puzzle 🍦' },
  { id: 'season-aug', name: 'Late Summer', emoji: '🧋', piece: 'icedCoffee', palette: 'summer',
    winWords: ['Iced!', 'Chill!', 'Sip sip hooray!'], tagline: 'Iced coffee weather 🧋' },
  { id: 'season-sep', name: 'Early Autumn', emoji: '🍂', piece: 'leaf', palette: 'autumn',
    winWords: ['Crunchy!', 'Golden!', 'Leaf it to you!'], tagline: 'Crunchy leaves season 🍂' },
  { id: 'season-oct', name: 'Golden October', emoji: '🍁', piece: 'leaf', palette: 'autumn',
    winWords: ['Golden!', 'Toasty!', 'Cosy!'], tagline: 'Jumper weather 🍁' },
  { id: 'season-nov', name: 'Cosy November', emoji: '🦔', piece: 'hedgehog', palette: 'autumn',
    winWords: ['Snug!', 'Prickly-perfect!', 'Cosy!'], tagline: 'Blankets, tea and puzzles 🦔' },
  { id: 'season-dec', name: 'Wintry December', emoji: '⛄', piece: 'snowman', palette: 'winter',
    winWords: ['Frosty!', 'Cool!', 'Snow-tastic!'], tagline: 'Wrap up warm ⛄' },
]

// Templates for personal days and manual picks.

const CLASSIC: Season = {
  id: 'classic', name: 'Classic', emoji: '🫘', piece: DEFAULT_PIECE, palette: 'default',
  winWords: ['Brilliant!', 'Nailed it!', 'Genius!', 'Superb!', 'Yesss!'],
  tagline: 'A little puzzle break, just for you',
}

const COLOURBLIND: Season = {
  id: 'colourblind', name: 'Clear Colours', emoji: '👁️', piece: 'star', palette: 'colourblind',
  winWords: ['Brilliant!', 'Clear win!', 'Genius!'],
  tagline: 'Extra-distinct colours',
}

const BIRTHDAY: Season = {
  id: 'birthday', name: 'Birthday', emoji: '🎂', piece: 'balloon', palette: 'birthday',
  winWords: ['Party time!', 'Hip hip hooray!', 'Cake-tastic!', 'Birthday genius!'],
  tagline: 'Birthday week! 🎈',
}

const QUEEN: Season = {
  id: 'birthday-queen', name: 'Birthday Queen', emoji: '👑', piece: 'crown', palette: 'queen',
  bg: '#fbf1f7', accent: '#c2549a',
  winWords: ['Birthday Queen!', 'Iconic!', 'Slay!', 'Queen of the grid!', 'Royally brilliant!', 'Flawless!'],
  tagline: 'Birthday Queen week 👑',
}

const SPECIAL: Season = {
  id: 'special', name: 'Special Day', emoji: '❤️', piece: 'heart', palette: 'valentine',
  winWords: ['Lovely!', 'Perfect!', 'Beautiful!'],
  tagline: 'A special day ❤️',
}

function toTheme(e: Season): Theme {
  const svg = PIECES[e.piece] ?? PIECES[DEFAULT_PIECE]
  const palette = PALETTES[e.palette] ?? PALETTES.default
  const t: Theme = {
    id: e.id,
    name: e.name,
    piece: { kind: 'svg', svg },
    palette,
    winWords: e.winWords,
    tagline: e.tagline,
  }
  if (e.bg) t.bg = e.bg
  if (e.accent) t.accent = e.accent
  if (e.fact) t.fact = e.fact
  return t
}

const ENTRY_THEMES = new Map<string, Theme>(ENTRIES.map((e) => [e.id, toTheme(e)]))
const SEASON_THEMES = SEASONS.map(toTheme)
const EXTRA_THEMES = [CLASSIC, COLOURBLIND, BIRTHDAY, QUEEN, SPECIAL].map(toTheme)
const ALL: Theme[] = [...EXTRA_THEMES, ...ENTRY_THEMES.values(), ...SEASON_THEMES]
const BY_ID = new Map(ALL.map((t) => [t.id, t]))

/** Every theme, for manual picking in Settings. */
export function allThemes(): Theme[] {
  return ALL.slice()
}

export function themeById(id: string): Theme | undefined {
  return BY_ID.get(id)
}

/** Number of hand-authored calendar entries (excluding month fallbacks). */
export const ENTRY_COUNT = ENTRIES.length

// ---------------------------------------------------------------------------
// Occurrence index: for a year, which entries fall on which day.

const yearCache = new Map<number, Map<number, Entry[]>>()

function occurrences(e: Entry, y: number): { start: number; len: number } | null {
  const r = e.rule
  switch (r.t) {
    case 'fixed':
      if (r.d > daysInMonth(y, r.m)) return null // e.g. 29 Feb in a non-leap year
      return { start: dayNum(y, r.m, r.d), len: 1 }
    case 'nth':
      return { start: nthWeekday(y, r.m, r.wd, r.n), len: 1 }
    case 'easter': {
      const es = easterSunday(y)
      return { start: dayNum(y, es.m, es.d) + r.off, len: r.len ?? 1 }
    }
    case 'range': {
      const start = dayNum(y, r.m, r.d)
      return { start, len: dayNum(y, r.m2, r.d2) - start + 1 }
    }
  }
}

function yearIndex(y: number): Map<number, Entry[]> {
  let idx = yearCache.get(y)
  if (idx) return idx
  idx = new Map()
  for (const e of ENTRIES) {
    const o = occurrences(e, y)
    if (!o) continue
    for (let i = 0; i < o.len; i++) {
      const list = idx.get(o.start + i) ?? []
      list.push(e)
      idx.set(o.start + i, list)
    }
  }
  // highest tier first; stable sort keeps list order as the tie-break
  for (const list of idx.values()) list.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])
  yearCache.set(y, idx)
  return idx
}

function entriesOn(n: number): Entry[] {
  return yearIndex(ymdOf(n).y).get(n) ?? []
}

function startsOn(n: number): Entry[] {
  const y = ymdOf(n).y
  return ENTRIES.filter((e) => occurrences(e, y)?.start === n)
}

// ---------------------------------------------------------------------------
// Personal events

type PersonalEvent =
  | { kind: 'birthday'; n: number; days: number; member: FamilyMember; age: number; isHer: boolean }
  | { kind: 'special'; n: number; days: number; special: SpecialDate }

const isHer = (m: FamilyMember) => m.name.trim().toLowerCase() === HER_NAME.toLowerCase()

/** next occurrence (on or after `from`) of a month/day; 29 Feb falls back to 28 Feb */
function nextOccurrence(month: number, day: number, from: number): { n: number; y: number } {
  const y0 = ymdOf(from).y
  for (let y = y0; y <= y0 + 1; y++) {
    const d = Math.min(day, daysInMonth(y, month))
    const n = dayNum(y, month, d)
    if (n >= from) return { n, y }
  }
  // unreachable, but keep TS happy
  return { n: dayNum(y0 + 1, month, day), y: y0 + 1 }
}

function parseMD(s: string): { m: number; d: number } | null {
  const parts = s.split('-').map(Number)
  if (parts.length < 2) return null
  const [m, d] = parts.slice(-2)
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  return { m, d }
}

function personalEvents(today: number, family: FamilyData | null, horizon: number): PersonalEvent[] {
  if (!family) return []
  const out: PersonalEvent[] = []
  for (const member of family.members ?? []) {
    const parts = (member.birthday ?? '').split('-').map(Number)
    if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) continue
    const [by, bm, bd] = parts
    const { n, y } = nextOccurrence(bm, bd, today)
    const days = n - today
    if (days <= horizon) out.push({ kind: 'birthday', n, days, member, age: y - by, isHer: isHer(member) })
  }
  for (const special of family.specials ?? []) {
    const md = parseMD(special.date ?? '')
    if (!md) continue
    const { n } = nextOccurrence(md.m, md.d, today)
    const days = n - today
    if (days <= horizon) out.push({ kind: 'special', n, days, special })
  }
  out.sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days
    if (a.kind !== b.kind) return a.kind === 'birthday' ? -1 : 1
    if (a.kind === 'birthday' && b.kind === 'birthday') {
      if (a.isHer !== b.isHer) return a.isHer ? -1 : 1
      return a.member.name.localeCompare(b.member.name)
    }
    return 0
  })
  return out
}

function inDays(days: number): string {
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/** The line shown for a personal event (tagline for the owner, countdown for the rest). */
function personalLine(ev: PersonalEvent): string {
  if (ev.kind === 'special') {
    const emoji = ev.special.emoji ?? '❤️'
    return ev.days === 0 ? ev.special.message : `${ev.special.title} ${inDays(ev.days)} ${emoji}`
  }
  const name = ev.member.name
  if (ev.isHer) {
    if (ev.days === 0) return `Happy birthday, ${name}! Today you're the Birthday Queen 👑`
    if (ev.days === 1) return 'Birthday Queen eve! Your birthday is tomorrow 👑'
    return `It's your birthday week, Birthday Queen! ${ev.days} days to go 👑`
  }
  if (ev.days === 0) return `It's ${name}'s birthday! ${ev.age} today 🎉`
  return `${name} turns ${ev.age} ${inDays(ev.days)} 🎂`
}

/** A birthday week lasts 7 days, ending on the birthday (days −6..0). */
const BIRTHDAY_WEEK = 6

// ---------------------------------------------------------------------------
// Resolution

function seasonFor(n: number): Theme {
  return SEASON_THEMES[ymdOf(n).m - 1]
}

function holidayFor(n: number): { theme: Theme; entry: Entry | null; others: Entry[] } {
  const list = entriesOn(n)
  if (list.length === 0) return { theme: seasonFor(n), entry: null, others: [] }
  const [top, ...rest] = list
  // other same-day *days* (not background ranges) get an "Also today" line
  const others = rest.filter((e) => e.tier === 'holiday' || e.tier === 'fun')
  return { theme: ENTRY_THEMES.get(top.id)!, entry: top, others }
}

const alsoToday = (e: Entry) => `Also today: ${e.name} ${e.emoji}`

function birthdayTheme(ev: Extract<PersonalEvent, { kind: 'birthday' }>): Theme {
  const base = ev.isHer ? QUEEN : BIRTHDAY
  const slug = ev.member.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const t = toTheme({
    ...base,
    id: ev.isHer ? 'birthday-queen' : `birthday-${slug}`,
    name: ev.isHer ? 'Birthday Queen' : `${ev.member.name}'s Birthday${ev.days === 0 ? '' : ' Week'}`,
    piece: ev.isHer ? 'crown' : ev.days === 0 ? 'cake' : 'balloon',
    tagline: personalLine(ev),
    winWords: ev.isHer
      ? base.winWords
      : [...base.winWords, `Go ${ev.member.name}!`],
  })
  return t
}

/**
 * The theme for a given day.
 * @param overrideId a theme id she picked by hand; wins over the calendar
 *   (countdown lines still show).
 */
export function resolveTheme(date: Date, family: FamilyData | null, overrideId?: string | null): ResolvedTheme {
  const today = dayOf(date)
  const events = personalEvents(today, family, BIRTHDAY_WEEK)

  // Who can own the day: a birthday within its week, or a special on the day itself.
  const owner = events.find((e) => e.kind === 'birthday' || e.days === 0) ?? null
  const rest = events.filter((e) => e !== owner)
  const countdowns = rest.map(personalLine)
  const isBigDay = events.some((e) => e.days === 0)

  const hol = holidayFor(today)
  let theme: Theme

  if (!owner) {
    theme = hol.theme
    countdowns.push(...hol.others.map(alsoToday))
  } else if (owner.kind === 'birthday') {
    theme = birthdayTheme(owner)
    if (hol.entry && (hol.entry.tier === 'holiday' || hol.entry.tier === 'fun')) countdowns.push(alsoToday(hol.entry))
  } else {
    // Special date: outranks the holiday but merges with it.
    const sp = owner.special
    const isRealDay = hol.entry && (hol.entry.tier === 'holiday' || hol.entry.tier === 'fun')
    const base = isRealDay ? hol.theme : toTheme(SPECIAL)
    const md = parseMD(sp.date)
    theme = {
      ...base,
      id: `special-${md ? `${String(md.m).padStart(2, '0')}-${String(md.d).padStart(2, '0')}` : 'day'}`,
      name: sp.title,
      tagline: sp.message,
      winWords: [...base.winWords, 'Two reasons to smile!', 'Lovely!'],
    }
    if (isRealDay && hol.entry) countdowns.unshift(`Also today: ${hol.entry.name} ${hol.entry.emoji}`)
    countdowns.push(...hol.others.map(alsoToday))
  }

  if (overrideId) {
    const picked = themeById(overrideId)
    if (picked) theme = picked
  }

  return { theme, countdowns, isBigDay }
}

export type Upcoming = { date: string; title: string; emoji: string; themeId: string }

/** "Coming up" list: holidays, fun days, birthdays and specials in the next `days` days (today included). */
export function upcoming(date: Date, family: FamilyData | null, days = 60): Upcoming[] {
  const today = dayOf(date)
  const out: (Upcoming & { n: number; rank: number })[] = []

  for (let n = today; n < today + days; n++) {
    for (const e of startsOn(n)) {
      out.push({ n, rank: 5 - TIER_RANK[e.tier], date: isoOf(n), title: e.name, emoji: e.emoji, themeId: e.id })
    }
  }

  for (const ev of personalEvents(today, family, days - 1)) {
    if (ev.kind === 'birthday') {
      const slug = ev.member.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      out.push({
        n: ev.n,
        rank: 0,
        date: isoOf(ev.n),
        title: ev.isHer ? 'Your birthday!' : `${ev.member.name}'s birthday (${ev.age})`,
        emoji: ev.member.emoji ?? (ev.isHer ? '👑' : '🎂'),
        themeId: ev.isHer ? 'birthday-queen' : `birthday-${slug}`,
      })
    } else {
      out.push({
        n: ev.n,
        rank: 0,
        date: isoOf(ev.n),
        title: ev.special.title,
        emoji: ev.special.emoji ?? '❤️',
        themeId: 'special',
      })
    }
  }

  out.sort((a, b) => a.n - b.n || a.rank - b.rank)
  return out.map(({ date: d, title, emoji, themeId }) => ({ date: d, title, emoji, themeId }))
}

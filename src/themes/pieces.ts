// Hand-authored piece art. Each value is a complete inline <svg> with
// viewBox "0 0 100 100" and no width/height, so it scales to the cell.
// Style: flat, bold, cute, thick dark "sticker" outline, readable at ~28px.
// No ids/defs are used, so many copies can sit on one page safely.

const INK = '#46291f'
const CHEEK = '#ff8fa3'
/** standard thick outline */
const O = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`
/** thinner outline for small details */
const O3 = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`

const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`

const r = (n: number) => Math.round(n * 10) / 10

/** a cute face: shiny eyes, little smile, rosy cheeks. k = scale */
function face(cx: number, cy: number, k = 1, cheeks = true): string {
  const ex = 9 * k
  const er = 4 * k
  const eyes =
    `<circle cx="${r(cx - ex)}" cy="${r(cy)}" r="${r(er)}" fill="${INK}"/>` +
    `<circle cx="${r(cx + ex)}" cy="${r(cy)}" r="${r(er)}" fill="${INK}"/>` +
    `<circle cx="${r(cx - ex + 1.4 * k)}" cy="${r(cy - 1.4 * k)}" r="${r(1.4 * k)}" fill="#fff"/>` +
    `<circle cx="${r(cx + ex + 1.4 * k)}" cy="${r(cy - 1.4 * k)}" r="${r(1.4 * k)}" fill="#fff"/>`
  const smile = `<path d="M${r(cx - 6 * k)} ${r(cy + 7 * k)} Q${r(cx)} ${r(cy + 13 * k)} ${r(cx + 6 * k)} ${r(cy + 7 * k)}" fill="none" stroke="${INK}" stroke-width="${r(3.5 * k)}" stroke-linecap="round"/>`
  const ch = cheeks
    ? `<ellipse cx="${r(cx - 16 * k)}" cy="${r(cy + 6 * k)}" rx="${r(4.5 * k)}" ry="${r(3 * k)}" fill="${CHEEK}" opacity=".85"/>` +
      `<ellipse cx="${r(cx + 16 * k)}" cy="${r(cy + 6 * k)}" rx="${r(4.5 * k)}" ry="${r(3 * k)}" fill="${CHEEK}" opacity=".85"/>`
    : ''
  return eyes + smile + ch
}

/** a white highlight streak for that glossy sticker look */
const shine = (d: string) =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`

/** points of a regular star/burst centred on (cx, cy) */
function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, rot = -90): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
    pts.push(`${r(cx + rad * Math.cos(a))},${r(cy + rad * Math.sin(a))}`)
  }
  return pts.join(' ')
}

/** ring of circles, used for flowers and poppies */
function petals(cx: number, cy: number, dist: number, pr: number, n: number, fill: string, rot = -90): string {
  let s = ''
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180
    s += `<circle cx="${r(cx + dist * Math.cos(a))}" cy="${r(cy + dist * Math.sin(a))}" r="${pr}" fill="${fill}" ${O}/>`
  }
  return s
}

/** a line with a dark outline under a coloured core (for rays, crosses) */
const fatLine = (d: string, colour: string, w = 7) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

function flower(petal: string, centre: string, withFace: boolean, inner?: string): string {
  return svg(
    petals(50, 50, 24, 15, 6, petal) +
      (inner ? petals(50, 50, 11, 9, 6, inner, -60) : '') +
      `<circle cx="50" cy="50" r="${withFace ? 16 : 10}" fill="${centre}" ${O}/>` +
      (withFace ? face(50, 48, 0.62, false) : ''),
  )
}

// ---------------------------------------------------------------------------

/** The default mascot: a smiley little bean with a sprout. Definitely not a cat. */
const bean = svg(
  `<path d="M51 16 C51 10 53 6 57 4" fill="none" ${O}/>` +
    `<path d="M56 9 C61 1 73 1 76 7 C70 14 60 14 56 9Z" fill="#7CC46B" ${O}/>` +
    `<path d="M50 16 C74 16 88 34 86 56 C84 78 68 90 48 88 C28 86 14 74 14 54 C14 32 28 16 50 16Z" fill="#FFE3A3" ${O}/>` +
    shine('M26 40 Q30 29 40 25') +
    face(50, 55),
)

const pumpkin = svg(
  `<path d="M45 30 L46 16 Q52 11 58 15 L55 30Z" fill="#6B8E23" ${O}/>` +
    `<ellipse cx="33" cy="60" rx="21" ry="27" fill="#F28C28" ${O}/>` +
    `<ellipse cx="67" cy="60" rx="21" ry="27" fill="#F28C28" ${O}/>` +
    `<ellipse cx="50" cy="60" rx="21" ry="29" fill="#F7A043" ${O}/>` +
    face(50, 60, 0.9),
)

const ghost = svg(
  `<path d="M22 86 L22 44 C22 24 34 12 50 12 C66 12 78 24 78 44 L78 86 L68 78 L59 86 L50 78 L41 86 L32 78 Z" fill="#FFFFFF" ${O}/>` +
    `<path d="M22 58 C14 56 10 50 12 44" fill="none" ${O}/>` +
    face(50, 44),
)

const pudding = svg(
  `<path d="M16 62 C16 36 32 22 50 22 C68 22 84 36 84 62 C84 78 70 88 50 88 C30 88 16 78 16 62Z" fill="#8B4A2B" ${O}/>` +
    `<path d="M19 48 C23 31 36 22 50 22 C64 22 77 31 81 48 C75 52 72 42 66 48 C60 55 57 44 51 50 C45 56 42 44 36 50 C30 55 27 45 19 48Z" fill="#FFF6E0" ${O}/>` +
    `<path d="M50 22 C44 12 34 11 29 15 C35 21 42 24 50 22Z" fill="#2E8A56" ${O3}/>` +
    `<path d="M50 22 C56 12 66 11 71 15 C65 21 58 24 50 22Z" fill="#2E8A56" ${O3}/>` +
    `<circle cx="45" cy="20" r="5" fill="#D62828" ${O3}/><circle cx="55" cy="20" r="5" fill="#D62828" ${O3}/>` +
    face(50, 66, 0.85),
)

const tree = svg(
  `<rect x="42" y="68" width="16" height="18" rx="3" fill="#8B5A3C" ${O}/>` +
    `<path d="M50 12 L78 44 L66 44 L86 70 L14 70 L34 44 L22 44 Z" fill="#2E8A56" ${O}/>` +
    `<circle cx="28" cy="64" r="5" fill="#D62828" ${O3}/><circle cx="72" cy="64" r="5" fill="#FFC93C" ${O3}/><circle cx="62" cy="36" r="4.5" fill="#4EA8DE" ${O3}/>` +
    `<polygon points="${starPoints(50, 12, 11, 5, 5)}" fill="#FFC93C" ${O3}/>` +
    face(50, 50, 0.75, false),
)

const snowman = svg(
  `<circle cx="50" cy="68" r="23" fill="#FFFFFF" ${O}/>` +
    `<circle cx="50" cy="35" r="18" fill="#FFFFFF" ${O}/>` +
    `<path d="M33 49 Q50 57 67 49 L67 55 Q50 63 33 55Z" fill="#D62828" ${O3}/>` +
    `<path d="M58 56 L62 72 L70 70 L64 55Z" fill="#D62828" ${O3}/>` +
    `<circle cx="43" cy="31" r="3.2" fill="${INK}"/><circle cx="57" cy="31" r="3.2" fill="${INK}"/>` +
    `<path d="M49 37 L62 40 L49 42Z" fill="#F28C28" ${O3}/>` +
    `<path d="M44 44 Q50 47 56 44" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="38" cy="39" rx="3.5" ry="2.4" fill="${CHEEK}"/><ellipse cx="62" cy="39" rx="3.5" ry="2.4" fill="${CHEEK}"/>` +
    `<circle cx="50" cy="67" r="3.2" fill="${INK}"/><circle cx="50" cy="78" r="3.2" fill="${INK}"/>`,
)

const bauble = svg(
  `<circle cx="50" cy="13" r="6" fill="none" ${O3}/>` +
    `<rect x="40" y="18" width="20" height="12" rx="3" fill="#FFC93C" ${O}/>` +
    `<circle cx="50" cy="60" r="30" fill="#D62828" ${O}/>` +
    `<path d="M22 50 Q36 42 50 50 T78 50" fill="none" stroke="#FFF6E0" stroke-width="6" stroke-linecap="round"/>` +
    face(50, 64, 0.9),
)

const sunRays = (() => {
  let s = ''
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180
    const x1 = 50 + 30 * Math.cos(a)
    const y1 = 50 + 30 * Math.sin(a)
    const x2 = 50 + 42 * Math.cos(a)
    const y2 = 50 + 42 * Math.sin(a)
    s += fatLine(`M${r(x1)} ${r(y1)} L${r(x2)} ${r(y2)}`, '#FFB627', 7)
  }
  return s
})()

const sun = svg(sunRays + `<circle cx="50" cy="50" r="26" fill="#FFC93C" ${O}/>` + face(50, 48, 0.95))

const lolly = svg(
  `<rect x="44" y="64" width="12" height="28" rx="6" fill="#E9C38A" ${O}/>` +
    `<path d="M30 22 C30 12 38 8 50 8 C62 8 70 12 70 22 L70 64 C70 68 68 70 64 70 L36 70 C32 70 30 68 30 64Z" fill="#FF6B8B" ${O}/>` +
    `<path d="M30 30 L70 30 L70 22 C70 12 62 8 50 8 C38 8 30 12 30 22Z" fill="#FFD166" ${O}/>` +
    face(50, 46, 0.85),
)

const heart = svg(
  `<path d="M50 86 C20 66 10 50 10 34 C10 20 21 12 32 12 C41 12 47 18 50 24 C53 18 59 12 68 12 C79 12 90 20 90 34 C90 50 80 66 50 86Z" fill="#F0506E" ${O}/>` +
    shine('M22 30 Q24 22 32 21') +
    face(50, 44),
)

const egg = svg(
  `<path d="M50 10 C70 10 84 40 84 60 C84 78 70 90 50 90 C30 90 16 78 16 60 C16 40 30 10 50 10Z" fill="#FFD6E8" ${O}/>` +
    `<path d="M18 50 L27 43 L36 50 L45 43 L54 50 L63 43 L72 50 L81 44" fill="none" stroke="#8E7BDB" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="36" cy="30" r="3.5" fill="#4FB3B0"/><circle cx="56" cy="26" r="3.5" fill="#F7A05E"/>` +
    face(50, 66, 0.85),
)

const bunny = svg(
  `<ellipse cx="36" cy="26" rx="9" ry="21" transform="rotate(-10 36 26)" fill="#FFFFFF" ${O}/>` +
    `<ellipse cx="36" cy="27" rx="4" ry="13" transform="rotate(-10 36 27)" fill="#FFB3C6"/>` +
    `<ellipse cx="64" cy="26" rx="9" ry="21" transform="rotate(10 64 26)" fill="#FFFFFF" ${O}/>` +
    `<ellipse cx="64" cy="27" rx="4" ry="13" transform="rotate(10 64 27)" fill="#FFB3C6"/>` +
    `<circle cx="50" cy="62" r="27" fill="#FFFFFF" ${O}/>` +
    face(50, 60) +
    `<path d="M47 64 L53 64 L50 67Z" fill="#FF8FA3" ${O3}/>`,
)

const pancake = svg(
  `<rect x="12" y="62" width="76" height="18" rx="9" fill="#E9A84F" ${O}/>` +
    `<rect x="14" y="48" width="72" height="18" rx="9" fill="#F4B860" ${O}/>` +
    `<rect x="16" y="34" width="68" height="18" rx="9" fill="#F7C774" ${O}/>` +
    `<path d="M22 38 Q50 30 78 38 L76 46 Q72 54 68 46 Q62 52 58 46 Q52 56 46 46 Q40 50 36 45 Q30 50 26 44Z" fill="#9A4F1E" ${O3}/>` +
    `<rect x="42" y="24" width="16" height="11" rx="2" fill="#FFE66D" ${O3}/>` +
    face(50, 70, 0.6, false),
)

const firework = (() => {
  const cols = ['#FFC93C', '#F0506E', '#4EA8DE', '#8DD67E', '#B38BDB', '#F7A05E']
  let s = ''
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180
    const x1 = 50 + 13 * Math.cos(a)
    const y1 = 50 + 13 * Math.sin(a)
    const x2 = 50 + (i % 2 ? 32 : 40) * Math.cos(a)
    const y2 = 50 + (i % 2 ? 32 : 40) * Math.sin(a)
    s += fatLine(`M${r(x1)} ${r(y1)} L${r(x2)} ${r(y2)}`, cols[i % cols.length], 6)
  }
  return svg(s + `<circle cx="50" cy="50" r="10" fill="#FFF6E0" ${O}/>`)
})()

const champagne = svg(
  `<ellipse cx="50" cy="86" rx="18" ry="6" fill="#EAF6FF" ${O}/>` +
    `<rect x="47" y="56" width="6" height="28" fill="#EAF6FF" ${O3}/>` +
    `<path d="M34 8 L66 8 L63 42 C62 53 57 58 50 58 C43 58 38 53 37 42Z" fill="#EAF6FF" ${O}/>` +
    `<path d="M36 22 L64 22 L63 42 C62 52 57 56 50 56 C43 56 38 52 37 42Z" fill="#FFD95A"/>` +
    `<path d="M34 8 L66 8 L63 42 C62 53 57 58 50 58 C43 58 38 53 37 42Z" fill="none" ${O}/>` +
    `<circle cx="45" cy="34" r="2.5" fill="#fff"/><circle cx="55" cy="42" r="2" fill="#fff"/><circle cx="52" cy="29" r="1.8" fill="#fff"/>` +
    `<polygon points="${starPoints(80, 20, 9, 4, 4)}" fill="#FFC93C" ${O3}/>`,
)

const pizza = svg(
  `<path d="M50 92 L14 24 Q50 6 86 24 Z" fill="#FFD166" ${O}/>` +
    `<path d="M14 24 Q50 6 86 24 L81 34 Q50 20 19 34Z" fill="#D9893B" ${O}/>` +
    `<circle cx="38" cy="46" r="7" fill="#D62828" ${O3}/><circle cx="62" cy="44" r="7" fill="#D62828" ${O3}/><circle cx="50" cy="70" r="6" fill="#D62828" ${O3}/>` +
    `<circle cx="50" cy="52" r="2.5" fill="#2E8A56"/><circle cx="42" cy="62" r="2.5" fill="#2E8A56"/>`,
)

const cake = svg(
  `<rect x="46" y="18" width="8" height="24" rx="2" fill="#4EA8DE" ${O3}/>` +
    `<path d="M50 4 C56 11 56 16 50 18 C44 16 44 11 50 4Z" fill="#FFC93C" ${O3}/>` +
    `<rect x="14" y="42" width="72" height="44" rx="8" fill="#F7A8C4" ${O}/>` +
    `<path d="M14 52 L14 50 C14 45 18 42 22 42 L78 42 C82 42 86 45 86 50 L86 54 C82 60 78 52 74 56 C70 62 66 52 62 57 C58 62 54 52 50 57 C46 62 42 52 38 57 C34 62 30 52 26 56 C22 60 18 52 14 54Z" fill="#FFF6E0" ${O3}/>` +
    face(50, 70, 0.8),
)

const balloon = svg(
  `<path d="M50 74 Q44 84 52 90 Q58 94 50 98" fill="none" ${O3}/>` +
    `<path d="M45 76 L55 76 L50 70Z" fill="#F0506E" ${O3}/>` +
    `<ellipse cx="50" cy="40" rx="28" ry="32" fill="#F0506E" ${O}/>` +
    shine('M32 30 Q34 20 42 16') +
    face(50, 42),
)

const gift = svg(
  `<path d="M50 30 C40 14 26 18 32 28 C36 32 44 31 50 30Z" fill="#FFD166" ${O3}/>` +
    `<path d="M50 30 C60 14 74 18 68 28 C64 32 56 31 50 30Z" fill="#FFD166" ${O3}/>` +
    `<rect x="18" y="42" width="64" height="46" rx="5" fill="#8E7BDB" ${O}/>` +
    `<rect x="14" y="30" width="72" height="16" rx="4" fill="#A493E6" ${O}/>` +
    `<rect x="44" y="30" width="12" height="58" fill="#FFD166" ${O3}/>`,
)

const poppy = svg(
  `<path d="M62 70 Q70 84 76 94" fill="none" stroke="#2E7A3A" stroke-width="6" stroke-linecap="round"/>` +
    petals(50, 46, 16, 20, 4, '#D62828', -45) +
    `<circle cx="50" cy="46" r="11" fill="#2B2B2B" ${O}/>` +
    `<circle cx="46" cy="43" r="1.8" fill="#6B8E23"/><circle cx="54" cy="44" r="1.8" fill="#6B8E23"/><circle cx="50" cy="50" r="1.8" fill="#6B8E23"/>`,
)

const clover = (() => {
  const leaf = `M50 50 C38 42 32 34 32 26 C32 19 38 15 43 15 C47 15 49 18 50 21 C51 18 53 15 57 15 C62 15 68 19 68 26 C68 34 62 42 50 50Z`
  return svg(
    `<path d="M50 52 Q54 74 66 92" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>` +
      `<path d="M50 52 Q54 74 66 92" fill="none" stroke="#2E9E4F" stroke-width="6" stroke-linecap="round"/>` +
      [0, 120, 240].map((a) => `<path d="${leaf}" transform="rotate(${a} 50 50)" fill="#3DBA5E" ${O}/>`).join('') +
      `<circle cx="50" cy="50" r="4" fill="#2E9E4F"/>`,
  )
})()

const daffodil = (() => {
  let p = ''
  for (let i = 0; i < 6; i++) {
    p += `<ellipse cx="50" cy="26" rx="12" ry="20" transform="rotate(${i * 60} 50 50)" fill="#FFD84D" ${O}/>`
  }
  return svg(
    p +
      `<circle cx="50" cy="50" r="16" fill="#F7931E" ${O}/>` +
      `<circle cx="50" cy="50" r="8" fill="#FFB347" ${O3}/>`,
  )
})()

const leaf = svg(
  `<path d="M18 82 C18 40 44 14 86 14 C86 56 60 82 18 82Z" fill="#E07B39" ${O}/>` +
    `<path d="M14 86 L30 70" fill="none" ${O}/>` +
    `<path d="M30 70 Q52 50 70 30" fill="none" stroke="#B5541F" stroke-width="3.5" stroke-linecap="round"/>` +
    face(54, 48, 0.72),
)

const star = svg(
  `<polygon points="${starPoints(50, 54, 44, 21, 5)}" fill="#FFC93C" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
    face(50, 55, 0.85),
)

const snowflake = (() => {
  let s = ''
  for (let i = 0; i < 6; i++) {
    const rot = `rotate(${i * 60} 50 50)`
    s += `<g transform="${rot}">${fatLine('M50 50 L50 12 M50 24 L41 16 M50 24 L59 16', '#8EC9F0', 6)}</g>`
  }
  return svg(s + `<circle cx="50" cy="50" r="12" fill="#DDF1FF" ${O}/>` + face(50, 48, 0.45, false))
})()

/** A supermarket-ish lookalike: blue square, yellow circle, red ring. No text, not the real logo. */
const lidlish = svg(
  `<rect x="10" y="10" width="80" height="80" rx="14" fill="#1F4FA3" ${O}/>` +
    `<circle cx="50" cy="50" r="31" fill="#FFE000" stroke="#E2231A" stroke-width="6"/>` +
    face(50, 48, 0.95),
)

const cloud = svg(
  `<path d="M24 74 C10 74 8 54 22 50 C20 34 40 26 50 36 C56 22 80 24 80 42 C94 42 96 72 78 74 Z" fill="#EDE7F6" ${O}/>` +
    `<path d="M84 26 Q90 20 86 14" fill="none" ${O3}/><path d="M16 30 Q12 24 18 20" fill="none" ${O3}/>` +
    face(52, 56, 0.9),
)

const icedCoffee = svg(
  `<path d="M56 26 L70 4" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M56 26 L70 4" fill="none" stroke="#4FB3B0" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M26 30 L74 30 L68 90 L32 90Z" fill="#B97A4E" ${O}/>` +
    `<path d="M28 44 C38 40 44 48 52 44 C60 40 66 46 72 44 L73 34 L27 34Z" fill="#F3E3CF"/>` +
    `<rect x="34" y="36" width="11" height="11" rx="2" fill="#E6F4FF" ${O3} transform="rotate(-10 39 41)"/>` +
    `<rect x="54" y="38" width="11" height="11" rx="2" fill="#E6F4FF" ${O3} transform="rotate(12 59 43)"/>` +
    `<path d="M20 30 Q50 14 80 30Z" fill="#FFFFFF" ${O}/>` +
    `<path d="M26 30 L74 30 L68 90 L32 90Z" fill="none" ${O}/>` +
    face(50, 66, 0.75),
)

const crown = svg(
  `<path d="M14 76 L18 34 L34 52 L50 22 L66 52 L82 34 L86 76 Z" fill="#FFC93C" ${O}/>` +
    `<rect x="14" y="70" width="72" height="14" rx="4" fill="#E3A21A" ${O}/>` +
    `<circle cx="18" cy="31" r="5" fill="#F0506E" ${O3}/><circle cx="50" cy="19" r="5" fill="#8E7BDB" ${O3}/><circle cx="82" cy="31" r="5" fill="#F0506E" ${O3}/>` +
    `<circle cx="32" cy="77" r="3.5" fill="#4EA8DE" ${O3}/><circle cx="50" cy="77" r="3.5" fill="#F0506E" ${O3}/><circle cx="68" cy="77" r="3.5" fill="#2E8A56" ${O3}/>` +
    face(50, 55, 0.7, true),
)

const chocolate = svg(
  `<rect x="22" y="12" width="56" height="76" rx="6" fill="#7B4A2F" ${O}/>` +
    `<path d="M36 12 L36 50 M50 12 L50 50 M64 12 L64 50 M22 25 L78 25 M22 38 L78 38" fill="none" stroke="#5E361F" stroke-width="3"/>` +
    `<path d="M22 50 L78 50 L78 82 C78 85 75 88 72 88 L28 88 C25 88 22 85 22 82Z" fill="#D62828" ${O}/>` +
    `<path d="M22 50 L32 56 L42 50 L52 56 L62 50 L72 56 L78 52" fill="none" stroke="#FFD166" stroke-width="3.5" stroke-linejoin="round"/>` +
    face(50, 69, 0.75, false),
)

const mug = svg(
  `<path d="M72 44 C88 44 88 70 72 70" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M72 44 C88 44 88 70 72 70" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M20 34 L76 34 L72 82 C72 86 68 90 64 90 L32 90 C28 90 24 86 24 82Z" fill="#FFFFFF" ${O}/>` +
    `<ellipse cx="48" cy="36" rx="26" ry="5" fill="#B97A4E" ${O3}/>` +
    `<path d="M38 26 Q34 20 38 14 M52 24 Q48 18 52 10" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>` +
    face(48, 60, 0.85),
)

const bee = svg(
  `<ellipse cx="46" cy="30" rx="12" ry="16" transform="rotate(-20 46 30)" fill="#DDF1FF" ${O}/>` +
    `<ellipse cx="64" cy="30" rx="12" ry="16" transform="rotate(20 64 30)" fill="#DDF1FF" ${O}/>` +
    `<path d="M84 56 L94 56 L84 62Z" fill="${INK}"/>` +
    `<ellipse cx="54" cy="58" rx="32" ry="23" fill="#FFC93C" ${O}/>` +
    `<path d="M56 37 Q50 58 56 79" fill="none" stroke="${INK}" stroke-width="7"/>` +
    `<path d="M72 40 Q67 58 72 76" fill="none" stroke="${INK}" stroke-width="7"/>` +
    `<ellipse cx="54" cy="58" rx="32" ry="23" fill="none" ${O}/>` +
    face(38, 55, 0.62),
)

const bonfire = svg(
  `<rect x="18" y="74" width="64" height="12" rx="6" fill="#8B5A3C" ${O} transform="rotate(-10 50 80)"/>` +
    `<rect x="18" y="74" width="64" height="12" rx="6" fill="#A0673C" ${O} transform="rotate(10 50 80)"/>` +
    `<path d="M50 8 C62 28 78 38 74 60 C72 74 62 80 50 80 C38 80 28 74 26 60 C24 44 40 36 50 8Z" fill="#F28C28" ${O}/>` +
    `<path d="M50 34 C58 46 64 54 62 64 C60 72 56 76 50 76 C44 76 40 72 38 64 C37 56 44 48 50 34Z" fill="#FFD166"/>` +
    face(50, 60, 0.7),
)

const rainbow = (() => {
  const arcs = ['#F0506E', '#F7A05E', '#FFC93C', '#8DD67E', '#4EA8DE', '#8E7BDB']
  let s = `<path d="M25 72 A25 25 0 0 1 75 72" fill="none" stroke="${INK}" stroke-width="41"/>`
  arcs.forEach((c, i) => {
    const rad = 40 - i * 6
    s += `<path d="M${50 - rad} 72 A${rad} ${rad} 0 0 1 ${50 + rad} 72" fill="none" stroke="${c}" stroke-width="6"/>`
  })
  const puff = (cx: number) =>
    `<path d="M${cx - 16} 84 C${cx - 24} 84 ${cx - 24} 70 ${cx - 14} 70 C${cx - 12} 62 ${cx + 2} 60 ${cx + 6} 68 C${cx + 16} 66 ${cx + 22} 76 ${cx + 16} 84Z" fill="#FFFFFF" ${O}/>`
  return svg(s + puff(20) + puff(80))
})()

const smiley = svg(
  `<circle cx="50" cy="50" r="38" fill="#FFD43B" ${O}/>` +
    `<ellipse cx="38" cy="40" rx="5" ry="7" fill="${INK}"/><ellipse cx="62" cy="40" rx="5" ry="7" fill="${INK}"/>` +
    `<path d="M30 56 Q50 78 70 56" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>` +
    `<ellipse cx="26" cy="56" rx="5" ry="3.5" fill="${CHEEK}"/><ellipse cx="74" cy="56" rx="5" ry="3.5" fill="${CHEEK}"/>`,
)

const book = svg(
  `<path d="M50 30 C40 22 24 22 10 26 L10 84 C24 80 40 80 50 88 C60 80 76 80 90 84 L90 26 C76 22 60 22 50 30Z" fill="#F07B6B" ${O}/>` +
    `<path d="M50 26 C40 18 26 18 16 20 L16 76 C28 74 40 75 50 82 C60 75 72 74 84 76 L84 20 C74 18 60 18 50 26Z" fill="#FFFDF7" ${O}/>` +
    `<path d="M50 26 L50 82" fill="none" ${O3}/>` +
    `<path d="M24 34 L42 34 M24 44 L42 44 M58 34 L76 34 M58 44 L76 44 M58 54 L70 54" fill="none" stroke="#C9B8A8" stroke-width="3.5" stroke-linecap="round"/>` +
    face(33, 58, 0.55, false),
)

const pawShape = (fill: string) =>
  `<ellipse cx="50" cy="64" rx="18" ry="15" fill="${fill}" ${O}/>` +
  `<ellipse cx="28" cy="44" rx="7" ry="9" fill="${fill}" ${O}/>` +
  `<ellipse cx="42" cy="32" rx="7" ry="9" fill="${fill}" ${O}/>` +
  `<ellipse cx="58" cy="32" rx="7" ry="9" fill="${fill}" ${O}/>` +
  `<ellipse cx="72" cy="44" rx="7" ry="9" fill="${fill}" ${O}/>`

const paw = svg(pawShape('#A86E4E'))

/** For International Cat Day: the cat is banned. */
const noCat = svg(
  pawShape('#C9B8A8') +
    `<circle cx="50" cy="50" r="40" fill="none" stroke="${INK}" stroke-width="14"/>` +
    `<circle cx="50" cy="50" r="40" fill="none" stroke="#E2231A" stroke-width="8"/>` +
    `<path d="M22 22 L78 78" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>` +
    `<path d="M22 22 L78 78" stroke="#E2231A" stroke-width="8" stroke-linecap="round"/>`,
)

const planet = svg(
  `<ellipse cx="50" cy="52" rx="44" ry="13" transform="rotate(-15 50 52)" fill="none" stroke="${INK}" stroke-width="12"/>` +
    `<ellipse cx="50" cy="52" rx="44" ry="13" transform="rotate(-15 50 52)" fill="none" stroke="#F7A05E" stroke-width="6"/>` +
    `<circle cx="50" cy="50" r="26" fill="#8E7BDB" ${O}/>` +
    `<path d="M6 52 A44 13 0 0 0 94 52" transform="rotate(-15 50 52)" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M6 52 A44 13 0 0 0 94 52" transform="rotate(-15 50 52)" fill="none" stroke="#F7A05E" stroke-width="6" stroke-linecap="round"/>` +
    face(50, 44, 0.8) +
    `<polygon points="${starPoints(84, 16, 8, 3.5, 4)}" fill="#FFC93C" ${O3}/>`,
)

const pie = svg(
  `<path d="M10 50 L18 78 Q50 92 82 78 L90 50Z" fill="#D9893B" ${O}/>` +
    `<ellipse cx="50" cy="50" rx="40" ry="17" fill="#F4C27A" ${O}/>` +
    `<path d="M36 44 L64 44 M43 44 L41 57 M57 44 Q56 55 61 57" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
    face(50, 72, 0.6, false),
)

const moon = svg(
  `<path d="M62 10 C38 12 20 30 20 54 C20 76 38 92 60 92 C70 92 80 88 86 80 C60 82 44 64 44 46 C44 30 52 16 62 10Z" fill="#FFE08A" ${O}/>` +
    `<path d="M30 52 Q34 56 38 52" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M32 64 Q36 68 40 64" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="28" cy="60" rx="4" ry="2.6" fill="${CHEEK}"/>` +
    `<polygon points="${starPoints(74, 30, 12, 5, 5)}" fill="#FFC93C" ${O3}/>`,
)

const thistle = svg(
  `<path d="M50 70 L50 94" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M50 70 L50 94" fill="none" stroke="#5FAF5A" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M50 84 L30 74 L34 84 L24 86 L50 92Z" fill="#5FAF5A" ${O3}/>` +
    `<path d="M50 84 L70 74 L66 84 L76 86 L50 92Z" fill="#5FAF5A" ${O3}/>` +
    `<path d="M28 38 L30 12 L40 30 L50 6 L60 30 L70 12 L72 38Z" fill="#9B5DE5" ${O}/>` +
    `<circle cx="50" cy="52" r="20" fill="#6BBF59" ${O}/>` +
    face(50, 52, 0.62, true),
)

const rose = flower('#E63946', '#FFD166', false, '#FFFFFF')
const whiteRose = flower('#FFFFFF', '#FFD166', false)
const blossom = flower('#F5A2DE', '#FFD166', true)

const stocking = svg(
  `<path d="M36 18 L64 18 L64 52 C64 60 70 64 78 68 C90 74 86 92 70 90 L44 86 C30 84 32 70 36 60Z" fill="#D62828" ${O}/>` +
    `<rect x="31" y="10" width="38" height="15" rx="6" fill="#FFFFFF" ${O}/>` +
    `<path d="M66 72 C74 72 82 76 82 84" fill="none" stroke="#FFF6E0" stroke-width="4" stroke-linecap="round"/>` +
    face(49, 44, 0.65, true),
)

const globe = svg(
  `<circle cx="50" cy="50" r="38" fill="#4EA8DE" ${O}/>` +
    `<path d="M20 36 C28 28 40 30 40 40 C40 48 30 50 28 58 C24 54 18 46 20 36Z" fill="#6BBF59" ${O3}/>` +
    `<path d="M62 16 C72 20 80 28 84 40 C76 42 70 36 64 38 C60 30 56 22 62 16Z" fill="#6BBF59" ${O3}/>` +
    `<path d="M58 70 C66 64 76 66 78 72 C72 80 64 84 56 84 C54 78 54 74 58 70Z" fill="#6BBF59" ${O3}/>` +
    face(52, 50, 0.8),
)

const fish = svg(
  `<path d="M72 50 L92 32 L90 68Z" fill="#F7A05E" ${O}/>` +
    `<path d="M14 50 C28 26 62 24 78 50 C62 76 28 74 14 50Z" fill="#F28C28" ${O}/>` +
    `<path d="M44 30 Q50 18 60 30" fill="#F7A05E" ${O3}/>` +
    `<circle cx="32" cy="46" r="4.5" fill="${INK}"/><circle cx="33.5" cy="44.5" r="1.6" fill="#fff"/>` +
    `<path d="M24 56 Q28 60 32 57" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="56" rx="4" ry="2.6" fill="${CHEEK}"/>` +
    `<path d="M52 40 Q56 50 52 60 M62 42 Q66 50 62 58" fill="none" stroke="#C4621A" stroke-width="3" stroke-linecap="round"/>`,
)

const camera = svg(
  `<rect x="30" y="20" width="24" height="14" rx="4" fill="#5C6BC0" ${O}/>` +
    `<rect x="10" y="30" width="80" height="54" rx="10" fill="#6C7FD8" ${O}/>` +
    `<circle cx="50" cy="57" r="19" fill="#3A3A5C" ${O}/>` +
    `<circle cx="50" cy="57" r="10" fill="#A8C8E6" ${O3}/>` +
    `<circle cx="46" cy="53" r="3" fill="#fff"/>` +
    `<rect x="72" y="38" width="10" height="7" rx="2" fill="#FFD166" ${O3}/>`,
)

const hedgehog = svg(
  `<path d="M22 76 L16 62 L26 58 L20 44 L34 42 L32 28 L46 32 L50 18 L60 30 L72 22 L74 36 L86 38 L82 52 L92 58 L84 66 L88 78 Z" fill="#8B5A3C" ${O}/>` +
    `<path d="M10 70 C10 54 22 48 36 50 C46 52 50 62 48 72 C46 80 40 82 30 82 C18 82 10 80 10 70Z" fill="#E9C9A0" ${O}/>` +
    `<circle cx="9" cy="68" r="4.5" fill="${INK}"/>` +
    `<circle cx="28" cy="62" r="3.8" fill="${INK}"/><circle cx="29.2" cy="60.8" r="1.3" fill="#fff"/>` +
    `<path d="M16 74 Q20 77 24 74" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="36" cy="70" rx="4.5" ry="3" fill="${CHEEK}"/>`,
)

const frog = svg(
  `<circle cx="30" cy="32" r="14" fill="#6BBF59" ${O}/>` +
    `<circle cx="70" cy="32" r="14" fill="#6BBF59" ${O}/>` +
    `<ellipse cx="50" cy="60" rx="40" ry="28" fill="#6BBF59" ${O}/>` +
    `<circle cx="30" cy="32" r="8" fill="#FFFFFF" ${O3}/><circle cx="70" cy="32" r="8" fill="#FFFFFF" ${O3}/>` +
    `<circle cx="31" cy="33" r="4" fill="${INK}"/><circle cx="69" cy="33" r="4" fill="${INK}"/>` +
    `<path d="M30 62 Q50 78 70 62" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="62" rx="6" ry="4" fill="${CHEEK}"/><ellipse cx="76" cy="62" rx="6" ry="4" fill="${CHEEK}"/>`,
)

const tie = svg(
  `<path d="M26 10 L50 22 L74 10 L70 26 L50 22 L30 26Z" fill="#FFFFFF" ${O3}/>` +
    `<path d="M42 30 L58 30 L68 76 L50 92 L32 76Z" fill="#3A86FF" ${O}/>` +
    `<path d="M40 44 L60 36 M37 58 L63 48 M35 72 L65 60" fill="none" stroke="#FFD166" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M40 16 L60 16 L57 32 L43 32Z" fill="#2F6BD0" ${O}/>`,
)

const bun = svg(
  `<ellipse cx="50" cy="58" rx="40" ry="30" fill="#D08A45" ${O}/>` +
    shine('M22 50 Q26 38 38 34') +
    fatLine('M22 56 Q50 44 78 56', '#FFF6E0', 7) +
    fatLine('M50 30 L50 86', '#FFF6E0', 7),
)

const clock = svg(
  `<circle cx="26" cy="22" r="11" fill="#FFC93C" ${O}/><circle cx="74" cy="22" r="11" fill="#FFC93C" ${O}/>` +
    `<path d="M30 86 L24 94 M70 86 L76 94" fill="none" ${O}/>` +
    `<circle cx="50" cy="56" r="34" fill="#F0506E" ${O}/>` +
    `<circle cx="50" cy="56" r="25" fill="#FFFFFF" ${O3}/>` +
    `<path d="M50 56 L50 40 M50 56 L62 62" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="50" cy="56" r="3.5" fill="${INK}"/>`,
)

const towel = svg(
  `<path d="M24 14 L76 14 L72 88 L28 88Z" fill="#4FB3B0" ${O}/>` +
    `<path d="M26 30 L74 30 M27 74 L73 74" fill="none" stroke="#FFFFFF" stroke-width="5"/>` +
    face(50, 50, 0.85),
)

export const PIECES: Record<string, string> = {
  bean,
  pumpkin,
  ghost,
  pudding,
  tree,
  snowman,
  bauble,
  sun,
  lolly,
  heart,
  egg,
  bunny,
  pancake,
  firework,
  champagne,
  pizza,
  cake,
  balloon,
  gift,
  poppy,
  clover,
  daffodil,
  blossom,
  rose,
  whiteRose,
  leaf,
  star,
  snowflake,
  lidlish,
  cloud,
  icedCoffee,
  crown,
  chocolate,
  mug,
  bee,
  bonfire,
  rainbow,
  smiley,
  book,
  paw,
  noCat,
  planet,
  pie,
  moon,
  thistle,
  stocking,
  globe,
  fish,
  camera,
  hedgehog,
  frog,
  tie,
  bun,
  clock,
  towel,
}

export const DEFAULT_PIECE = 'bean'

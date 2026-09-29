// Region palettes. Every palette has at least 11 colours, each dark/saturated
// enough that a bold white X stays readable on it, and far enough apart from
// the others that neighbouring regions can be told apart.
// (calendar.test.ts checks white-contrast and pairwise distance.)

export const PALETTES: Record<string, string[]> = {
  /** Sampled from her Meowdoku screenshots – the look she already likes. */
  default: [
    '#8E7BDB', // purple
    '#A86E4E', // brown
    '#F7A05E', // orange
    '#2E8A56', // dark green
    '#8DD67E', // light green
    '#F5A2DE', // pink
    '#A8C8E6', // light blue
    '#D5718E', // rose
    '#D7B03A', // mustard
    '#4FB3B0', // teal
    '#F07B6B', // coral
  ],

  halloween: [
    '#F28C28', // pumpkin
    '#7B3FA0', // witch purple
    '#3F9142', // slime green
    '#C0392B', // blood red
    '#4B5D8A', // slate night
    '#D4AC2B', // candle gold
    '#2E7F7A', // cauldron teal
    '#C2549A', // potion magenta
    '#8A5A3B', // broomstick brown
    '#9BBF3A', // toxic lime
    '#3A3A5C', // midnight
  ],

  christmas: [
    '#C8102E', // red
    '#1E7B45', // holly green
    '#D4A72C', // gold
    '#2B5DA8', // blue
    '#8E2440', // cranberry
    '#5FAF5A', // sprout green
    '#E0707A', // candy pink
    '#7A5C99', // plum
    '#A0673C', // gingerbread
    '#3AA1A0', // teal
    '#8FA3BF', // silver-blue
  ],

  summer: [
    '#FF7F50', // coral
    '#F2B418', // sunshine
    '#8AC926', // lime
    '#2A9D5C', // palm green
    '#2EC4B6', // turquoise
    '#4EA8DE', // sky
    '#3A5BD9', // deep blue
    '#9B5DE5', // violet
    '#F15BB5', // flamingo
    '#E63946', // watermelon
    '#167A7A', // lagoon
    '#C9A77C', // sand
  ],

  spring: [
    '#EF8FB3', // blossom
    '#E8B92F', // daffodil
    '#7CC46B', // new leaf
    '#B38BDB', // lilac
    '#6FA8DC', // sky
    '#3FB39A', // mint
    '#F29A5E', // peach
    '#3F8E4D', // grass
    '#6C7FD8', // bluebell
    '#D9607E', // tulip
    '#A8844F', // twig
    '#2F6F9F', // pond
  ],

  autumn: [
    '#C8553D', // rust
    '#EBA937', // amber
    '#8A9A3B', // olive
    '#7A4430', // chestnut
    '#E07B39', // pumpkin
    '#3E6B48', // forest
    '#A63446', // cranberry
    '#6E4A7E', // plum
    '#3D8A8A', // teal
    '#B98B5E', // oak
    '#5B7089', // slate
  ],

  winter: [
    '#7FB3E0', // ice blue
    '#2F4B8A', // navy
    '#3A9DA8', // frozen teal
    '#9C8AD6', // lilac
    '#9AA7B8', // silver
    '#2F7A5B', // pine
    '#B03A5B', // berry
    '#5FC0AE', // frost mint
    '#4F5D75', // slate
    '#D98AA8', // rosy cheeks
    '#6B4C8C', // plum
  ],

  valentine: [
    '#E63946', // red
    '#F77FA5', // pink
    '#B5179E', // magenta
    '#7B2CBF', // purple
    '#F4A261', // peach
    '#A4133C', // crimson
    '#2A9D8F', // teal (for contrast)
    '#9D6BDD', // lavender
    '#6D597A', // mauve
    '#D4A373', // caramel
    '#5B1A3A', // wine
  ],

  birthday: [
    '#FF6B6B', // red
    '#FFA94D', // orange
    '#F0B429', // yellow
    '#51CF66', // green
    '#20C997', // aqua
    '#339AF0', // blue
    '#5C7CFA', // indigo
    '#845EF7', // violet
    '#F06595', // pink
    '#CC5DE8', // grape
    '#1B5FA8', // deep blue
  ],

  nye: [
    '#1F2A5A', // midnight navy
    '#D4AF37', // gold
    '#B8BEC8', // silver
    '#7B2CBF', // purple
    '#E0457B', // party pink
    '#2EC4B6', // teal
    '#3A86FF', // electric blue
    '#A0761A', // old gold
    '#6F7FA0', // steel
    '#4E2A84', // deep violet
    '#E76F51', // sparkler orange
  ],

  pastel: [
    '#E89AAE', // pink
    '#F0AE62', // apricot
    '#D9BE4A', // butter
    '#94C77F', // pistachio
    '#5FB9A6', // mint
    '#7FB2E5', // powder blue
    '#9C9CE8', // periwinkle
    '#C79AE0', // lavender
    '#8C7BC0', // dusty violet
    '#B8A07E', // latte
    '#8E9AAF', // dove grey
  ],

  /** Based on the Okabe–Ito colour-blind-safe set, extended with lightness steps. */
  colourblind: [
    '#E69F00', // orange
    '#56B4E9', // sky blue
    '#009E73', // bluish green
    '#C9B400', // yellow (darkened so the X shows)
    '#0072B2', // blue
    '#D55E00', // vermillion
    '#CC79A7', // reddish purple
    '#555555', // dark grey
    '#8C510A', // brown
    '#6A3D9A', // purple
    '#9E9E9E', // mid grey
  ],

  /** The player's own birthday week only – royal and a bit extra. */
  queen: [
    '#7B3FA0', // royal purple
    '#D4AF37', // gold
    '#E75480', // pink
    '#2A6FDB', // royal blue
    '#C71585', // magenta
    '#1F8A70', // emerald
    '#F28C28', // amber
    '#A987DE', // lavender
    '#B22222', // ruby
    '#40B4C4', // aquamarine
    '#2E3A87', // sapphire
  ],

  /** Muted and respectful, for Remembrance. */
  remembrance: [
    '#C8102E', // poppy red
    '#5A4A42', // bark
    '#6B7A2A', // olive
    '#A68B5B', // khaki
    '#4F6D7A', // slate
    '#7A2E3A', // maroon
    '#8E8E93', // grey
    '#6E9468', // sage
    '#2C3E5C', // navy
    '#B06A38', // bronze
    '#86698C', // heather
  ],
}

export const DEFAULT_PALETTE = PALETTES.default

// Renders public/icon.svg into the PNG icons the PWA manifest and iOS need.
// Run: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const root = new URL('../public/', import.meta.url)
const icon = readFileSync(new URL('icon.svg', root), 'utf8').trim()
const BG = '#f7f1ec'

/** Wrap the icon on a full-bleed opaque square, scaled to `scale` of the canvas. */
function framed(scale) {
  const size = 512
  const inner = size * scale
  const off = (size - inner) / 2
  const nested = icon.replace('<svg ', `<svg x="${off}" y="${off}" width="${inner}" height="${inner}" `)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${BG}"/>${nested}</svg>`
}

function render(svg, px, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render().asPng()
  writeFileSync(new URL(file, root), png)
  console.log(`wrote public/${file} (${px}px, ${png.length} bytes)`)
}

render(icon, 192, 'pwa-192.png')
render(icon, 512, 'pwa-512.png')
// Maskable: keep the art inside the 80% safe circle.
render(framed(0.8), 512, 'maskable-512.png')
// iOS: opaque, iOS rounds the corners itself.
render(framed(1), 180, 'apple-touch-icon.png')

// Screenshot any app state on an iPhone-sized WebKit, for design review.
// Usage: node scripts/shoot.mjs <state> <out.png> [baseUrl]
// States: onboarding home home-cooldown home-bigday game game-mid game-hint game-pencil
//         win session-done stats stats-size stats-history settings about themes
import { webkit, devices } from '@playwright/test'

const [state = 'home', out = 'shot.png', base = 'http://localhost:4175'] = process.argv.slice(2)

const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices['iPhone SE'], reducedMotion: 'reduce', baseURL: base })
const page = await ctx.newPage()

async function seed({ level = 135, onboarded = true, extra = {}, progress = {}, solves = 0 } = {}) {
  // seed from a same-origin page that doesn't run the app (so the DB isn't held open)
  await page.goto('/manifest.webmanifest')
  await page.evaluate(
    async ({ level, onboarded, extra, progress, solves }) => {
      localStorage.clear()
      localStorage.setItem('nd:settings', JSON.stringify({ onboarded, name: 'Nicola', ...extra }))
      localStorage.setItem('nd:installHintDismissed', '1')
      localStorage.setItem('nd:progress', JSON.stringify({ level, totalScore: 48210, bestSessionScore: 9120, salt: 'shoot', ...progress }))
      await new Promise((res) => {
        const del = indexedDB.deleteDatabase('nicdoku')
        del.onsuccess = del.onerror = del.onblocked = res
      })
      if (!solves) return
      // ~6 weeks of plausible improving history
      const req = indexedDB.open('nicdoku', 1)
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore('solves', { keyPath: 'id', autoIncrement: true })
        s.createIndex('day', 'day')
        s.createIndex('n', 'n')
        req.result.createObjectStore('kv')
      }
      await new Promise((res) => (req.onsuccess = res))
      const tx = req.result.transaction('solves', 'readwrite')
      const st = tx.objectStore('solves')
      let x = 7
      const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
      const now = Date.now()
      for (let d = 42; d >= 0; d--) {
        if (rnd() < 0.2) continue
        const date = new Date(now - d * 86400000)
        const day = date.toISOString().slice(0, 10)
        const k = 3 + Math.floor(rnd() * 6)
        for (let j = 0; j < k; j++) {
          const n = [8, 9, 9, 9, 10][Math.floor(rnd() * 5)]
          const base = n * n * 1400 * (1 - (42 - d) / 42 * 0.35)
          const t = base * (0.7 + rnd() * 0.7)
          const mistakes = rnd() < 0.25 ? 1 + Math.floor(rnd() * 2) : 0
          st.add({ at: date.getTime() - (k - j) * 300000, day, mode: j < 5 ? 'session' : 'daily', sessionId: 's' + d, level: 100 + (42 - d) * 5 + j, n, difficulty: ['easy', 'medium', 'hard', 'expert'][Math.floor(rnd() * 4)], grade: 3, timeMs: Math.round(t), firstTapMs: Math.round(2000 + rnd() * 6000), mistakes, hints: rnd() < 0.15 ? 1 : 0, assists: 0, undos: Math.floor(rnd() * 3), clean: mistakes === 0, score: Math.round(900 + rnd() * 900), themeId: 'season-sep' })
        }
      }
      await new Promise((res) => (tx.oncomplete = res))
    },
    { level, onboarded, extra, progress, solves },
  )
  await page.goto('/')
  await page.waitForTimeout(700)
}

async function startBreak() {
  await page.getByRole('button', { name: /Start a break|Resume break/ }).click()
  await page.locator('.board').waitFor()
  await page.waitForTimeout(500)
}

const game = () => page.evaluate(() => JSON.parse(localStorage.getItem('nd:game')))
async function dbl(i) {
  const box = await page.locator('.board .cell').nth(i).boundingBox()
  for (let k = 0; k < 2; k++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
  }
  await page.waitForTimeout(80)
}
async function tap(i) {
  await page.locator('.board .cell').nth(i).click()
  await page.waitForTimeout(450)
}
async function midGame() {
  const g = await game()
  const n = g.puzzle.n
  for (let r = 0; r < 3; r++) await dbl(r * n + g.puzzle.solution[r])
  for (let i = n * 5; i < n * 5 + 4; i++) if (g.puzzle.solution[5] !== i % n) await tap(i)
  const wrong = n * 7 + ((g.puzzle.solution[7] + 3) % n)
  await dbl(wrong)
  await page.waitForTimeout(600)
}
async function solve() {
  const g = await game()
  const n = g.puzzle.n
  for (let r = 0; r < n; r++) await dbl(r * n + g.puzzle.solution[r])
  await page.locator('.win-overlay').waitFor()
}

switch (state) {
  case 'onboarding': await seed({ onboarded: false }); break
  case 'home': await seed({ solves: 1 }); break
  case 'home-cooldown': await seed({ solves: 1, progress: { cooldownUntil: Date.now() + 37 * 60000, session: { id: 'x', startedAt: 0, levelAtStart: 130, index: 5, plan: [], results: [], finishedAt: Date.now() } } }); break
  case 'home-bigday': await seed({ solves: 1, extra: { themeOverride: 'birthday-queen' } }); break
  case 'game': await seed(); await startBreak(); break
  case 'game-mid': await seed(); await startBreak(); await midGame(); break
  case 'game-hint': await seed(); await startBreak(); await midGame(); await page.getByRole('button', { name: 'Explain the next step' }).click(); await page.waitForTimeout(400); break
  case 'game-pencil': await seed(); await startBreak(); await page.getByRole('button', { name: /Pencil/ }).click(); { const g = await game(); await dbl(g.puzzle.solution[0]); await tap(g.puzzle.n + 3) } break
  case 'win': await seed({ solves: 1 }); await startBreak(); await solve(); await page.waitForTimeout(1200); break
  case 'session-done': {
    await seed({ solves: 1 }); await startBreak()
    for (let k = 0; k < 5; k++) { await solve(); await page.waitForTimeout(500); await page.locator('.win-btn').click(); if (k < 4) { await page.locator('.board').waitFor(); await page.waitForTimeout(300) } }
    await page.getByRole('heading', { name: 'Break done' }).waitFor(); await page.waitForTimeout(400); break
  }
  case 'stats': await seed({ solves: 1 }); await page.getByRole('button', { name: /Stats/ }).click(); await page.waitForTimeout(800); break
  case 'stats-size': await seed({ solves: 1 }); await page.getByRole('button', { name: /Stats/ }).click(); await page.getByRole('tab', { name: /By size/ }).click().catch(() => page.getByText('By size').click()); await page.waitForTimeout(600); break
  case 'stats-history': await seed({ solves: 1 }); await page.getByRole('button', { name: /Stats/ }).click(); await page.getByRole('tab', { name: /History/ }).click().catch(() => page.getByText('History').click()); await page.waitForTimeout(600); break
  case 'settings': await seed(); await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(500); break
  case 'about': await seed(); await page.getByRole('button', { name: 'Settings' }).click(); await page.getByText(/About/).first().click(); await page.waitForTimeout(500); break
  case 'themes': await seed(); await page.getByRole('button', { name: /Themes/ }).click(); await page.waitForTimeout(500); break
  default: throw new Error('unknown state ' + state)
}

const full = process.argv.includes('--full')
await page.screenshot({ path: out, fullPage: full })
console.log('saved', out)
await browser.close()

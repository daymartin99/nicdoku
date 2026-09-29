import { test, expect, type Page } from '@playwright/test'

type Saved = { puzzle: { n: number; solution: number[] }; marks: number[]; done: boolean }

async function skipOnboarding(page: Page, level = 135) {
  await page.goto('/')
  await page.evaluate((lvl) => {
    localStorage.setItem('nd:settings', JSON.stringify({ onboarded: true, name: 'Jo' }))
    localStorage.setItem('nd:installHintDismissed', '1')
    const p = JSON.parse(localStorage.getItem('nd:progress') || '{}')
    localStorage.setItem('nd:progress', JSON.stringify({ ...p, level: lvl }))
  }, level)
  await page.reload()
}

async function current(page: Page): Promise<Saved> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nd:game') || 'null'))
}

async function doubleTap(page: Page, index: number) {
  const cell = page.locator('.board .cell').nth(index)
  const box = (await cell.boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  for (let k = 0; k < 2; k++) {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
  }
}

/** A real (non-pencil) piece is showing in this cell. Read from the DOM: saves are debounced. */
async function hasPiece(page: Page, index: number) {
  return (await page.locator('.board .cell').nth(index).locator(':scope > .piece').count()) > 0
}

async function solveCurrent(page: Page) {
  await expect(page.locator('.board')).toBeVisible()
  const g = await current(page)
  const n = g.puzzle.n
  for (let r = 0; r < n; r++) {
    const i = r * n + g.puzzle.solution[r]
    // a double-tap on a placed piece removes it, so skip ones already there
    if (await hasPiece(page, i)) continue
    await doubleTap(page, i)
    await page.waitForTimeout(40)
  }
  await expect(page.locator('.win-overlay')).toBeVisible({ timeout: 5000 })
}

test('onboarding flow works', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: "Let's go" }).click()
  await page.getByLabel('Starting level').fill('135')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Start playing' }).click()
  await expect(page.getByText('Level 135')).toBeVisible()
})

test('a full break: 5 puzzles → break done → cooldown', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await skipOnboarding(page)
  await page.getByRole('button', { name: /Start a break/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click() // quick mood check
  for (let k = 0; k < 5; k++) {
    await solveCurrent(page)
    const btn = page.locator('.win-btn')
    await expect(btn).toBeEnabled({ timeout: 3000 })
    await btn.click()
  }
  await expect(page.getByRole('heading', { name: 'Break done' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to home' }).click()
  await expect(page.getByText(/Next break from/)).toBeVisible()
  const solves = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        const req = indexedDB.open('nicdoku')
        req.onsuccess = () => {
          const tx = req.result.transaction('solves').objectStore('solves').count()
          tx.onsuccess = () => res(tx.result)
        }
      }),
  )
  expect(solves).toBe(5)
  expect(errors).toEqual([])
})

test('wrong piece costs a heart and leaves an orange X, never fails', async ({ page }) => {
  await skipOnboarding(page, 40)
  await page.getByRole('button', { name: /Start a break/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click() // quick mood check
  await expect(page.locator('.board')).toBeVisible()
  const g = await current(page)
  const n = g.puzzle.n
  // 4 wrong placements (more than the 3 lives)
  let wrong = 0
  for (let i = 0; i < n * n && wrong < 4; i++) {
    const r = Math.floor(i / n)
    if (g.puzzle.solution[r] === i % n) continue
    await doubleTap(page, i)
    await page.waitForTimeout(450)
    wrong++
  }
  const after = await current(page)
  expect(after.marks.filter((m) => m === 3).length).toBe(4)
  // at zero hearts the pill shows a calm slip count instead of three grey hearts
  await expect(page.locator('.mistake-count')).toHaveText('4 slips')
  await expect(page.getByText(/Out of hearts/)).toBeVisible()
  await solveCurrent(page) // can still finish
  await expect(page.locator('.win-line')).not.toHaveText(/clean solve/)
})

test('reload mid-puzzle restores the exact board', async ({ page }) => {
  await skipOnboarding(page)
  await page.getByRole('button', { name: /Start a break/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click() // quick mood check
  await expect(page.locator('.board')).toBeVisible()
  const g = await current(page)
  const n = g.puzzle.n
  const i = n * 0 + g.puzzle.solution[0]
  await doubleTap(page, i)
  // single tap somewhere else → X
  const other = (i + 2 * n) % (n * n)
  await page.locator('.board .cell').nth(other).click()
  await page.waitForTimeout(400)
  const before = await current(page)
  await page.reload()
  await expect(page.locator('.board')).toBeVisible()
  const after = await current(page)
  expect(after.marks).toEqual(before.marks)
  expect(after.puzzle).toEqual(before.puzzle)
})

test('stress: random taps, drags, undo, hints, then solve — no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await skipOnboarding(page, 200)
  await page.getByRole('button', { name: /Start a break/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click() // quick mood check
  const board = page.locator('.board')
  await expect(board).toBeVisible()
  const box = (await board.boundingBox())!
  let seed = 42
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let k = 0; k < 150; k++) {
    const x = box.x + rand() * box.width, y = box.y + rand() * box.height
    const action = rand()
    if (action < 0.5) {
      await page.mouse.click(x, y)
    } else if (action < 0.8) {
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(box.x + rand() * box.width, box.y + rand() * box.height, { steps: 6 })
      await page.mouse.up()
    } else if (action < 0.9) {
      await page.getByRole('button', { name: 'Undo' }).click({ timeout: 1000 }).catch(() => {})
    } else {
      await page.getByRole('button', { name: 'Cross out impossible cells' }).click()
    }
  }
  await page.getByRole('button', { name: 'Explain the next step' }).click()
  await expect(page.locator('.hint-bubble')).toBeVisible()
  await page.getByRole('button', { name: 'Do it for me' }).click()
  // Reveal needs a confirming second tap
  const reveal = page.getByRole('button', { name: 'Place a piece for me' })
  await reveal.click()
  await expect(reveal).toContainText('Tap again')
  await reveal.click()
  await expect(reveal).toContainText('Reveal')
  // clear board to known state (restart asks first) and solve
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Restart this puzzle' }).click()
  await expect(page.locator('.board .cell > .piece')).toHaveCount(0)
  await solveCurrent(page)
  expect(errors).toEqual([])
})

test('daily puzzle is identical on a fresh device', async ({ page, browser }) => {
  await skipOnboarding(page)
  await page.getByRole('button', { name: /Daily puzzle/ }).click()
  await expect(page.locator('.board')).toBeVisible()
  const a = await current(page)
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4174' })
  const p2 = await ctx.newPage()
  await skipOnboarding(p2, 7)
  await p2.getByRole('button', { name: /Daily puzzle/ }).click()
  await expect(p2.locator('.board')).toBeVisible()
  const b = await current(p2)
  expect(b.puzzle).toEqual(a.puzzle)
  await ctx.close()
})

test('start again: a tap does nothing, a 2-second hold wipes progress but keeps family', async ({ page }) => {
  await skipOnboarding(page, 135)
  await page.evaluate(async () => {
    const p = JSON.parse(localStorage.getItem('nd:progress') || '{}')
    localStorage.setItem('nd:progress', JSON.stringify({ ...p, totalScore: 48210 }))
    await new Promise<void>((res) => {
      const req = indexedDB.open('nicdoku', 1)
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore('solves', { keyPath: 'id', autoIncrement: true })
        s.createIndex('day', 'day'); s.createIndex('n', 'n')
        req.result.createObjectStore('kv')
      }
      req.onsuccess = () => {
        const tx = req.result.transaction(['solves', 'kv'], 'readwrite')
        tx.objectStore('solves').add({ at: Date.now(), day: '2026-09-29', mode: 'session', level: 1, n: 9, difficulty: 'easy', grade: 1, timeMs: 60000, firstTapMs: 1000, mistakes: 0, hints: 0, assists: 0, undos: 0, clean: true, score: 900, themeId: 'x' })
        tx.objectStore('kv').put({ members: [{ name: 'Sam', birthday: '2015-05-12' }], specials: [] }, 'family')
        tx.oncomplete = () => { req.result.close(); res() }
      }
    })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Start again…' }).click()
  await expect(page.getByText(/Level 135 goes back to level 1/)).toBeVisible()
  await expect(page.getByText(/1 solved puzzles/)).toBeVisible()

  const hold = page.getByRole('button', { name: /Hold for two seconds/ })
  await hold.scrollIntoViewIfNeeded()
  const box = (await hold.boundingBox())!
  // a quick tap must not wipe anything
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up()
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nd:progress') || '{}').level)).toBe(135)

  // a full hold does
  await page.mouse.down(); await page.waitForTimeout(2300); await page.mouse.up()
  await expect(page.getByRole('button', { name: "Let's go" })).toBeVisible({ timeout: 8000 })
  const after = await page.evaluate(async () => {
    const counts = await new Promise<{ solves: number; family: unknown }>((res) => {
      const req = indexedDB.open('nicdoku')
      req.onsuccess = () => {
        const tx = req.result.transaction(['solves', 'kv'])
        const c = tx.objectStore('solves').count()
        const f = tx.objectStore('kv').get('family')
        tx.oncomplete = () => res({ solves: c.result, family: f.result })
      }
    })
    return { ...counts, progress: localStorage.getItem('nd:progress'), name: JSON.parse(localStorage.getItem('nd:settings') || '{}').name }
  })
  expect(after.solves).toBe(0)
  expect(after.family).toBeTruthy() // kept by default
  expect(after.progress === null || JSON.parse(after.progress).level === 1).toBe(true)
  expect(after.name).toBe('Jo') // settings kept by default
  // fresh start: level 1
  await page.getByRole('button', { name: "Let's go" }).click()
  await expect(page.getByLabel('Starting level')).toHaveValue('1')
})

test('past dailies: replay yesterday, race the day, never counted; month card and comebacks in stats', async ({ page }) => {
  await skipOnboarding(page)
  // yesterday's daily took 10:00, and before that she'd been away for over a week
  await page.evaluate(async () => {
    const day = (k: number) => {
      const d = new Date()
      d.setDate(d.getDate() - k)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const rec = (k: number, over: object) => ({
      at: Date.now() - k * 86_400_000, day: day(k), mode: 'session', sessionId: `s${k}`, level: 100, n: 9,
      difficulty: 'medium', grade: 2, timeMs: 120_000, firstTapMs: 2000, mistakes: 0, hints: 0, assists: 0,
      undos: 0, clean: true, score: 500, themeId: 'x', ...over,
    })
    const recs = [rec(12, {}), rec(11, {}), rec(10, {}), rec(1, { mode: 'daily', sessionId: undefined, timeMs: 600_000 })]
    await new Promise<void>((res, rej) => {
      const req = indexedDB.open('nicdoku')
      req.onsuccess = () => {
        const tx = req.result.transaction('solves', 'readwrite')
        for (const r of recs) tx.objectStore('solves').add(r)
        tx.oncomplete = () => { req.result.close(); res() }
        tx.onerror = () => rej(tx.error)
      }
      req.onerror = () => rej(req.error)
    })
  })
  await page.reload()
  await page.getByRole('button', { name: /Past dailies · 2 replays left today/ }).click()
  await expect(page.getByText('2 of 2 replays left today')).toBeVisible()
  const row = page.locator('.archive-row').first()
  await expect(row).toContainText('On the day 10:00')

  await row.locator('.ar-play').click()
  await expect(page.locator('.mode-chip')).toContainText(/Daily from .* · not counted/)
  await solveCurrent(page)
  await expect(page.locator('.win-line')).toContainText(/faster than on the day \(10:00\)/)
  await page.locator('.win-btn.ready').click()

  // straight back to the archive, one replay used, replay time shown
  await expect(page.getByText('1 of 2 replays left today')).toBeVisible()
  await expect(page.locator('.archive-row').first()).toContainText(/Replay \d+:\d\d ↑/)

  // stats: the replay isn't a PB or counted time; the month card and comeback show
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: /Stats/ }).click()
  await expect(page.locator('.month-card')).toContainText('Dailies')
  await expect(page.getByRole('button', { name: 'Share as a picture' })).toBeVisible()
  await expect(page.locator('.ps-card', { hasText: 'Comebacks' })).toContainText('Came back 1 time after 3+ days away')
})

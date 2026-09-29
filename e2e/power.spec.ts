import { test, expect, type Page } from '@playwright/test'

// The hour runs 60× faster here (dev-only localStorage flag): 60 min → 60 s, spins every ~10 s at first.
// (At 120× spins came every few seconds and taps could land mid-turn, which a person never does.)
const SCALE = 60

type Saved = { puzzle: { n: number; solution: number[] }; marks: number[]; done: boolean; mode: string }

async function setup(page: Page) {
  await page.goto('/')
  await page.evaluate((scale) => {
    localStorage.clear()
    localStorage.setItem('nd:settings', JSON.stringify({ onboarded: true, name: 'Nicola' }))
    localStorage.setItem('nd:installHintDismissed', '1')
    localStorage.setItem('nd:progress', JSON.stringify({ level: 135, salt: 'e2e' }))
    localStorage.setItem('nd:debugPowerScale', String(scale))
  }, SCALE)
  await page.reload()
}

const current = (page: Page): Promise<Saved> => page.evaluate(() => JSON.parse(localStorage.getItem('nd:game') || 'null'))

async function doubleTap(page: Page, index: number) {
  const box = (await page.locator('.board .cell').nth(index).boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  for (let k = 0; k < 2; k++) {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
  }
}

/** Solve whatever is on the board by tapping solution cells (works on a rotated/mirrored board too). */
async function solve(page: Page) {
  await expect(page.locator('.board')).toBeVisible()
  const g = await current(page)
  const n = g.puzzle.n
  for (let r = 0; r < n; r++) {
    const i = r * n + g.puzzle.solution[r]
    if (await page.locator(`.board .cell[data-i="${i}"] .piece`).count()) continue
    await doubleTap(page, i)
    await page.waitForTimeout(30)
  }
}

test('power hour: start → play → spins → TIME. → breathe → results → rest until tomorrow', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await setup(page)

  await page.locator('.power-card').click()
  await expect(page.getByRole('heading', { name: 'Power', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('switch', { name: /sound/i }).click() // off for the test
  await page.getByRole('button', { name: /Start 60 minutes/ }).click()

  await expect(page.locator('.game-screen.power')).toBeVisible()
  await expect(page.locator('.power-clock')).toBeVisible()

  // first puzzle: a solve shows a burst, then the next puzzle loads by itself
  const first = await current(page)
  expect(first.mode).toBe('power')
  await solve(page)
  await expect(page.locator('.burst')).toBeVisible()
  await expect.poll(async () => JSON.stringify((await current(page)).puzzle), { timeout: 5000 }).not.toBe(JSON.stringify(first.puzzle))

  // first spin at 10 min (≈10 s here): board turns a quarter
  await expect.poll(async () => page.locator('.spin-outer').getAttribute('style'), { timeout: 15_000 }).toContain('rotate(90deg)')
  // and she can still solve on the turned board
  await page.waitForTimeout(1100) // let the turn animation finish
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem('nd:power') || '{}'))).solves.length
  await solve(page)
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('nd:power') || '{}'))).solves.length, { timeout: 4000 }).toBeGreaterThan(before)

  // the hour ends by itself: TIME. then the breathing wind-down
  await expect(page.locator('.time-slam')).toBeVisible({ timeout: 70_000 })
  await expect(page.locator('.breathe')).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 15_000 })

  await expect(page.getByRole('heading', { name: /Power run done/ })).toBeVisible()
  await expect(page.locator('.pd-stats .big-num').first()).not.toHaveText('0')
  await page.getByRole('button', { name: 'Skip' }).click() // mood after
  await page.getByRole('button', { name: 'See you tomorrow' }).click()

  // everything rests until tomorrow, even after a reload
  await expect(page.getByText(/All done for today/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Start a break/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Daily puzzle/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/All done for today/)).toBeVisible()
  expect(errors).toEqual([])
})

test('power hour survives closing the app mid-hour', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await setup(page)
  await page.locator('.power-card').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('switch', { name: /sound/i }).click()
  await page.getByRole('button', { name: /Start 60 minutes/ }).click()
  await expect(page.locator('.game-screen.power')).toBeVisible()
  await page.waitForTimeout(1500)
  await page.reload()
  await expect(page.locator('.game-screen.power')).toBeVisible()
  await expect(page.locator('.board')).toBeVisible()
})

test('gentle day switch shortens rests and can be turned off', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Not feeling great today?' }).click()
  await expect(page.getByText('Gentle day')).toBeVisible()
  await page.getByRole('button', { name: 'Turn off' }).click()
  await expect(page.getByText('Gentle day')).toHaveCount(0)
})

async function openIntro(page: Page) {
  await page.locator('.power-card').click()
  await expect(page.locator('.power-intro')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click() // mood
  await page.getByRole('switch', { name: /sound/i }).click() // sound off for tests
}

test('10-minute wild run: neon board, SYSTEM HALT, rests 10 min, 50 min left', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await setup(page)
  await openIntro(page)
  await page.locator('.pi-lengths button', { hasText: '10' }).click()
  await page.locator('.pi-slider-labels button', { hasText: 'Wild' }).click()
  await expect(page.locator('.power-intro.pi-wild')).toBeVisible()
  await page.getByRole('button', { name: /Start 10 minutes/ }).click()

  await expect(page.locator('.game-screen.power.mode-wild')).toBeVisible()
  // neon palette on the board
  const bg = await page.locator('.board .cell').first().evaluate((el) => getComputedStyle(el).backgroundColor)
  const neon = ['rgb(255, 43, 214)', 'rgb(0, 240, 255)', 'rgb(57, 255, 20)', 'rgb(255, 230, 0)', 'rgb(255, 106, 0)', 'rgb(176, 38, 255)',
    'rgb(0, 255, 156)', 'rgb(255, 56, 96)', 'rgb(77, 124, 255)', 'rgb(255, 158, 245)', 'rgb(198, 255, 0)']
  expect(neon).toContain(bg)
  // a 10-minute run at 60× lasts 10 s, then the wild ending
  await expect(page.locator('.time-slam.slam-wild')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.time-slam b')).toHaveText('SYSTEM HALT')
  await expect(page.locator('.breathe')).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 15_000 })
  await expect(page.getByText(/10 minutes · Wild/)).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click() // mood after
  await page.getByRole('button', { name: /Rest now · 50 min of Power left today/ }).click()

  // resting for 10 minutes: nothing starts, but it isn't "done for the day"
  await expect(page.getByText(/Resting after your 10-minute run/)).toBeVisible()
  await expect(page.getByText('50 Power minutes left today')).toBeVisible()
  await expect(page.getByRole('button', { name: /Start a break/ })).toHaveCount(0)

  // when the rest is over, 50 minutes remain: 60 no longer fits, 45 does
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('nd:progress') || '{}')
    localStorage.setItem('nd:progress', JSON.stringify({ ...p, powerRestUntil: Date.now() - 1 }))
  })
  await page.reload()
  await expect(page.getByRole('button', { name: /Start a break/ })).toBeVisible()
  await page.locator('.power-card').click()
  await expect(page.locator('.pi-lengths button', { hasText: '60' })).toBeDisabled()
  await expect(page.locator('.pi-lengths button', { hasText: '45' })).toBeEnabled()
  expect(errors).toEqual([])
})

test('calm runs never spin the board', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await setup(page)
  await openIntro(page)
  await page.locator('.pi-lengths button', { hasText: '10' }).click()
  await page.locator('.pi-slider-labels button', { hasText: 'Calm' }).click()
  await page.getByRole('button', { name: /Start 10 minutes/ }).click()
  await expect(page.locator('.game-screen.power.mode-calm')).toBeVisible()
  // at 60× the first normal spin would come at ~1.7 s; wait well past several
  await page.waitForTimeout(5000)
  expect(await page.locator('.spin-outer').getAttribute('style')).toContain('rotate(0deg)')
})

test('ending early rests only for the minutes actually played', async ({ page }) => {
  test.setTimeout(90_000)
  page.on('dialog', (d) => d.accept()) // "End this run now?"
  await setup(page)
  await openIntro(page)
  await page.locator('.pi-lengths button', { hasText: '60' }).click()
  await page.getByRole('button', { name: /Start 60 minutes/ }).click()
  await expect(page.locator('.game-screen.power')).toBeVisible()
  await page.waitForTimeout(3000) // ≈3 minutes at 60×
  await page.getByRole('button', { name: 'End Power Hour' }).click()
  await expect(page.locator('.breathe')).toBeVisible({ timeout: 8000 })

  const pr = await page.evaluate(() => JSON.parse(localStorage.getItem('nd:progress') || '{}'))
  // a few minutes used, not the full 60, and not done for the day
  expect(pr.powerUsedMin).toBeGreaterThanOrEqual(1)
  expect(pr.powerUsedMin).toBeLessThanOrEqual(6)
  expect(pr.restDay ?? null).not.toBe(new Date().toISOString().slice(0, 10))
  // the rest matches the minutes played
  const restMin = (pr.powerRestUntil - Date.now()) / 60_000
  expect(restMin).toBeGreaterThan(pr.powerUsedMin - 1)
  expect(restMin).toBeLessThanOrEqual(pr.powerUsedMin)

  // after the rest, 45 still fits (and 60 doesn't)
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('nd:progress') || '{}')
    localStorage.setItem('nd:progress', JSON.stringify({ ...p, powerRestUntil: Date.now() - 1 }))
    const r = JSON.parse(localStorage.getItem('nd:power') || '{}')
    localStorage.setItem('nd:power', JSON.stringify({ ...r, seen: true }))
  })
  await page.goto('/')
  await page.locator('.power-card').click()
  await expect(page.locator('.pi-lengths button', { hasText: '45' })).toBeEnabled()
  await expect(page.locator('.pi-lengths button', { hasText: '60' })).toBeDisabled()
})

test('records: two 5-min runs → standing, story and a record book with colours', async ({ page }) => {
  test.setTimeout(360_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await setup(page)
  // 5× here: a 5-minute run lasts 60 s and the first spin comes at 10 s, so scripted taps never land mid-turn
  await page.evaluate(() => localStorage.setItem('nd:debugPowerScale', '5'))
  await page.reload()

  async function fiveMinuteRun() {
    await openIntro(page)
    await page.locator('.pi-lengths button', { hasText: /^5/ }).first().click()
    await page.getByRole('button', { name: /Start 5 minutes/ }).click()
    await expect(page.locator('.game-screen.power')).toBeVisible()
    await solve(page) // at least one puzzle, with every piece timed
    await expect
      .poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('nd:power') || '{}'))).solves?.length ?? 0, { timeout: 5000 })
      .toBeGreaterThan(0)
    await expect(page.locator('.time-slam')).toBeVisible({ timeout: 75_000 })
    await expect(page.locator('.breathe')).toBeVisible({ timeout: 6000 })
    await page.getByRole('button', { name: 'Skip' }).click({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Power run done/ })).toBeVisible()
  }

  await fiveMinuteRun()
  await expect(page.locator('.pd-records')).toContainText('Your first 5-min Normal run')
  await expect(page.locator('.pd-story-row').first()).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click() // mood
  await page.locator('.power-done .btn').click()
  // skip the 5-minute rest
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('nd:progress') || '{}')
    localStorage.setItem('nd:progress', JSON.stringify({ ...p, powerRestUntil: Date.now() - 1 }))
  })
  await page.goto('/')

  await fiveMinuteRun()
  await expect(page.locator('.pd-standing')).toContainText(/of 2 in 5-min Normal/)
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.locator('.power-done .btn').click()

  // the record book in Stats
  await page.getByRole('button', { name: /Stats/ }).first().click()
  await page.getByRole('tab', { name: /Power/ }).click()
  await expect(page.getByRole('heading', { name: '5-min Normal records' })).toBeVisible()
  await expect(page.locator('.rt-row', { hasText: 'Quickest 1st correct piece' })).toBeVisible()
  await expect(page.locator('.rt-group', { hasText: 'Fastest to each colour' }).locator('.rt-row').first()).toBeVisible()
  expect(errors).toEqual([])
})

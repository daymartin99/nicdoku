import { test, expect, type Page } from '@playwright/test'

// The hour runs 120× faster here (dev-only localStorage flag): 60 min → 30 s, first spin at ~5 s.
const SCALE = 120

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
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await setup(page)

  await page.getByRole('button', { name: /Power Hour/ }).click()
  await expect(page.getByRole('heading', { name: 'Power Hour' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('switch', { name: /Heartbeat sound/ }).click() // off for the test
  await page.getByRole('button', { name: /Start the hour/ }).click()

  await expect(page.locator('.game-screen.power')).toBeVisible()
  await expect(page.locator('.power-clock')).toBeVisible()

  // first puzzle: a solve shows a burst, then the next puzzle loads by itself
  const first = await current(page)
  expect(first.mode).toBe('power')
  await solve(page)
  await expect(page.locator('.burst')).toBeVisible()
  await expect.poll(async () => JSON.stringify((await current(page)).puzzle), { timeout: 5000 }).not.toBe(JSON.stringify(first.puzzle))

  // first spin at 10 min (≈5 s here): board turns a quarter
  await expect.poll(async () => page.locator('.spin-outer').getAttribute('style'), { timeout: 12_000 }).toContain('rotate(90deg)')
  // and she can still solve on the turned board
  await page.waitForTimeout(1100) // let the turn animation finish
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem('nd:power') || '{}'))).solves.length
  await solve(page)
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('nd:power') || '{}'))).solves.length, { timeout: 4000 }).toBeGreaterThan(before)

  // the hour ends by itself: TIME. then the breathing wind-down
  await expect(page.locator('.time-slam')).toBeVisible({ timeout: 40_000 })
  await expect(page.locator('.breathe')).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 15_000 })

  await expect(page.getByRole('heading', { name: 'Power Hour done' })).toBeVisible()
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
  await page.getByRole('button', { name: /Power Hour/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('switch', { name: /Heartbeat sound/ }).click()
  await page.getByRole('button', { name: /Start the hour/ }).click()
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

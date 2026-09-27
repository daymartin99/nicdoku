import { webkit, devices } from '@playwright/test'
const base = 'http://localhost:4175'
const browser = await webkit.launch()
async function mk(dev) {
  const ctx = await browser.newContext({ ...dev, baseURL: base })
  const page = await ctx.newPage()
  await page.goto('/manifest.webmanifest')
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('nd:settings', JSON.stringify({ onboarded: false, name: 'Nicola' })); localStorage.setItem('nd:installHintDismissed','1') })
  await page.goto('/'); await page.waitForTimeout(700)
  return page
}
const out = 'docs/review/extra/'
let p = await mk(devices['iPhone 13'])
await p.getByRole('button', { name: "Let's go" }).click(); await p.waitForTimeout(300)
await p.screenshot({ path: out + 'sat-ob-step1.png' })
await p.getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(300)
await p.screenshot({ path: out + 'sat-ob-step2.png' })
await p.getByRole('button', { name: 'Start playing' }).click(); await p.waitForTimeout(500)
// settings: scroll to family, click Add a birthday, save empty
await p.getByRole('button', { name: 'Settings' }).click(); await p.waitForTimeout(400)
await p.getByRole('button', { name: 'Add a birthday' }).click(); await p.waitForTimeout(200)
await p.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(300)
await p.screenshot({ path: out + 'sat-family-save-empty.png' })
await p.getByRole('switch', { name: /Use my photo/ }).click(); await p.waitForTimeout(300)
await p.screenshot({ path: out + 'sat-photo-toggle-nophoto.png' })
const se = await mk(devices['iPhone SE'])
await se.getByRole('button', { name: "Let's go" }).click(); await se.getByRole('button', { name: 'Next' }).click(); await se.waitForTimeout(300)
await se.screenshot({ path: out + 'sat-ob-step2-se.png' })
await browser.close()

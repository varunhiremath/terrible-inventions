/**
 * What the live app says when the address cannot work.
 *
 * The rule is the browser's and cannot be unit-tested from a dev server, where
 * it does not apply (`scripts/mixed.mjs`). So: the real site, a wifi `ws://`
 * address typed into the lobby, and whatever comes back on screen.
 */
import { chromium } from 'playwright'

const SITE = process.argv[2] ?? 'https://varunhiremath.com/terrible-inventions/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 900, height: 560 }, ignoreHTTPSErrors: true })
const problems = []
page.on('pageerror', (e) => problems.push(`page error ${e.message}`))

for (let tries = 0; tries < 4; tries++) {
  try {
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    break
  } catch (error) {
    if (tries === 3) throw error
    await page.waitForTimeout(3000)
  }
}
await page.waitForTimeout(1500)
const skipAll = async () => {
  for (let i = 0; i < 3; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(600) }
  }
}
await skipAll()
await page.getByRole('button', { name: 'The Road' }).first().click()
await page.waitForTimeout(1200)
await skipAll()

const setUp = page.getByRole('button', { name: 'Set up' })
if (!(await setUp.count())) {
  console.log('no Set up button on the road — the garage did not open')
  await page.screenshot({ path: '/tmp/relay-say-road.png' })
  await browser.close()
  process.exit(1)
}
await setUp.first().click()
await page.waitForTimeout(500)

const box = page.getByLabel('Relay address')
console.log('address box:', await box.count())
await box.first().fill('ws://192.168.1.24:8787')
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Start a race' }).first().click()
await page.waitForTimeout(2500)

console.log('--- on screen ---')
console.log((await page.locator('body').innerText()).trim())
console.log('--- problems:', problems.length ? problems.join(' | ') : 'none')
await page.screenshot({ path: '/tmp/relay-say.png' })
await browser.close()

/**
 * Running an actual level to the flagpole, in a browser, and photographing it.
 *
 * The slide and the banding are unit tested; what no test can see is whether
 * any of it is on the screen. So: hold right, run, jump often enough to clear
 * what is in the way, and take a picture the moment the level is won.
 */
import { chromium } from 'playwright'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 820, height: 460 }, ignoreHTTPSErrors: true })
const problems = []
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1200)
for (let i = 0; i < 4; i++) {
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
}
await page.getByRole('button', { name: /The Pipes/i }).first().click()
await page.waitForTimeout(900)
for (let i = 0; i < 4; i++) {
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600) }
}
await page.waitForTimeout(600)

const bar = async () => (await page.locator('header').innerText()).replace(/\s+/g, ' ')
console.log('opened on:', await bar())

await page.keyboard.down('ArrowRight')
await page.keyboard.down('Shift')

let shots = 0
let won = false
for (let t = 0; t < 70 && !won; t++) {
  // Jump most of the time: it clears goombas, gaps and the staircase at the
  // end, and a held jump is why he reaches the top of the pole.
  await page.keyboard.down(' ')
  await page.waitForTimeout(260)
  await page.keyboard.up(' ')
  await page.waitForTimeout(160)

  const text = await page.locator('body').innerText()
  if (/flagpole|level \d+ done|on to level|nice/i.test(text)) won = true
  // A death card: take another go.
  const again = page.getByRole('button', { name: /try again|another go|next life|keep going/i })
  if (await again.count()) {
    await again.first().click()
    await page.waitForTimeout(500)
  }
  if (t % 8 === 0 && shots < 6) {
    await page.screenshot({ path: `/tmp/pipes-${shots++}.png` })
  }
}
await page.keyboard.up('ArrowRight')
await page.keyboard.up('Shift')
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/pipes-end.png' })
console.log('bar now:', await bar())
console.log('won card:', won)
console.log('--- problems:', problems.length ? problems.join(' | ') : 'none')
await browser.close()

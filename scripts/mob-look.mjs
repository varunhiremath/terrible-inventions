/**
 * Playing the swarm in a real browser, because the rules being right is not the
 * same as the game being playable.
 *
 * Opens the app, walks in through the front screen, skips the story, slides the
 * cart about for a few seconds and takes pictures. What it is looking for is
 * what no unit test can see: whether the numbers on the gates are readable,
 * whether a squad looks like a crowd, and whether anything throws.
 */
import { chromium } from 'playwright'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 430, height: 860 }, ignoreHTTPSErrors: true })
const problems = []
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1500)

const skip = async () => {
  for (let i = 0; i < 4; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(500) }
  }
}
await skip()

const tile = page.getByRole('button', { name: /The Swarm/i })
console.log('tile on the front screen:', await tile.count())
await page.screenshot({ path: '/tmp/mob-home.png' })
if (await tile.count() === 0) {
  console.log('MOB FAILED: no tile')
  await browser.close()
  process.exit(1)
}
await tile.first().click()
await page.waitForTimeout(1200)
await skip()
await page.waitForTimeout(600)

const box = await page.locator('canvas').first().boundingBox()
if (!box) { console.log('MOB FAILED: no canvas'); await browser.close(); process.exit(1) }

// Slide the cart across the lane a few times, as somebody playing would.
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8)
await page.mouse.down()
for (const [i, at] of [0.2, 0.75, 0.35, 0.6, 0.15].entries()) {
  await page.mouse.move(box.x + box.width * at, box.y + box.height * 0.8, { steps: 8 })
  await page.waitForTimeout(1600)
  if (i === 1 || i === 3) {
    await page.screenshot({ path: `/tmp/mob-play-${i}.png` })
  }
}
await page.mouse.up()
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/mob-play-last.png' })

const head = await page.locator('body').innerText()
console.log('--- on screen ---')
console.log(head.split('\n').slice(0, 6).join(' | '))
console.log('--- problems:', problems.length ? problems.join(' | ') : 'none')
await browser.close()

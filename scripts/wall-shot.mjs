/**
 * A look at the wall.
 *
 * Not a test. Whether a brick reads as a brick, whether the ball is big enough
 * to follow, and whether a charm falling is legible at the size it is actually
 * played at are all invisible to the suite and obvious in a picture.
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/wall-shot.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/wall'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/home.png` })

await page.getByRole('button', { name: /the wall/i }).first().click()
await page.waitForTimeout(400)
const skip = page.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700) }

const box = await page.locator('canvas').first().boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height * 0.9

await page.screenshot({ path: `${OUT}/waiting.png` })

// Let it go, then chase the ball with a finger for a while, which is the game.
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.up()
for (let i = 0; i < 90; i++) {
  const x = cx + Math.sin(i / 7) * box.width * 0.3
  await page.mouse.move(x, cy)
  await page.mouse.down()
  await page.waitForTimeout(90)
  await page.mouse.up()
  if (i === 30) await page.screenshot({ path: `${OUT}/playing.png` })
}
await page.screenshot({ path: `${OUT}/later.png` })
console.log(OUT)
await browser.close()

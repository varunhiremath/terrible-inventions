/**
 * A look at the garden.
 *
 * Not a test. Nothing in the suite can tell whether a snake reads as a snake,
 * whether the pellets are big enough to aim at, or whether the camera is so
 * far out that the whole thing is a screensaver — and every one of those has
 * been wrong in this project at least once while the tests were green.
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/garden-shot.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/garden'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/home.png` })

await page.getByRole('button', { name: /the garden/i }).first().click()
await page.waitForTimeout(500)
const skip = page.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(800) }

// Early, so the snake is short and the pellets are the thing.
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/early.png` })

/*
 * Then play it, with the keyboard, in circles — which is how you grow and also
 * the only way to see a ring close. A still of a snake going straight says
 * nothing about the move the whole game is for.
 */
const turns = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
for (let i = 0; i < 40; i++) {
  await page.keyboard.down(turns[i % 4])
  await page.waitForTimeout(400)
  await page.keyboard.up(turns[i % 4])
  if (i === 20) await page.screenshot({ path: `${OUT}/playing.png` })
}
await page.screenshot({ path: `${OUT}/later.png` })
console.log(OUT)
await browser.close()

/**
 * The gun getting hot, photographed.
 *
 * The bar under the ship is the only thing telling a player why the gun has
 * stopped, so it has to be legible at the size it is actually seen — and a bar
 * drawn at the wrong scale, or behind the ship, or off the bottom of the
 * screen is invisible to every test in the suite.
 *
 * Fires for long enough to shut it, photographs it part-full and shut, with
 * the whole kit aboard so the heat climbs at the rate the complaint is about.
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/heat-shot.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/heat'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByRole('button', { name: /the long way out/i }).first().click()
await page.waitForTimeout(500)
const skip = page.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(900) }

// Hold the trigger, and photograph on the way up and after it shuts.
await page.keyboard.down(' ')
/*
 * The last one is a long hold on purpose. This is a fresh run with the gun it
 * starts with, which takes nine seconds of unbroken fire to shut — that is the
 * whole design, and it means a short probe photographs a bar that never turns
 * red and reports the shut state as working without ever having seen it.
 */
for (const [tag, wait] of [['warm', 1200], ['hot', 1100], ['shut', 16000]]) {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}/${tag}.png` })
  console.log(tag)
}
await page.keyboard.up(' ')
await browser.close()
console.log(OUT)

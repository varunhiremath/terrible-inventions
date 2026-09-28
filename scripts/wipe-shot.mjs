/**
 * What the six level transitions actually look like, caught mid-walk.
 *
 * Three moments through the two and a half seconds, each one started by the
 * page rather than timed from the page load. Timing them from the load was
 * wrong in both directions at once — photographing six animating canvases
 * takes longer than the gap between two samples, so the later shots came back
 * as copies of the first; and the wipes had been running since well before
 * the load went quiet, so the last sample landed past the end, which is a
 * deliberate fade to black. Neither failure looked like a failure.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/wipes', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 1080 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)

for (const [tag, at, phone] of [
  ['early', 400, false],
  ['middle', 1100, false],
  ['late', 1900, false],
  // And once in the shape these are actually watched in, because how much of
  // a scene fits depends on it and a desktop grid cannot be that shape.
  ['phone', 1100, true],
]) {
  await page.setViewportSize(phone ? { width: 2340, height: 800 } : { width: 1200, height: 1080 })
  // Mounted here, so the wait below is the time these have actually been
  // running rather than the time since the page loaded.
  await page.evaluate((tall) => window.__go(tall), phone)
  await page.waitForTimeout(at)

  await page.screenshot({ path: `/tmp/wipes/${tag}.png` })

  // The bench has now lied twice about how big its canvases are, and both
  // times the photographs looked fine. So it says so.
  const wrong = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')]
      .map((c, i) => {
        const box = c.getBoundingClientRect()
        const cell = c.closest('.cell').getBoundingClientRect()
        return Math.abs(box.height - cell.height) > 1 ? `${i}: ${box.height} in ${cell.height}` : ''
      })
      .filter(Boolean),
  )
  if (wrong.length) {
    console.log('BENCH BROKEN, canvases not filling their cells:', wrong.join(', '))
    process.exit(1)
  }
}
await page.close()
await browser.close()
console.log('shots in /tmp/wipes')

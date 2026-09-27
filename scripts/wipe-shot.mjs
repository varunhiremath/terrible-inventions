/** What the six level transitions actually look like, caught mid-walk. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/wipes', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 560 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })
// Three moments through the two and a half seconds, since a still of an
// animation says very little on its own.
for (const [tag, wait] of [['early', 500], ['middle', 700], ['late', 700]]) {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `/tmp/wipes/${tag}.png` })
}
await browser.close()
console.log('shots in /tmp/wipes')

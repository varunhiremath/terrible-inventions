/**
 * One photograph of the flood at five water levels.
 *
 *     npx vite --port 5199
 *     node scripts/flood-shot.mjs
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1700, height: 800 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()) })
await page.goto('http://127.0.0.1:5199/flood.html', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true, { timeout: 20000 })
const out = process.env.SHOT_OUT ?? '/tmp/flood.png'
await page.screenshot({ path: out, fullPage: true })
console.log(out)
await browser.close()

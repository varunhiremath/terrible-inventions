/**
 * Every wall, drawn, so the shapes can be looked at rather than imagined.
 *
 * The brief was "start with very simple levels and then make the maze more
 * complex", which is a claim about what a dozen pictures look like next to
 * each other — and the one thing a test cannot check is whether they do.
 *
 *     npx vite --port 5199 &
 *     node scripts/walls-shot.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/walls', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/walls.html', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)
const sizes = await page.evaluate(() => window.__sizes())
if (sizes.some((s) => s[1] < 200)) throw new Error(`a cell is only ${sizes[0]}px — the page is not laid out`)
await page.screenshot({ path: '/tmp/walls/all.png', fullPage: true })
console.log('/tmp/walls/all.png')
await browser.close()

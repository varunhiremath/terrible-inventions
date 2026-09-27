/**
 * Two people on one tablet: does the split screen actually work?
 *
 * A screenshot is the only way to answer this. The model can be tested and is;
 * what cannot be tested is whether each half shows the right car in the right
 * place, whether the two pads land where two pairs of thumbs would be, and
 * whether a tablet-shaped screen has room for any of it.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/twoup', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
// A tablet held sideways, which is what this mode is for.
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
for (let i = 0; i < 3; i++) {
  const s = page.getByRole('button', { name: 'Skip' })
  if (await s.count()) { await s.first().click(); await page.waitForTimeout(500) }
}
await page.getByRole('button', { name: 'The Road' }).first().click()
await page.waitForTimeout(900)
for (let i = 0; i < 3; i++) {
  const s = page.getByRole('button', { name: 'Skip' })
  if (await s.count()) { await s.first().click(); await page.waitForTimeout(700) }
}
await page.waitForTimeout(700)

const toggle = page.getByRole('switch', { name: 'Two players' })
if (!(await toggle.count())) { console.log('PROBLEM: no two-player switch in the garage'); process.exit(1) }
await toggle.first().click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/twoup/garage.png' })
await page.getByRole('button', { name: /drive it/i }).first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/twoup/grid.png' })

// Both hold the pedal: player one on the keyboard, player two by finger on
// their own half of the pad.
await page.keyboard.down('ArrowUp')
const box = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const r = c.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
// Their GO button: bottom right of the right-hand half.
await page.mouse.move(box.x + box.w - 60, box.y + box.h - 60)
await page.mouse.down()
await page.waitForTimeout(5000)
await page.screenshot({ path: '/tmp/twoup/racing.png' })
await page.mouse.up()
await page.keyboard.up('ArrowUp')
const hud = await page.evaluate(() => document.querySelector('header')?.textContent?.replace(/\s+/g, ' ').trim())
console.log('hud:', hud)
await browser.close()
console.log('shots in /tmp/twoup')

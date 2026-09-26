/**
 * A look at the new game, and at the front door with six tiles on it.
 *
 * Not a test: the things that go wrong in drawing code are invisible to a test
 * and obvious in a picture. Every bug in this project that survived a green
 * suite was found by looking at one of these.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4173/'
const OUT = process.env.OUT ?? '/tmp/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [name, size] of [
  ['portrait', { width: 412, height: 915 }],
  ['landscape', { width: 915, height: 412 }],
]) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/home-${name}.png` })

  // Straight into the flight: the intro is watched elsewhere.
  await page.evaluate(() => {
    const store = window.__store
    if (store) store.getState().go('space')
  })
  const tile = page.getByRole('button', { name: /long way out/i })
  if (await tile.count()) await tile.first().click()
  await page.waitForTimeout(1200)
  // Skip the intro if one is playing.
  const skip = page.getByRole('button', { name: /skip|start|play/i })
  if (await skip.count()) await skip.first().click().catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${OUT}/space-${name}.png` })
  await page.close()
}

await browser.close()
console.log('shots in', OUT)

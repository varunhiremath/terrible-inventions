/**
 * What the road actually looks like: the garage, the grid, and the readouts.
 *
 * Three things this has to answer that no test can. Does the garage draw
 * twelve different cars. Does the grid read as a grid with numbers painted on
 * it. And is the position readout somewhere you can actually see it, rather
 * than underneath the Back button — which is a thing that has happened.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/road'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 915, height: 412 } })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const skip = page.getByRole('button', { name: 'Skip' })
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }

// The front screen is a world you walk around, so the road is a door in it.
const door = page.getByRole('button', { name: 'The Road' })
await door.first().click()
await page.waitForTimeout(800)
// Each game plays its own opening story, and it sits over everything.
for (let i = 0; i < 3; i++) {
  const s = page.getByRole('button', { name: 'Skip' })
  if (await s.count()) { await s.first().click(); await page.waitForTimeout(700) }
}
await page.waitForTimeout(800)

// The garage opens by itself the first time.
const garage = page.getByRole('button', { name: /drive it/i })
if (await garage.count()) {
  await page.screenshot({ path: `${OUT}/garage.png` })
  console.log('garage: opened on the first visit')
  await garage.first().click()
  await page.waitForTimeout(600)
} else {
  console.log('garage: DID NOT OPEN')
}

// The grid, before the lights go out.
await page.screenshot({ path: `${OUT}/grid.png` })

// Where the position readout sits, against where the Back button sits.
const boxes = await page.evaluate(() => {
  const back = document.querySelector('button[aria-label="Back to the menu"]')
  return { back: back ? back.getBoundingClientRect().toJSON() : null }
})
console.log('back button:', JSON.stringify(boxes.back))

// And mid-race, once everybody is moving.
await page.waitForTimeout(4000)
await page.screenshot({ path: `${OUT}/racing.png` })
const header = await page.evaluate(() => document.querySelector("header")?.textContent ?? "no header")
console.log('readout says:', (header ?? '').replace(/\s+/g, ' ').trim())

await browser.close()

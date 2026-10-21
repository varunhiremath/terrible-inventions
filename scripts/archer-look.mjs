/**
 * Standing in the meadow in a real browser.
 *
 * This is the one game here that cannot be judged from its tests at all. The
 * simulation is proven — a bot in `run.test.ts` lands arrows at every range —
 * but "is it somewhere you would want to stand" is a question only a picture
 * answers, and the brief was explicit about it: make it look real, with good
 * visuals, not a flat arcade game.
 *
 * So: open the app, walk in, look around, draw the bow, loose a few arrows,
 * and take pictures of all of it. It also watches for the two failures that
 * are invisible in a still — a WebGL context that never came up, and a frame
 * rate that makes aiming impossible.
 */
import { chromium } from 'playwright'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 430, height: 860 }, ignoreHTTPSErrors: true })
const problems = []
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1500)

const skip = async () => {
  for (let i = 0; i < 4; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(500) }
  }
}
await skip()

const tile = page.getByRole('button', { name: /The Meadow/i })
console.log('tile on the front screen:', await tile.count())
await page.screenshot({ path: '/tmp/archer-home.png' })
if (await tile.count() === 0) {
  console.log('ARCHER FAILED: no tile')
  await browser.close()
  process.exit(1)
}
await tile.first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/archer-story.png' })
await skip()
await page.waitForTimeout(1500)

const box = await page.locator('div.relative.min-h-0').first().boundingBox()
if (!box) { console.log('ARCHER FAILED: nowhere to aim'); await browser.close(); process.exit(1) }
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]

// Did a canvas actually come up, and is anything on it?
const canvas = await page.locator('canvas').count()
console.log('canvases:', canvas)
await page.screenshot({ path: '/tmp/archer-stand.png' })

// How fast it is drawing, which decides whether it can be aimed at all.
const fps = await page.evaluate(() => new Promise((done) => {
  let frames = 0
  const from = performance.now()
  const tick = () => {
    frames++
    if (performance.now() - from > 1500) done(Math.round((frames * 1000) / (performance.now() - from)))
    else requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}))
console.log('frames a second:', fps)

const bar = async () => (await page.locator('p.font-mono').allTextContents()).join(' | ')
console.log('bar:', await bar())

/*
 * A sweep all the way round, a picture at each stop. Balloons come up at any
 * angle, so a single screenshot of one direction is a screenshot of whichever
 * way the sky happened to be empty — which is exactly what the first few of
 * these were.
 */
for (let i = 0; i < 6; i++) {
  await page.mouse.move(...at(0.5, 0.5))
  await page.mouse.down()
  await page.mouse.move(...at(0.08, 0.5), { steps: 16 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/archer-round-${i}.png` })
}

// Then draw the bow and hold it, which is the picture that has to look good.
await page.mouse.move(...at(0.5, 0.6))
await page.mouse.down()
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/archer-draw.png' })
await page.mouse.up()
await page.waitForTimeout(150)
await page.screenshot({ path: '/tmp/archer-loose.png' })
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/archer-flight.png' })

/*
 * And then play it for a while: look a little, shoot, look a little, shoot.
 * Twenty shots is enough to hit something by accident even aiming blind, which
 * is what proves the score and the counters are wired to the shooting.
 */
let shots = 0
for (let i = 0; i < 20; i++) {
  const fx = 0.3 + (i % 5) * 0.1
  await page.mouse.move(...at(0.5, 0.5))
  await page.mouse.down()
  await page.mouse.move(...at(fx, 0.45 + (i % 3) * 0.04), { steps: 12 })
  await page.mouse.up()
  await page.mouse.move(...at(0.5, 0.6))
  await page.mouse.down()
  await page.waitForTimeout(650)
  await page.mouse.up()
  shots++
  await page.waitForTimeout(450)
  if (i === 9) await page.screenshot({ path: '/tmp/archer-play.png' })
}
await page.screenshot({ path: '/tmp/archer-after.png' })
console.log(`${shots} shots later, bar: ${await bar()}`)

if (problems.length === 0) console.log('ARCHER: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

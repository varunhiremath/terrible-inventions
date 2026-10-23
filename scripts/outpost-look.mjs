/**
 * Playing the outpost in a real browser.
 *
 * The simulation is proved in `run.test.ts` by a bot that finishes missions on
 * a dozen maps it has never seen. What no unit test can reach is everything
 * between the glass and that simulation: whether a WebGL context comes up at
 * all, whether a thumb on the left of the screen walks you forward, whether
 * the trigger fires, and whether the compound is dark in the way a night is
 * dark or in the way a bug is.
 *
 * So this walks in, looks around, shoots at what it can see, and takes
 * pictures of all of it.
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

const tile = page.getByRole('button', { name: /The Outpost/i })
console.log('tile on the front screen:', await tile.count())
await page.screenshot({ path: '/tmp/outpost-home.png' })
if (await tile.count() === 0) {
  console.log('OUTPOST FAILED: no tile')
  await browser.close()
  process.exit(1)
}
await tile.first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/outpost-story.png' })
await skip()
await page.waitForTimeout(1800)

const box = await page.locator('div.relative.min-h-0').first().boundingBox()
if (!box) { console.log('OUTPOST FAILED: nowhere to stand'); await browser.close(); process.exit(1) }
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]

const lit = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  if (!canvas) return 'no canvas'
  return (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) ? 'yes' : 'no context'
})
console.log('3D:', lit)

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

// Everything the HUD says, spans included: the distance to the objective is
// in a span, and reading only the paragraphs quietly returned nothing at all.
const bar = async () =>
  (await page.locator('p.font-mono, span.font-mono').allTextContents()).join(' | ')
console.log('bar:', (await bar()).replace(/\s+/g, ' ').slice(0, 120))
await page.screenshot({ path: '/tmp/outpost-stand.png' })

/*
 * The stick. A thumb put down in the bottom left and pushed forward has to
 * move you — which is checked by the picture changing, because there is
 * nothing on the screen that says where you are standing.
 */
const still = await page.screenshot({ clip: box })
await page.mouse.move(...at(0.2, 0.75))
await page.mouse.down()
await page.mouse.move(...at(0.2, 0.6), { steps: 6 })
await page.waitForTimeout(1600)
const walked = await page.screenshot({ clip: box })
await page.mouse.up()
if (still.equals(walked)) problems.push('the stick does not move you')

/*
 * And the look-drag, which is the other thumb.
 */
const facing = await page.screenshot({ clip: box })
await page.mouse.move(...at(0.75, 0.45))
await page.mouse.down()
await page.mouse.move(...at(0.45, 0.45), { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(400)
const turned = await page.screenshot({ clip: box })
if (facing.equals(turned)) problems.push('dragging does not turn the view')

/*
 * And then a mission, driven from the keyboard.
 *
 * Not because a player will use one — this is a phone game and the thumbs are
 * what matter — but because a scripted browser has *one* pointer, and this
 * game needs two: you cannot hold the stick forward and press the trigger
 * with the same finger. The keys go into the same input the thumbs do, one
 * step further in, so what is left untested by this is the two handlers the
 * checks above cover.
 *
 * It walks into the compound, because the machines are all at the far end of
 * it and a burst fired from the landing pad hits a wall. Then it turns and
 * fires: anything that has seen you comes to you, so blind fire finds
 * something soon enough.
 */
let best = 0
const score = async () => Number(((await bar()).match(/\b(\d{6})\b/) ?? [])[1] ?? 0)

/*
 * How far off the cage is, and which way it is — both read off the screen,
 * because the game puts them there for the player and a script may as well
 * play the way a player does. The arrow is an element turned by so many
 * degrees; its angle is the turn you have to make.
 */
const away = async () => Number(((await bar()).match(/(\d+)m/) ?? [])[1] ?? -1)
const bearing = async () => {
  const style = await page.locator('span[style*="rotate"]').first().getAttribute('style')
  return Number((style ?? '').match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? 0)
}

const before = await away()
await page.keyboard.down('w')
await page.waitForTimeout(3500)
await page.screenshot({ path: '/tmp/outpost-walk.png' })
const after = await away()
await page.keyboard.up('w')
console.log(`walked: ${before}m from the cage, then ${after}m`)
if (before > 0 && Math.abs(after - before) < 2) {
  problems.push(`holding forward for three seconds moved you ${Math.abs(after - before)}m`)
}

/*
 * And then the mission, such as a script can play it: point at whatever the
 * arrow is pointing at, walk, and fire a burst every few steps. Everything in
 * the compound is between you and the cage, so walking at it is a tour of the
 * machines — and anything that has seen you comes to meet you.
 */
const TURN = 2.9
for (let i = 0; i < 24; i++) {
  const off = ((await bearing()) * Math.PI) / 180
  if (Math.abs(off) > 0.08) {
    const dx = (off / TURN) * box.width + Math.sign(off) * 6
    await page.mouse.move(...at(0.5, 0.45))
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.5 + dx, box.y + box.height * 0.45, { steps: 8 })
    await page.mouse.up()
  }
  await page.keyboard.down('w')
  await page.keyboard.down(' ')
  await page.waitForTimeout(900)
  await page.keyboard.up(' ')
  await page.waitForTimeout(500)
  await page.keyboard.up('w')
  best = Math.max(best, await score())
  if (i === 3) await page.screenshot({ path: '/tmp/outpost-fight.png' })
  if (best > 0 && i > 4) break
}
await page.screenshot({ path: '/tmp/outpost-after.png' })
console.log(`${best} points, ${await away()}m off the cage, ` +
  `bar ${(await bar()).replace(/\s+/g, ' ').slice(0, 80)}`)
if (best === 0) console.log('OUTPOST FAILED: walked the compound firing and never hit anything')

if (problems.length === 0) console.log('OUTPOST: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

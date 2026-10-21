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
 * And then play it properly for a while.
 *
 * Not to see whether a machine can aim — it cannot, it is firing at the sky on
 * a pattern — but because over enough arrows even a blind one lands some, and
 * a score that never moves at all means the finger is not reaching the bow.
 * That is the one thing in this game no unit test can see: the simulation is
 * proven by a bot that aims properly, and the screen between the glass and the
 * simulation is proven only here.
 */
/*
 * And then play it properly, by looking.
 *
 * Firing at the sky on a pattern proves nothing: a balloon is about seven
 * degrees across at the range you meet it, and there is a whole sphere of sky
 * to be wrong in, so forty blind arrows are expected to land about a third of
 * one. The first two versions of this did exactly that, reported "nothing was
 * ever hit", and were right for the wrong reason.
 *
 * So this one finds a balloon in the picture, works out how far off the middle
 * of the screen it is, turns that into a drag, aims a little above it for the
 * drop, and shoots. Which means it is testing the entire chain — a balloon is
 * drawn where the simulation says it is, a finger moves the view by the amount
 * it should, and an arrow loosed down the middle of the screen arrives. Any
 * one of those three being wrong shows up here and nowhere else.
 */
const eyes = await browser.newPage()

/** The most colourful thing in the sky, in pixels from the middle. */
const spot = async () => {
  const shot = (await page.screenshot({ clip: box })).toString('base64')
  return eyes.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data: pixels, width, height } = ctx.getImageData(0, 0, img.width, img.height)

    /*
     * A balloon is a small thing that does not match what is beside it.
     *
     * "The most colourful thing in the sky" was the obvious test and it was
     * wrong: the sky itself is a deep saturated blue at the top of the frame,
     * so the aim settled on a patch of empty air and stayed there, converging
     * beautifully onto nothing. Local contrast cannot make that mistake — the
     * gradient is smooth across twenty pixels and a balloon is not.
     */
    const found = []
    const span = 22
    /*
     * The sight and the rule across the top are drawn over the game, not in
     * it, and a screenshot has them in it. The sight is a white cross in the
     * exact middle of the picture with as much local contrast as anything in
     * the sky, so without skipping it this aims at its own crosshair for ever
     * — which it did, reporting a target nought pixels off, every time.
     */
    for (let y = 44; y < height * 0.58; y += 2) {
      /*
       * The right of the picture is the bow, and the string down it is a pale
       * line against the sky with more contrast than any balloon. This looks
       * at the half of the sky the bow is not in; when there is nothing there
       * it turns, which is what a player does too.
       */
      for (let x = span + 2; x < width * 0.54; x += 2) {
        if (Math.abs(x - width / 2) < 28 && Math.abs(y - height / 2) < 28) continue
        const i = (y * width + x) * 4
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        if (g > r + 18 && g > b + 18) continue // grass and trees
        const off = (at) => {
          const j = (y * width + at) * 4
          return Math.abs(r - pixels[j]) + Math.abs(g - pixels[j + 1]) + Math.abs(b - pixels[j + 2])
        }
        if (Math.min(off(x - span), off(x + span)) < 55) continue
        found.push({ x, y })
      }
    }
    if (found.length === 0) return null

    // The one nearest the middle, and then the middle of everything near it,
    // so the aim is the balloon rather than one pixel of its edge.
    const cx = width / 2
    const cy = height / 2
    found.sort((a, b) =>
      Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    const near = found.filter((p) =>
      Math.hypot(p.x - found[0].x, p.y - found[0].y) < 26)
    const at = near.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 })
    return { x: at.x / near.length - cx, y: at.y / near.length - cy, pixels: near.length }
  }, shot)
}

/*
 * Pixels to radians, from the camera the game builds: seventy-two degrees from
 * top to bottom, and however much that works out to across at this shape of
 * screen. And radians to a drag, from the one constant the screen turns a
 * finger with.
 */
const TURN = 2.6
const radDown = (72 * Math.PI) / 180 / box.height
const radAcross = (2 * Math.atan(Math.tan((72 * Math.PI) / 180 / 2) * (box.width / box.height))) / box.width
const dragPer = box.width / TURN
/*
 * And the few pixels every drag loses at the start of itself. The screen has
 * to decide whether a finger is looking or pulling the string, and it decides
 * by whether it has wandered — so the wander is spent before anything turns.
 * Without putting it back every correction here came up a third short, the aim
 * settled a couple of degrees under every balloon, and nothing was ever hit.
 */
const WANDER = 7

/** Turn the view by a measured offset in pixels, lifted by `up` radians. */
const aimAt = async (seen, up) => {
  let dx = seen.x * radAcross * dragPer
  let dy = (seen.y * radDown - up) * dragPer
  const far = Math.hypot(dx, dy)
  if (far > 0.01) {
    dx += (dx / far) * WANDER
    dy += (dy / far) * WANDER
  }
  await page.mouse.move(...at(0.5, 0.5))
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5 + dx, box.y + box.height * 0.5 + dy, { steps: 10 })
  await page.mouse.up()
  return { dx, dy }
}
// Lift for the drop on the way there and for the balloon rising while the bow
// is being pulled: about five degrees between them.
const LIFT = 0.12

// One calibration shot: aim at something and see whether it ended up in the
// middle. If this number is not near zero, nothing below means anything.
for (let i = 0; i < 4; i++) {
  const before = await spot()
  if (!before) {
    await page.mouse.move(...at(0.5, 0.5))
    await page.mouse.down()
    await page.mouse.move(...at(0.78, 0.5), { steps: 10 })
    await page.mouse.up()
    continue
  }
  const { dx, dy } = await aimAt(before, 0)
  await page.waitForTimeout(250)
  const after = await spot()
  console.log(`aim: was ${before.x.toFixed(0)},${before.y.toFixed(0)} px off; dragged ${dx.toFixed(0)},${dy.toFixed(0)}; now ${after ? `${after.x.toFixed(0)},${after.y.toFixed(0)}` : 'nothing in view'}`)
}

let best = 0
let shots = 0
let aimed = 0
for (let i = 0; i < 40; i++) {
  const again = page.getByRole('button', { name: /Start again/i })
  if (await again.count()) { await again.first().click(); await page.waitForTimeout(600) }

  const seen = await spot()
  if (seen === null) {
    // Nothing in view: turn a fifth of the way round and look again.
    await page.mouse.move(...at(0.5, 0.5))
    await page.mouse.down()
    await page.mouse.move(...at(0.78, 0.5), { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    continue
  }
  aimed++

  // Put it in the middle, look again to see how well that went, then lift for
  // the drop and the rise and let go.
  await aimAt(seen, 0)
  await page.waitForTimeout(90)
  const again2 = await spot()
  await aimAt(again2 ?? { x: 0, y: 0 }, LIFT)
  await page.waitForTimeout(90)

  await page.mouse.move(...at(0.5, 0.62))
  await page.mouse.down()
  await page.waitForTimeout(620)
  await page.mouse.up()
  shots++
  await page.waitForTimeout(500)
  if (i === 4) await page.screenshot({ path: '/tmp/archer-play.png' })

  const now = Number(((await bar()).match(/\b(\d{6})\b/) ?? [])[1] ?? 0)
  best = Math.max(best, now)
}
console.log(`${shots} arrows at something it could see (${aimed} aimed), best score ${best}`)
if (best === 0) console.log('ARCHER FAILED: aimed at balloons forty times and never hit one')
await eyes.close()

await page.screenshot({ path: '/tmp/archer-after.png' })

if (problems.length === 0) console.log('ARCHER: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

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

/*
 * And then follow the arrow out, which is a question of its own: can it be
 * seen at the range it is being shot at? A burst of pictures as fast as they
 * can be taken, because "it looks fine" usually means the one frame where it
 * is a metre away and the size of a plank.
 */
const flightFrom = Date.now()
for (let i = 0; i < 6; i++) {
  await page.screenshot({ path: `/tmp/archer-flight-${i}.png` })
  console.log(`  flight ${i}: ${Date.now() - flightFrom}ms out, about ` +
    `${Math.round(((Date.now() - flightFrom) / 1000) * 42)}m`)
}
/*
 * And one more shot watched from the side, by turning away as it goes. Dead
 * astern an arrow is a dot coming at the horizon however thick it is; it is
 * from the side that the streak behind it has to look like a streak and point
 * the right way.
 */
await page.mouse.move(...at(0.5, 0.6))
await page.mouse.down()
await page.waitForTimeout(620)
await page.mouse.up()
await page.mouse.move(...at(0.5, 0.5))
await page.mouse.down()
await page.mouse.move(...at(0.64, 0.5), { steps: 4 })
await page.mouse.up()
for (let i = 0; i < 3; i++) await page.screenshot({ path: `/tmp/archer-sideon-${i}.png` })
await page.waitForTimeout(600)

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
     * Balloons are found by their colour, which is the only thing about them a
     * script can be sure of.
     *
     * Two cleverer tests came first and both failed in the same way, by
     * finding something that was not a balloon and converging beautifully onto
     * it. "The most saturated thing in the sky" aims at the sky, which is a
     * deep blue at the top of the frame. "The thing that does not match what
     * is beside it" aims at the sight, the bowstring, and the edge of a cloud.
     *
     * So: three of the five colours a wanted balloon can be, matched on the
     * ratio between the channels rather than the values, because a balloon in
     * shade is the same colour and darker. Three and not five, because in that
     * ratio the pale blue one is the sky and the mint one is a sunlit hill —
     * which is how this found a hillside fourteen pixels across and shot at
     * it. Pink, yellow and lilac are nothing else in the meadow.
     */
    const WANTED = [[1.00, 0.37, 0.48], [1.00, 0.82, 0.40], [0.76, 0.56, 1.00]]
    const found = []
    // Down to below the horizon, because a balloon that has only just come up
    // is against the grass rather than against the sky — and the colours it
    // is looking for are nothing like grass, so there is no need to stop at
    // the skyline.
    for (let y = 44; y < height * 0.72; y += 2) {
      /*
       * And only the half of the sky the bow is not in. A sunlit bow limb is
       * tan, and tan in these ratios is the yellow balloon — so this spent a
       * dozen arrows shooting at its own bow.
       */
      for (let x = 4; x < width * 0.52; x += 2) {
        const i = (y * width + x) * 4
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const top = Math.max(r, g, b)
        if (top < 110) continue
        const nr = r / top
        const ng = g / top
        const nb = b / top
        let near = false
        for (const [wr, wg, wb] of WANTED) {
          if (Math.abs(nr - wr) + Math.abs(ng - wg) + Math.abs(nb - wb) < 0.26) near = true
        }
        if (!near) continue
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
    // A couple of stray pixels is a tree edge catching the light, not a
    // balloon forty feet up.
    if (near.length < 8) return null
    const at = near.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 })
    const mx = Math.round(at.x / near.length)
    const my = Math.round(at.y / near.length)
    const j = (my * width + mx) * 4
    return {
      x: mx - cx, y: my - cy, pixels: near.length,
      ink: `${pixels[j]},${pixels[j + 1]},${pixels[j + 2]}`, at: `${mx},${my}`,
    }
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
let restarts = 0
for (let i = 0; i < 120; i++) {
  const again = page.getByRole('button', { name: /Start again/i })
  if (await again.count()) {
    restarts++
    await again.first().click()
    await page.waitForTimeout(700)
  }

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
  if (i < 6) console.log(`saw ${seen.pixels}px of ${seen.ink} at ${seen.at} (${seen.x.toFixed(0)},${seen.y.toFixed(0)} off)`)

  /*
   * Put it in the middle, then lift for the drop and the climb and let go.
   *
   * The lift is a second drag rather than part of the first because the
   * correction is measured from the picture and the lift is not. And nothing
   * is re-measured in between on purpose: the sight sits in the middle of the
   * screen and has to be skipped when reading the picture, so a balloon that
   * has just been aimed at is in the one place this cannot see. Looking again
   * found something else and turned away from the balloon it had just lined
   * up, every time.
   *
   * A single correction leaves about an eighth of the error behind — the
   * first few pixels of every drag are spent deciding it is a drag — so the
   * lift carries that much of it again.
   */
  await aimAt(seen, 0)
  await page.waitForTimeout(90)
  await aimAt({ x: seen.x * 0.13, y: seen.y * 0.13 }, LIFT)
  await page.waitForTimeout(90)

  await page.mouse.move(...at(0.5, 0.62))
  await page.mouse.down()
  await page.waitForTimeout(620)
  await page.mouse.up()
  shots++
  await page.waitForTimeout(500)
  if (i === 4) await page.screenshot({ path: '/tmp/archer-play.png' })

  const line = await bar()
  const now = Number((line.match(/\b(\d{6})\b/) ?? [])[1] ?? 0)
  best = Math.max(best, now)
  if (aimed <= 8) console.log(`  after: ${line.replace(/\s+/g, ' ').slice(0, 86)}`)
  /*
   * One hit is the whole question. This is not trying to be good at the game —
   * it loses its lives to balloons it never saw, because it only looks at half
   * the sky and only knows three of the five colours — it is only here to show
   * that an arrow aimed down the middle of the screen arrives.
   */
  if (best > 0) break
}
console.log(`${shots} arrows at something it could see (${aimed} aimed, ${restarts} restarts), best score ${best}`)
if (best === 0) console.log('ARCHER FAILED: looked for balloons a hundred and twenty times and never hit one')
await eyes.close()

await page.screenshot({ path: '/tmp/archer-after.png' })

if (problems.length === 0) console.log('ARCHER: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

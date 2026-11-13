/**
 * Playing the yard in a real browser.
 *
 * The geometry is proved in `run.test.ts` by a bot that works the rectangles
 * out itself. What no unit test can reach is the sheet: whether dragging a
 * finger across it chalks the rectangle you meant, whether the board reads
 * back what you drew, and whether the press takes it.
 *
 * So this reads the order off the machine's own spoken line, works out a
 * rectangle that fills it, drags that out on the glass, and presses the press.
 */
import { chromium } from 'playwright'
import { chromiumAt } from './browser.mjs'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  ...chromiumAt(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
/*
 * A layout only breaks at a size, so this takes one. The readout along the
 * bottom grows a cell for a tank and two for the skin of one, and five cells
 * on a narrow phone is the shape that would go wrong first.
 */
const WIDE_AS = Number(process.env.YARD_WIDTH ?? 430)
const page = await browser.newPage({
  viewport: { width: WIDE_AS, height: Number(process.env.YARD_HEIGHT ?? 860) },
  ignoreHTTPSErrors: true,
})
const problems = []
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1500)

const skip = async () => {
  for (let i = 0; i < 4; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(450) }
  }
}
await skip()

const tile = page.getByRole('button', { name: /The Yard/i })
console.log('tile on the front screen:', await tile.count())
await page.screenshot({ path: '/tmp/yard-home.png' })
if (await tile.count() === 0) {
  console.log('YARD FAILED: no tile')
  await browser.close()
  process.exit(1)
}
await tile.first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/yard-story.png' })
await skip()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/yard-stand.png' })

const hud = async () =>
  (await page.locator('p.font-mono, span.font-mono').allTextContents()).join(' | ')
const said = async () => page.locator('p.sr-only').first().innerText()
const score = async () => Number(((await hud()).match(/\b(\d{6})\b/) ?? [])[1] ?? 0)
console.log('bar:', (await hud()).replace(/\s+/g, ' ').slice(0, 100))

// How big the sheet is, in squares. The one thing about the yard's layout
// this still has to know, and the one thing about it that is a rule rather
// than a drawing decision.
const WIDE = 14
const TALL = 10

/**
 * Where the squares are on the glass, worked out by trying it.
 *
 * This used to be a copy of the game's own layout arithmetic, which worked
 * until the sheet moved — and then every drag landed in the wrong square and
 * the probe lost three lives without noticing anything was wrong. So it
 * calibrates instead: drag a known number of pixels, read off the board how
 * many squares that turned out to be, and divide. Which is both more robust
 * and closer to what a player does, since the board is telling it the same
 * thing it tells them.
 */
const box = await page.locator('canvas').first().boundingBox()
const chalked = async () => {
  const text = await said()
  const m = text.match(/Chalked: (\d+) by (\d+)/)
  return m ? { wide: Number(m[1]), tall: Number(m[2]) } : { wide: 0, tall: 0 }
}

// Near the top-left corner of the sheet, so there is a whole sheet to drag
// into and nothing gets clipped against an edge.
const anchor = { x: box.x + box.width * 0.06, y: box.y + box.height * 0.17 }
const dragTo = async (dx, dy) => {
  await page.mouse.move(anchor.x, anchor.y)
  await page.mouse.down()
  await page.mouse.move(anchor.x + dx * 0.5, anchor.y + dy * 0.5, { steps: 3 })
  await page.mouse.move(anchor.x + dx, anchor.y + dy, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(180)
  return chalked()
}

/*
 * Calibrated sideways only. The squares are square, so one measurement does
 * for both axes — and a drag long enough to measure downwards runs off the
 * bottom of a ten-deep sheet and comes back clipped, which is what the first
 * go at this measured: twenty-nine pixels across and forty-four down.
 */
const across = box.width * 0.55
const far = await dragTo(across, 0)
let cell = across / Math.max(1, far.wide - 1)
console.log(`a ${Math.round(across)}px drag chalked ${far.wide} squares, ` +
  `so a square is about ${cell.toFixed(0)}px`)
if (far.wide < 3) problems.push('dragging across the sheet chalked almost nothing')

/** Drag out a rectangle of this many squares, checking the board agrees. */
const chalkOut = async (wide, tall) => {
  /*
   * The drag length is nudged, not the square size.
   *
   * A square is square, so one number describes both axes — but where the
   * finger goes down inside its own square is not the same on both, and over
   * seven rows a fraction of a pixel a row adds up to a whole one. The first
   * version corrected the square size from the width, which was already
   * right, and so never fixed the height: "wanted 2 by 8, got 2 by 9", five
   * times in a row. Nudging each axis by what it is actually out by converges
   * in a go or two.
   */
  let dx = (wide - 1) * cell
  let dy = (tall - 1) * cell
  for (let go = 0; go < 6; go++) {
    const got = await dragTo(dx, dy)
    if (process.env.YARD_DEBUG) console.log(`    wanted ${wide}x${tall}, got ${got.wide}x${got.tall}`)
    if (got.wide === wide && got.tall === tall) return true
    dx += (wide - got.wide) * cell * 0.6
    dy += (tall - got.tall) * cell * 0.6
    dx = Math.max(0, dx)
    dy = Math.max(0, dy)
  }
  return false
}

/** A rectangle that fills this order, worked out rather than looked up. */
function findShape(order) {
  // Two each way at least: the press will not take a strip, which is the rule
  // that makes the orders about factor pairs.
  for (let wide = 2; wide <= WIDE; wide++) {
    for (let tall = 2; tall <= TALL; tall++) {
      if (order.job === 'panel' && wide * tall === order.area) return { wide, tall, deep: null }
      if (order.job === 'edging' && 2 * (wide + tall) === order.edge) return { wide, tall, deep: null }
      if (order.job === 'exact' && wide * tall === order.area && 2 * (wide + tall) === order.edge) {
        return { wide, tall, deep: null }
      }
      /*
       * The slant: the press cuts corner to corner, so the rectangle wanted
       * is twice the order. Doubling and then factoring, which is the job.
       */
      if (order.job === 'half' && wide * tall === order.area * 2) {
        return { wide, tall, deep: null }
      }
      if (order.job === 'tank') {
        for (let deep = 2; deep <= 8; deep++) {
          if (order.deep !== null && deep !== order.deep) continue
          if (wide * tall * deep === order.cubes) return { wide, tall, deep }
        }
      }
      // And the skin: two faces the size of the floor and a band right round.
      if (order.job === 'skin') {
        for (let deep = 1; deep <= 8; deep++) {
          if (order.deep !== null && deep !== order.deep) continue
          if (2 * wide * tall + 2 * deep * (wide + tall) === order.skin) {
            return { wide, tall, deep }
          }
        }
      }
    }
  }
  return null
}

/** What the board is asking for, off its own spoken line. */
function readOrder(text) {
  const line = (text.match(/Order: ([^.]+)\./) ?? [])[1] ?? ''
  // Skin before cubes, and the slant before a plain panel: both of the later
  // patterns would match the earlier orders' wording as well.
  const skin = line.match(/(\d+) OF SKIN(?:, (\d+) DEEP)?/)
  if (skin) {
    return { job: 'skin', skin: Number(skin[1]), deep: skin[2] ? Number(skin[2]) : null }
  }
  const cubes = line.match(/(\d+) CUBES(?:, (\d+) DEEP)?/)
  if (cubes) {
    return { job: 'tank', cubes: Number(cubes[1]), deep: cubes[2] ? Number(cubes[2]) : null }
  }
  const slant = line.match(/(\d+) SQUARES ON THE SLANT/)
  if (slant) return { job: 'half', area: Number(slant[1]) }
  const both = line.match(/(\d+) SQUARES, (\d+) OF EDGE/)
  if (both) return { job: 'exact', area: Number(both[1]), edge: Number(both[2]) }
  const edge = line.match(/(\d+) OF EDGING/)
  if (edge) return { job: 'edging', edge: Number(edge[1]) }
  const area = line.match(/(\d+) SQUARES/)
  if (area) return { job: 'panel', area: Number(area[1]) }
  return null
}

let filled = 0
let best = 0
const kinds = new Set()
for (let round = 0; round < 60; round++) {
  const body = await page.locator('body').innerText()
  if (/Level \d+ delivered/i.test(body)) {
    const level = Number((body.match(/Level (\d+) delivered/) ?? [])[1] ?? 0)
    await page.getByRole('button', { name: /On to level/i }).first().click()
    await page.waitForTimeout(800)
    // Through to the sixth, because the two orders worth proving arrive late:
    // the slant on the third and the skin of a tank on the fifth.
    if (level >= 6) break
    continue
  }
  if (/lorry went without you/i.test(body)) { console.log('ran out of lives'); break }

  const order = readOrder(await said())
  if (!order) { problems.push('could not read the order off the board'); break }
  const want = findShape(order)
  if (!want) { problems.push(`nothing fills ${JSON.stringify(order)}`); break }
  if (!kinds.has(order.job)) {
    kinds.add(order.job)
    await page.screenshot({ path: `/tmp/yard-${WIDE_AS}-${order.job}.png` })
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth)
    if (over > 1) problems.push(`${order.job}: ${over}px off the side at ${WIDE_AS}px wide`)
    console.log(`  ${order.job}: ${JSON.stringify(order)} -> ${want.wide}x${want.tall}` +
      (want.deep ? ` x${want.deep}` : ''))
  }

  if (!(await chalkOut(want.wide, want.tall))) {
    problems.push(`could not chalk out ${want.wide} by ${want.tall}`)
    break
  }

  if (want.deep !== null && want.deep !== undefined) {
    const now = Number(((await said()).match(/(\d+) deep/) ?? [])[1] ?? 2)
    const button = page.getByRole('button', { name: want.deep > now ? 'Deeper' : 'Shallower' })
    for (let i = 0; i < Math.abs(want.deep - now); i++) {
      await button.first().click()
      await page.waitForTimeout(110)
    }
  }

  await page.getByRole('button', { name: /Cut it|Build it/i }).first().click()
  await page.waitForTimeout(420)
  best = Math.max(best, await score())
  filled++
}

await page.screenshot({ path: '/tmp/yard-after.png' })
console.log(`${filled} orders had a go, best ${best}, bar ${(await hud()).replace(/\s+/g, ' ').slice(0, 70)}`)
console.log(`orders met: ${[...kinds].sort().join(', ')}`)
for (const job of ['panel', 'edging', 'exact', 'half', 'tank', 'skin']) {
  if (!kinds.has(job)) console.log(`  (never saw a ${job} order)`)
}
if (best === 0) console.log('YARD FAILED: nothing scored — the press may not be reaching the sheet')

if (problems.length === 0) console.log('YARD: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

/**
 * Playing the scales in a real browser.
 *
 * The arithmetic is proved in `run.test.ts` by a bot that converts the numbers
 * itself and clears level after level. What no unit test can reach is the
 * machine: whether tapping 32 puts 32 on the pan, whether the beam says which
 * way you are wrong, and whether the number pad that replaces the rack for a
 * naming job gets its digits through.
 *
 * So this walks in and plays one properly — reading the crate off the screen,
 * working out the weights, and pressing them.
 */
import { chromium } from 'playwright'
import { chromiumAt } from './browser.mjs'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  ...chromiumAt(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
/*
 * A layout only breaks at a size. The rack goes from five buttons to twelve
 * as the levels climb and borrowing puts a two-button strip above it, so the
 * shape most likely to go wrong is the full rack on the smallest phone.
 */
const WIDE_AS = Number(process.env.SCALES_WIDTH ?? 430)
const page = await browser.newPage({
  viewport: { width: WIDE_AS, height: Number(process.env.SCALES_HEIGHT ?? 860) },
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
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(500) }
  }
}
await skip()

const tile = page.getByRole('button', { name: /The Scales/i })
console.log('tile on the front screen:', await tile.count())
await page.screenshot({ path: '/tmp/scales-home.png' })
if (await tile.count() === 0) {
  console.log('SCALES FAILED: no tile')
  await browser.close()
  process.exit(1)
}
await tile.first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/scales-story.png' })
await skip()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/scales-stand.png' })

const hud = async () =>
  (await page.locator('p.font-mono, span.font-mono').allTextContents()).join(' | ')
console.log('bar:', (await hud()).replace(/\s+/g, ' ').slice(0, 110))

const score = async () => Number(((await hud()).match(/\b(\d{6})\b/) ?? [])[1] ?? 0)
const left = async () => Number(((await hud()).match(/(\d+) to go/) ?? [])[1] ?? -1)

/*
 * The rack, by the labels on it: the buttons say what they weigh, so the
 * script can press the ones it works out it needs — exactly what a player
 * does, and a test of the labels as well as the maths.
 */
const press = async (weight) => {
  const button = page.getByRole('button', { name: new RegExp(`^${weight}(,|$)`) })
  if (await button.count() === 0) return false
  await button.first().click()
  await page.waitForTimeout(140)
  return true
}

/**
 * What the machine says it wants, which it also says in words for us.
 *
 * Keyed off what it is *asking*, not off what is chalked on the crate. Eight
 * jobs come along the belt and three of them are chalked with a bare number —
 * a weigh, an exponent and the start of a sum — so the number alone cannot
 * tell them apart. The line the machine says out loud has both halves of it.
 */
const crate = async () => {
  const said = await page.locator('p.sr-only').first().innerText()
  const chalk = (said.match(/Crate ([^.]+)\./) ?? [])[1] ?? ''
  const num = (text) => Number((String(text).match(/-?\d+/) ?? [])[0] ?? 0)

  if (/WHAT DOES IT WEIGH/i.test(said)) return { job: 'name' }
  if (/WHICH POWER OF TWO/i.test(said)) {
    return { job: 'exponent', answer: Math.round(Math.log2(num(chalk))) }
  }
  if (/ONE WEIGHT ONLY/i.test(said)) {
    const power = chalk.match(/2\^(\d+)/)
    return { job: 'power', load: Math.pow(2, Number(power?.[1] ?? 0)) }
  }
  if (/DOUBLE IT/i.test(said)) return { job: 'double', load: num(chalk) * 2 }
  if (/HALVE IT/i.test(said)) return { job: 'halve', load: num(chalk) / 2 }
  if (/TAP A PAIR/i.test(said)) return { job: 'carry' }
  if (/TAKE IT OFF/i.test(said)) {
    const pair = chalk.match(/(\d+)\s*-\s*(\d+)/)
    const from = Number(pair?.[1] ?? 0)
    const off = Number(pair?.[2] ?? 0)
    return { job: 'borrow', load: from - off, from, off }
  }
  return { job: 'weigh', load: num(chalk) }
}

/**
 * Which weights are on the pan.
 *
 * Off the machine's own spoken line rather than off the rack, because on a
 * naming job the rack is not there — the number pad has taken its place, and
 * the weights exist only as brass drawn on a canvas. Which is exactly the
 * thing that line is for.
 */
const onPan = async () => {
  const said = await page.locator('p.sr-only').first().innerText()
  const list = (said.match(/On the pan: ([^.]+)\./) ?? [])[1] ?? ''
  if (/nothing/.test(list)) return []
  const out = []
  for (const part of list.split(',')) {
    const pair = part.trim().match(/^(\d+)(?: times (\d+))?$/)
    if (!pair) continue
    for (let i = 0; i < Number(pair[2] ?? 1); i++) out.push(Number(pair[1]))
  }
  return out
}

/** The whole rack, biggest first, for the greedy conversion below. */
const RACK = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1]

/** A number as the weights that make it, worked out rather than looked up. */
const weightsFor = (n) => {
  let rest = n
  const want = []
  for (const weight of RACK) if (rest >= weight) { want.push(weight); rest -= weight }
  return want
}

/** Types a number on the pad that replaces the rack, and says that is it. */
const type = async (n) => {
  for (const digit of String(n)) {
    await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first().click()
    await page.waitForTimeout(70)
  }
  await page.getByRole('button', { name: /Check/i }).first().click()
}

/** Puts the borrow job's rack into one of its two modes. */
const mode = async (which) => {
  const button = page.getByRole('button', { name: new RegExp(`^${which}$`, 'i') })
  if (await button.count() === 0) return false
  if (await button.first().getAttribute('aria-pressed') === 'true') return true
  await button.first().click()
  await page.waitForTimeout(90)
  return true
}

let crates = 0
let best = 0
let levels = 0
const met = new Set()
for (let round = 0; round < 90; round++) {
  /*
   * Through the levels rather than stopping at the first one cleared, because
   * the jobs worth proving arrive late: the exponent pad on level two, the
   * two shifts on three, carrying on four and borrowing on five. A probe that
   * clears level one and goes home has tested a fifth of the machine.
   */
  const onwards = page.getByRole('button', { name: /On to level/i })
  if (await onwards.count() > 0) {
    levels++
    await onwards.first().click()
    await page.waitForTimeout(700)
  }
  const job = await crate()
  met.add(job.job)

  if (job.job === 'name') {
    // The machine has put the weights on and wants the number back.
    const lit = await onPan()
    const total = lit.reduce((sum, n) => sum + n, 0)
    await type(total)
    console.log(`  named ${lit.sort((a, b) => b - a).join(' + ')} = ${total}`)
  } else if (job.job === 'exponent') {
    // Off the end of the rack, so there is nothing to lift: just know it.
    await type(job.answer)
    console.log(`  2^${job.answer}`)
  } else if (job.job === 'carry') {
    // Tap every pile until none of them is a pile.
    for (let i = 0; i < 16; i++) {
      const piles = await page.locator('button[aria-label*="of them"]').count()
      if (piles === 0) break
      await page.locator('button[aria-label*="of them"]').first().click()
      await page.waitForTimeout(130)
    }
    console.log('  tidied a pile')
  } else if (job.job === 'borrow') {
    /*
     * Binary subtraction, done the way it is done on paper. While the pan is
     * over the load, take off the biggest weight it can spare; when it can
     * spare none, break the smallest one open and look again; and when the
     * pan is level, tap the piles together until the machine will take it.
     *
     * The interesting part for a browser is the two modes: the same twelve
     * buttons send a different move depending on which of them is lit, so
     * this presses the mode as well as the weight, which is the bit no unit
     * test can reach.
     */
    let broke = 0
    let took = 0
    for (let i = 0; i < 60; i++) {
      const lit = await onPan()
      if (lit.length === 0) break
      const total = lit.reduce((sum, n) => sum + n, 0)
      const spare = total - job.load
      if (spare > 0) {
        const afford = lit.filter((w) => w <= spare).sort((a, b) => b - a)[0]
        if (afford !== undefined) {
          await mode('take off')
          await press(afford)
          took++
        } else {
          await mode('break in two')
          await press(Math.min(...lit))
          broke++
        }
      } else {
        const piles = page.locator('button[aria-label*="of them"]')
        if (await piles.count() === 0) break
        await mode('take off')
        await piles.first().click()
        await page.waitForTimeout(130)
      }
    }
    console.log(`  ${job.from} - ${job.off} = ${job.load}, broke ${broke}, took ${took} off`)
  } else {
    /*
     * Weighing, doubling, halving and the powers are all the same move in the
     * end: work out the weights the number needs and make the pan hold
     * exactly those. For a weigh the pan starts empty; for a double or a
     * halve it starts with the number before the shift on it, so what gets
     * pressed is the difference, which is the shift itself.
     */
    const want = weightsFor(job.load)
    const lit = await onPan()
    for (const weight of lit) if (!want.includes(weight)) await press(weight)
    for (const weight of want) if (!lit.includes(weight)) await press(weight)
    console.log(`  ${job.job} ${job.load} = ${want.join(' + ')}`)
  }

  await page.waitForTimeout(450)
  best = Math.max(best, await score())
  if (round === 1) await page.screenshot({ path: '/tmp/scales-play.png' })
  crates++
  if ((await page.locator('text=/The belt beat you/').count()) > 0) break
}

await page.screenshot({ path: '/tmp/scales-after.png' })
console.log(`${crates} crates had a go, best ${best}, bar ${(await hud()).replace(/\s+/g, ' ').slice(0, 70)}`)
/*
 * The rack is what a thumb lands on, so it is measured rather than eyeballed.
 * Twelve buttons six to a row is the shape that comes closest to the floor.
 */
const racked = await page.locator('button[aria-label]').evaluateAll((all) =>
  all.map((b) => Math.round(b.getBoundingClientRect().width)).filter((w) => w > 0))
if (racked.length > 0) {
  const narrowest = Math.min(...racked)
  console.log(`${racked.length} on the rack, narrowest ${narrowest}px, at ${WIDE_AS}px wide`)
  if (narrowest < 44) {
    problems.push(`a rack button is only ${narrowest}px across at ${WIDE_AS}px wide`)
  }
}
const over = await page.evaluate(() =>
  document.documentElement.scrollWidth - window.innerWidth)
if (over > 1) problems.push(`${over}px of the machine is off the side at ${WIDE_AS}px wide`)

console.log(`levels cleared: ${levels}`)
console.log(`jobs met: ${[...met].sort().join(', ')}`)
for (const job of ['weigh', 'name', 'power', 'exponent', 'double', 'halve', 'carry', 'borrow']) {
  if (!met.has(job)) console.log(`  (never saw a ${job} crate)`)
}
if (best === 0) console.log('SCALES FAILED: nothing scored — the rack may not be reaching the pan')

if (problems.length === 0) console.log('SCALES: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

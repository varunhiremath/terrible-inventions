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

/** What the machine says it wants, which it also says in words for us. */
const crate = async () => {
  const said = await page.locator('p.sr-only').first().innerText()
  const power = said.match(/Crate 2\^(\d+)/)
  if (power) return { job: 'power', load: Math.pow(2, Number(power[1])) }
  if (/Crate \?/.test(said)) return { job: 'name', load: 0 }
  const n = Number((said.match(/Crate (\d+)/) ?? [])[1] ?? 0)
  return { job: /TAP A PAIR/i.test(said) ? 'carry' : 'weigh', load: n }
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

let crates = 0
let best = 0
for (let round = 0; round < 14; round++) {
  const job = await crate()

  if (job.job === 'name') {
    // The machine has put the weights on and wants the number back.
    const lit = await onPan()
    const total = lit.reduce((sum, n) => sum + n, 0)
    for (const digit of String(total)) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first().click()
      await page.waitForTimeout(80)
    }
    await page.getByRole('button', { name: /Check/i }).first().click()
    console.log(`  named ${lit.sort((a, b) => b - a).join(' + ')} = ${total}`)
  } else if (job.job === 'carry') {
    // Tap every pile until none of them is a pile.
    for (let i = 0; i < 12; i++) {
      const piles = await page.locator('button[aria-label*="of them"]').count()
      if (piles === 0) break
      await page.locator('button[aria-label*="of them"]').first().click()
      await page.waitForTimeout(140)
    }
    console.log('  tidied a pile')
  } else {
    /*
     * Weighing, the way the game means it to be done: take the number,
     * subtract the biggest weight that fits, press it, repeat. Which is the
     * algorithm the game exists to teach, run by a script to prove the rack
     * is wired to the pan.
     */
    let rest = job.load
    const want = []
    for (const weight of [128, 64, 32, 16, 8, 4, 2, 1]) {
      if (rest >= weight) { want.push(weight); rest -= weight }
    }
    for (const weight of want) await press(weight)
    console.log(`  ${job.job} ${job.load} = ${want.join(' + ')}`)
  }

  await page.waitForTimeout(450)
  best = Math.max(best, await score())
  if (round === 1) await page.screenshot({ path: '/tmp/scales-play.png' })
  crates++
  if ((await page.locator('text=/Level \\d+ weighed/').count()) > 0) break
}

await page.screenshot({ path: '/tmp/scales-after.png' })
console.log(`${crates} crates had a go, best ${best}, bar ${(await hud()).replace(/\s+/g, ' ').slice(0, 70)}`)
if (best === 0) console.log('SCALES FAILED: nothing scored — the rack may not be reaching the pan')

if (problems.length === 0) console.log('SCALES: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)

await browser.close()

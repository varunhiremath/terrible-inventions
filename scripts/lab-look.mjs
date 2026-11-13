/**
 * Reading problems in a real browser.
 *
 * The arithmetic is checked in `generators.test.ts` against sums worked out
 * independently, which is the half that matters and the half a unit test can
 * reach. This is the other half: whether a problem that has been *written*
 * can be *read*.
 *
 * Three things it looks for, all of which have happened to this project:
 *
 *  - an unfilled {papa} or {kid} on the screen, which is what a generator
 *    looks like when somebody forgets to render it through `fill()`;
 *  - a prompt that runs off the side of a phone, which no test that never
 *    opens a browser can see;
 *  - and a picture drawn next to a problem that has nothing to do with it,
 *    which is what a default branch in a figure chooser quietly does when a
 *    new generator is added.
 */
import { chromium } from 'playwright'
import { chromiumAt } from './browser.mjs'
import { mkdirSync } from 'node:fs'

mkdirSync('/tmp/lab', { recursive: true })
const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  ...chromiumAt(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({
  viewport: { width: 430, height: 860 }, ignoreHTTPSErrors: true,
})
const problems = []
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1500)
for (let i = 0; i < 4; i++) {
  const s = page.getByRole('button', { name: 'Skip' })
  if (await s.count()) { await s.first().click(); await page.waitForTimeout(400) }
}

const way = page.getByRole('button', { name: /the lab|workshop/i })
if (await way.count() === 0) {
  console.log('LAB FAILED: no way in from the front screen')
  await browser.close()
  process.exit(1)
}
await way.first().click()
await page.waitForTimeout(1000)

/** The question itself, which is the biggest run of text above the keypad. */
const asked = async () => {
  const bits = await page.locator('p, h2, h3').allTextContents()
  return bits.map((t) => t.replace(/\s+/g, ' ').trim())
    /*
     * The longest line that is not the shelf's standing blurb.
     *
     * Three narrower rules were tried first and all three were wrong, which
     * between them say what a problem actually looks like: not a line ending
     * in a question mark, because a rectangle problem finishes with a
     * parenthesis about 2 by 3 and 3 by 2 being the same rectangle; not a
     * line with a number in it, because a fraction duel's numbers are on its
     * two buttons and its prompt is "which one is actually bigger?"; and not
     * a line with a question mark anywhere, because faulty wiring does not
     * ask a question at all — it says "tap every machine that is telling the
     * truth". Each of those cost a run reporting the lab was empty.
     */
    .filter((t) => t.length > 25 && !/earns coins|on the shelf/i.test(t))
    .sort((a, b) => b.length - a.length)[0] ?? ''
}

let seen = 0
let lost = 0
let stranded = ''
const kinds = new Set()
for (let round = 0; round < 30; round++) {
  const q = await asked()
  if (!q && process.env.LAB_DEBUG) {
    console.log('  [nothing matched] ' +
      (await page.locator('p, h2, h3').allTextContents())
        .map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ').slice(0, 400))
  }
  if (!q) {
    /*
     * Some problems are answered with a picker rather than a keypad, and a
     * picker press can land on the panel's own buttons. Rather than teach
     * this script every generator's controls, it finds its way back: press
     * whatever carries on, and only give up if it cannot.
     */
    const on = page.getByRole('button', { name: /next|another|carry on|go again|a problem/i })
    if (await on.count() > 0) { await on.first().click(); await page.waitForTimeout(700) }
    else if (++lost >= 3) {
      await page.screenshot({ path: '/tmp/lab/lost.png' })
      stranded = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 140)
      break
    }
    continue
  }
  lost = 0

  // A placeholder that never got filled. The repository is public and the
  // names live on the device, so this is the failure that matters most here.
  if (/\{papa\}|\{kid\}/.test(q)) problems.push(`unfilled placeholder: ${q.slice(0, 70)}`)

  // Nothing may run off the side of a phone.
  const wide = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth))
  if (wide > 1) problems.push(`${wide}px of the question is off the side of the screen`)

  const tag = q.slice(0, 24).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  if (!kinds.has(tag)) {
    kinds.add(tag)
    await page.screenshot({ path: `/tmp/lab/${kinds.size}-${tag}.png` })
    console.log(`  ${q.slice(0, 110)}`)
  }
  seen++

  // Hints are free and must open without being paid for.
  const hint = page.getByRole('button', { name: /hint|stuck|help/i })
  if (round === 0 && await hint.count() > 0) {
    await hint.first().click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/lab/hint.png' })
  }

  // Answer it — wrongly is fine, this is about the screen rather than the
  // sums — and move on to the next one.
  const keys = page.getByRole('button', { name: /^[0-9]$/ })
  if (await keys.count() > 0) {
    await keys.first().click()
    await page.waitForTimeout(120)
    const check = page.getByRole('button', { name: /check/i })
    if (await check.count() > 0) { await check.first().click(); await page.waitForTimeout(500) }
  } else {
    /*
     * A picker rather than a keypad. Never the back arrow, which is the one
     * button on the screen that leaves the lab entirely — the first go at
     * this pressed it and then reported that the lab had no questions in it.
     */
    const options = page.getByRole('button')
      .filter({ hasNotText: /back|hint|stuck|help|next|shelf|coin/i })
    if (await options.count() > 0) { await options.first().click(); await page.waitForTimeout(400) }
  }
  const next = page.getByRole('button', { name: /next|another|carry on|go again/i })
  if (await next.count() > 0) { await next.first().click(); await page.waitForTimeout(600) }
}

console.log(`${seen} problems read, ${kinds.size} different ones`)
/*
 * Six is the bar. The point of this script is reading problems rather than
 * answering them, and the run ends when it lands on a screen it does not
 * know how to leave — which is not itself a fault, so it is reported and not
 * counted against the lab.
 */
if (seen < 6) console.log('LAB FAILED: barely any problems came up')
if (stranded) console.log(`stopped on: ${stranded}`)
if (problems.length === 0) console.log('LAB: nothing thrown')
else for (const p of problems.slice(0, 8)) console.log(p)
await browser.close()

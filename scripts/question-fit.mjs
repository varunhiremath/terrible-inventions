/**
 * Does the answered question fit on the screen — including the tall one?
 *
 * The complaint was having to scroll up and down to find the way back after
 * answering. `question-flow.mjs` checks that in the real game, but the game
 * deals a *picture* question about one time in thirty, so eight runs of it
 * proved only that text questions fit. This deals cards until the picture one
 * comes up, in every shape the app is held in, and measures the same two
 * things: nothing hidden, and the button on the screen.
 *
 *     npx vite --port 5199
 *     node scripts/question-fit.mjs
 */
import { chromium } from 'playwright'

const SHAPES = [
  ['upright', { width: 400, height: 820 }],
  ['small upright', { width: 360, height: 640 }],
  ['sideways', { width: 900, height: 420 }],
]
/** How many cards to deal looking for a picture one. */
const TRIES = 120

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
})
const problems = []

for (const [shape, size] of SHAPES) {
  const page = await browser.newPage({ viewport: size })
  page.on('pageerror', (e) => problems.push(`${shape}: page error: ${e.message}`))
  await page.goto('http://127.0.0.1:5199/questions.html', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__ready === true)

  let worst = { hidden: -1 }
  let pictures = 0
  for (let n = 0; n < TRIES; n++) {
    await page.evaluate(() => window.__deal())
    await page.waitForTimeout(40)
    // Take the question, then answer the first thing on it.
    const take = page.getByRole('button', { name: /^Answer it for/ })
    if (!(await take.count())) { problems.push(`${shape}: no offer on the card`); break }
    await take.first().click()
    await page.waitForTimeout(40)

    /*
     * A flag is a canvas, drawn by hand like everything else in this project.
     * Looking for an `svg` or an `img` found none in three hundred and sixty
     * cards and reported that as "never got a picture one", which is the
     * instrument lying rather than the card being wrong — the fourth time
     * that has happened in here.
     */
    const picture = await page.evaluate(
      () => document.querySelectorAll('.rise-in.block-panel canvas').length > 0,
    )
    if (!picture) continue
    pictures += 1

    const answers = page.locator('.rise-in.block-panel button')
    await answers.first().click()
    await page.waitForTimeout(80)

    const fit = await page.evaluate(() => {
      const panel = document.querySelector('.rise-in.block-panel')
      const scroller = panel.querySelector('.overflow-y-auto')
      const press = [...panel.querySelectorAll('button')].find((b) => /back to it/i.test(b.textContent))
      const box = press.getBoundingClientRect()
      return {
        hidden: scroller.scrollHeight - scroller.clientHeight,
        bottom: box.bottom,
        top: box.top,
        window: window.innerHeight,
      }
    })
    if (fit.hidden > worst.hidden) worst = fit
    // One picture of the thing being measured, so it can be looked at as well
    // as counted.
    if (pictures === 1) await page.screenshot({ path: `/tmp/question-${shape.replace(/ /g, '-')}.png` })
    if (pictures >= 6) break
  }

  if (pictures === 0) {
    problems.push(`${shape}: dealt ${TRIES} cards and never got a picture one`)
  } else {
    console.log(
      `${shape} (${size.width}x${size.height}): ${pictures} picture questions, ` +
      `worst hidden ${worst.hidden.toFixed(0)}px, button at ${worst.bottom.toFixed(0)} of ${worst.window}`,
    )
    if (worst.hidden > 1) {
      problems.push(`${shape}: ${worst.hidden.toFixed(0)}px of an answered picture question is out of sight`)
    }
    if (worst.bottom > worst.window + 1 || worst.top < -1) {
      problems.push(`${shape}: the way back is off the screen`)
    }
  }
  await page.close()
}

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? `QUESTION FIT FAILED: ${problems.length}` : 'question fit clean')
process.exit(problems.length ? 1 : 0)

/**
 * The bargain the question card offers, pressed with a real finger.
 *
 * Five things have to hold and none of them can be unit-tested, because they
 * are about a card sitting over a game that captures pointer events:
 *   - the card opens with a choice rather than a question
 *   - "carry on without it" gets you straight back into the game
 *   - an answer pressed with a pointer registers
 *   - there is exactly ONE way out of the verdict. Offering another question
 *     after a wrong one was reported from the sofa as "he is using the
 *     questions as a way to get infinite lives", and he was: every death was
 *     recoverable with certainty because you could keep asking.
 *   - and the way out is ON THE SCREEN. Reported in the same breath: having
 *     to scroll up and down to find it. Checked in both shapes, because a
 *     phone held upright is where this happens.
 *
 * Pressed with real pointers throughout. Every time this card has broken it
 * has broken for fingers and not for keyboards.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const problems = []

/** Plays until something catches him, then works the card. */
async function run(shape, size) {
  const page = await browser.newPage({ viewport: size })
  page.on('pageerror', (e) => problems.push(`${shape}: page error: ${e.message}`))
  const say = (text) => console.log(`${shape}: ${text}`)

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
  await page.getByRole('button', { name: 'Papa Panic' }).first().click()
  await page.waitForTimeout(1200)
  for (let i = 0; i < 3; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(600) }
  }

  const offer = page.getByRole('button', { name: /^Answer it for/ })
  try {
    await offer.first().waitFor({ state: 'visible', timeout: 90000 })
    say('the card opens with the offer, not a question')
  } catch {
    problems.push(`${shape}: losing a life never brought up the offer`)
    await page.close()
    return
  }

  await offer.first().click()
  await page.waitForTimeout(500)
  const answers = page.locator('.rise-in.block-panel button')
  const before = await answers.count()
  if (before < 4) problems.push(`${shape}: the question offered ${before} answers`)

  const box = await answers.first().boundingBox()
  if (!box) problems.push(`${shape}: the first answer has no box to press`)
  else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
  }
  await page.waitForTimeout(700)

  const body = await page.innerText('body')
  // Case-insensitive: the verdict is styled uppercase, so innerText returns
  // GOT IT, and the first version of this check reported no verdict while the
  // buttons that only exist after a verdict were sitting right there.
  if (!/got it|not that one/i.test(body)) {
    problems.push(`${shape}: pressing an answer with a finger did nothing`)
    await page.close()
    return
  }
  say(`answered by finger: ${/got it/i.test(body) ? 'right' : 'wrong'}`)

  // One question means one question.
  const another = page.getByRole('button', { name: /another|again/i })
  if (await another.count()) {
    problems.push(`${shape}: the verdict still offers another question`)
  }

  const out = page.getByRole('button', { name: 'Back to it' })
  if ((await out.count()) !== 1) {
    problems.push(`${shape}: ${await out.count()} ways out of the verdict, want exactly 1`)
    await page.close()
    return
  }

  /*
   * And all of it fits. Two separate things: the card does not need scrolling
   * at all, and the button is inside the window whether it does or not.
   */
  const fit = await page.evaluate(() => {
    const panel = document.querySelector('.rise-in.block-panel')
    const scroller = panel?.querySelector('.overflow-y-auto')
    const press = [...panel.querySelectorAll('button')].find((b) => /back to it/i.test(b.textContent))
    const box = press.getBoundingClientRect()
    return {
      hidden: scroller ? scroller.scrollHeight - scroller.clientHeight : 0,
      bottom: box.bottom,
      top: box.top,
      window: window.innerHeight,
      // A flag question is the tall one: a picture at the top and four more
      // down the side. If this run happened to get a text question, it has
      // not tested the case that matters.
      flags: panel.querySelectorAll('canvas').length,
    }
  })
  say(fit.flags > 0 ? `a picture question (${fit.flags} flags)` : 'a text question')
  if (fit.bottom > fit.window + 1 || fit.top < -1) {
    problems.push(`${shape}: the way back is off the screen (${fit.top.toFixed(0)}..${fit.bottom.toFixed(0)} of ${fit.window})`)
  }
  if (fit.hidden > 1) {
    problems.push(`${shape}: ${fit.hidden.toFixed(0)}px of the answered question is out of sight`)
  } else {
    say('the whole thing fits, with the way back on it')
  }

  await out.first().click()
  await page.waitForTimeout(900)
  const after = await page.innerText('body')
  if (/right answer:|Answer it for/.test(after)) problems.push(`${shape}: never got back into the game`)
  else say('and back into the game')
  await page.close()
}

await run('upright', { width: 400, height: 820 })
await run('sideways', { width: 900, height: 500 })

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? `QUESTION FLOW FAILED: ${problems.length}` : 'question flow clean')
process.exit(problems.length ? 1 : 0)

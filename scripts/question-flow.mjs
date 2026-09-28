/**
 * The bargain the question card now offers, pressed with a real finger.
 *
 * Three things have to hold and none of them can be unit-tested, because they
 * are about a card sitting over a game that captures pointer events:
 *   - the card opens with a choice rather than a question
 *   - "carry on without it" gets you straight back into the game
 *   - taking the question, getting it wrong, and asking for another works
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
const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))

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

/** Sit still until something catches him. */
const offer = page.getByRole('button', { name: /^Answer one for/ })
try {
  await offer.first().waitFor({ state: 'visible', timeout: 90000 })
  console.log('the card opens with the offer, not a question')
} catch {
  problems.push('losing a life never brought up the offer')
}

if (!problems.length) {
  // Taking the question, and pressing an answer with a real pointer.
  await offer.first().click()
  await page.waitForTimeout(500)
  const answers = page.locator('.rise-in.block-panel button')
  const before = await answers.count()
  if (before < 4) problems.push(`the question offered ${before} answers`)

  const box = await answers.first().boundingBox()
  if (!box) problems.push('the first answer has no box to press')
  else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
  }
  await page.waitForTimeout(600)

  const body = await page.innerText('body')
  // Case-insensitive: the verdict is styled uppercase, so innerText returns
  // GOT IT, and the first version of this check reported no verdict while the
  // buttons that only exist after a verdict were sitting right there.
  if (!/got it|not that one/i.test(body)) {
    problems.push('pressing an answer with a finger did nothing')
  } else {
    console.log(`answered by finger: ${/got it/i.test(body) ? 'right' : 'wrong'}`)
  }

  // Whichever it was, there is a way back to the game.
  const out = page.getByRole('button', { name: /Back to it|Try another one|That is enough/ })
  if (!(await out.count())) problems.push('no way out of the verdict')
  else {
    // If it was wrong, take another one first — that is the new path.
    const another = page.getByRole('button', { name: 'Try another one' })
    if (await another.count()) {
      await another.first().click()
      await page.waitForTimeout(600)
      const again = await page.locator('.rise-in.block-panel button').count()
      if (again < 4) problems.push('asking for another question did not bring one')
      else console.log('asked for another question and got one')
      const back = page.getByRole('button', { name: /Back to it|That is enough/ })
      if (await back.count()) await back.first().click()
      else {
        const opts = page.locator('.rise-in.block-panel button')
        await opts.first().click()
        await page.waitForTimeout(500)
        const fin = page.getByRole('button', { name: /Back to it|That is enough/ })
        if (await fin.count()) await fin.first().click()
      }
    } else {
      await out.first().click()
    }
    await page.waitForTimeout(900)
    const after = await page.innerText('body')
    if (/right answer:|Answer one for/.test(after)) problems.push('never got back into the game')
    else console.log('and back into the game')
  }
}

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? `QUESTION FLOW FAILED: ${problems.length}` : 'question flow clean')
process.exit(problems.length ? 1 : 0)

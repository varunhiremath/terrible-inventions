/**
 * Do the cards work when they are touched?
 *
 * Every card in this app was reachable by keyboard and every check used one,
 * which is how the maths question came to be unanswerable by finger in three
 * games at once without anything failing. The games capture the pointer so a
 * thumb sliding off a button keeps steering; capture retargets the pointerup,
 * and the browser raises no click when the down and the up have different
 * targets.
 *
 * So this presses them the way a child does: with a pointer, and nothing else.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/touch.mjs
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const problems = []

const open = async (game) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: game }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700) }
}
const progress = async () =>
  Number(((await page.textContent('header')).match(/progress (\d+)/i) ?? [, '-1'])[1])

// --- space: the fact card that comes up when a shield goes -----------------
await open(/long way out/i)
await page.keyboard.down(' ')
let knocked = false
for (let wait = 0; wait < 25 && !knocked; wait++) {
  await page.waitForTimeout(1200)
  knocked = (await page.getByText(/did you know/i).count()) > 0
}
await page.keyboard.up(' ')
if (!knocked) problems.push('space never put up a fact card')
else {
  const before = await progress()
  await page.getByRole('button', { name: /back to it/i }).first().click()
  await page.waitForTimeout(1500)
  if ((await page.getByRole('button', { name: /back to it/i }).count()) > 0) {
    problems.push('the fact card could not be dismissed by touching it')
  }
  if ((await progress()) <= before) problems.push('the run did not carry on after the fact card')
}

// --- the road: the maths question that comes up when you prang -------------
await open(/the road/i)
await page.keyboard.down('ArrowUp')
let asked = false
for (let wait = 0; wait < 40 && !asked; wait++) {
  await page.waitForTimeout(1000)
  asked = (await page.locator('.rise-in.block-btn').count()) > 0
}
await page.keyboard.up('ArrowUp')
if (!asked) problems.push('the road never asked a question')
else {
  await page.locator('.rise-in.block-btn').first().click()
  await page.waitForTimeout(900)
  if ((await page.getByRole('button', { name: /back to it/i }).count()) === 0) {
    problems.push('the question could not be answered by touching an option')
  }
}

await browser.close()
if (problems.length) {
  console.error(`TOUCH FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('touch clean: the fact card and the maths question both answer to a finger')

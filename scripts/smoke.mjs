/**
 * End-to-end check: walks the workshop and repairs a machine, in a real browser.
 *
 * The unit tests cover the engine, the generators and the map, but only this
 * catches a world that will not render, a character you cannot reach, or a score
 * leaking into a screen it has no business on.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const EXECUTABLE = process.env.CHROMIUM_PATH

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {})
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()} :: ${m.location()?.url ?? ''}`)
})

const step = async (key, n) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key)
    await page.waitForTimeout(175)
  }
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

if (!/Corridor/.test(await page.textContent('header'))) problems.push('did not start in the corridor')

// Round Papa, along the corridor, and up into the kitchen to find Kettle.
await step('ArrowUp', 1)
await step('ArrowLeft', 14)
await step('ArrowUp', 4)
await page.waitForTimeout(300)

if (!/Kitchen/.test(await page.textContent('header'))) problems.push('could not walk to the kitchen')

const talk = page.getByRole('button', { name: 'Talk' })
if ((await talk.count()) === 0) problems.push('Kettle was not interactable')
else {
  await talk.click()
  await page.waitForTimeout(250)

  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' })
    if (!(await go.count())) break
    await go.click()
    await page.waitForTimeout(150)
  }

  const help = page.getByRole('button', { name: /Help Kettle/ })
  if ((await help.count()) === 0) problems.push('no mission was offered')
  else {
    await help.click()
    await page.waitForTimeout(600)

    const brief = await page.textContent('body')
    if (!/Unboil Kettle/.test(brief)) problems.push('mission title missing')
    // Kettle is broken in fractions, so that is what his mission must serve.
    if (!/actually bigger/.test(brief)) problems.push('mission served the wrong kind of problem')

    for (let i = 0; i < 4; i++) {
      const options = page.locator('button.block-btn').filter({ hasText: /^\d+\/\d+$|^\d+$/ })
      if (await options.count()) await options.first().click()
      else await page.locator('.block-btn').first().click()
      await page.waitForTimeout(300)

      const cont = page.getByRole('button', { name: /Keep going|Back to Kettle/ })
      if (!(await cont.count())) break
      await cont.click()
      await page.waitForTimeout(400)
    }

    await page.waitForTimeout(600)
    const after = await page.textContent('body')
    if (!/1 of 3 working/.test(after)) problems.push('the machine was not recorded as repaired')
    if (!/Kitchen/.test(after)) problems.push('the player was teleported out of the room')
  }
}

// No screen may grow a score.
const body = await page.textContent('body')
if (/\d+\s*%/.test(body)) problems.push('a percentage is being shown')
if (/\b(accuracy|score)\b/i.test(body)) problems.push('scoring language is being shown')

await browser.close()

if (problems.length) {
  console.error(`SMOKE FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('smoke test clean: walked the wing and repaired a machine')

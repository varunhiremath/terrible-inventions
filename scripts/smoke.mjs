/**
 * End-to-end check: plays a whole session in a real browser at iPad size.
 *
 * The unit tests cover the engine and the problem generators, but only this
 * catches a screen that fails to render, an answer that cannot be entered, or a
 * score leaking into the summary.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const EXECUTABLE = process.env.CHROMIUM_PATH

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {})
const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 })

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()} :: ${m.location()?.url ?? ''}`)
})

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Terrible')
await page.getByRole('button', { name: 'Fix a Machine' }).click()
await page.waitForTimeout(400)

const kinds = new Set()

for (let i = 0; i < 8; i++) {
  const body = await page.textContent('body')
  kinds.add(
    /Step \d+:/.test(body)
      ? 'papas-mistake'
      : body.includes('telling the truth')
        ? 'knights-knaves'
        : body.includes('actually bigger')
          ? 'fraction-duel'
          : body.includes('delivery bot')
            ? 'path-count'
            : 'rectangle-hunt',
  )

  if (i === 0) {
    // Hints must always be reachable and must never block answering.
    await page.getByRole('button', { name: /nudge/i }).click()
    await page.waitForTimeout(150)
  }

  const check = page.getByRole('button', { name: 'Check', exact: true })
  if (await check.count()) {
    const digit = page.getByRole('button', { name: '6', exact: true })
    if (await digit.count()) await digit.click()
    await check.first().click()
  } else {
    const step = page.locator('button', { hasText: /^Step \d+:/ })
    if (await step.count()) await step.first().click()
    else await page.locator('.block-btn').filter({ hasText: /\d/ }).first().click()
  }

  await page.waitForTimeout(250)
  const next = page.getByRole('button', { name: /Next machine|Finish/ })
  await next.waitFor({ timeout: 5000 })
  await next.click()
  await page.waitForTimeout(250)
}

await page.waitForSelector('text=Workshop closed', { timeout: 5000 })

// The summary is the screen most at risk of quietly growing a score.
const summary = await page.textContent('body')
if (/\d+\s*%/.test(summary)) problems.push('summary is showing a percentage')
if (/\b\d+\s*(?:\/|out of)\s*8\b/.test(summary)) problems.push('summary is showing a correct-out-of-total')
if (/\b(correct|wrong|score|accuracy)\b/i.test(summary)) problems.push('summary is using scoring language')

await browser.close()

console.log(`problem kinds seen: ${[...kinds].sort().join(', ')}`)
if (problems.length) {
  console.error(`SMOKE FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('smoke test clean')

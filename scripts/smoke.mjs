/**
 * End-to-end check, in a real browser with real WebGL.
 *
 * The unit tests cover the engine, the rules and the map. Only this catches a
 * world that will not render, a character you cannot reach, or a score leaking
 * onto a screen that has no business showing one.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const EXECUTABLE = process.env.CHROMIUM_PATH

const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  // Headless has no GPU; without a software rasteriser the canvas stays blank.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()} :: ${m.location()?.url ?? ''}`)
})

const step = async (key, n) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key)
    await page.waitForTimeout(180)
  }
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

// --- the hunt, which is what opens by default ------------------------------
const canvas = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  return { w: c.width, h: c.height, gl: !!gl }
})
if (!canvas || !canvas.w) problems.push('no canvas rendered')

if (!/Something is loose/.test(await page.textContent('header'))) {
  problems.push('did not open on the hunt')
}

await page.getByRole('button', { name: 'Notebook' }).click()
await page.waitForTimeout(300)
const trail = await page.locator('.font-mono').allTextContents()
if (trail.length < 4) problems.push(`trail too short to reason about: ${trail.join(',')}`)
// A chase that never leaves one or two rooms offers nothing to work out.
if (new Set(trail.filter((t) => t !== '?')).size < 3) {
  problems.push(`degenerate trail: ${trail.join(' -> ')}`)
}
await page.getByRole('button', { name: 'Right' }).click()
await page.waitForTimeout(300)

await step('ArrowUp', 5)
await page.waitForTimeout(400)

const trap = page.getByRole('button', { name: /Trap/ })
if ((await trap.count()) === 0) problems.push('could not walk into a room to set a trap')
else {
  await trap.click()
  await page.waitForTimeout(300)
  const wait = page.getByRole('button', { name: /Keep still/ })
  if ((await wait.count()) === 0) problems.push('trap was set but nothing happened next')
  else {
    await wait.click()
    await page.waitForTimeout(700)
    const outcome = await page.textContent('body')
    if (!/Got it|went somewhere else/.test(outcome)) problems.push('springing the trap gave no result')
    // A miss must read as evidence gained, never as a penalty.
    if (/went somewhere else/.test(outcome) && !/easier, not harder/.test(outcome)) {
      problems.push('a miss is not being framed as progress')
    }

    // Clear the result overlay, which otherwise sits over everything else.
    await page.getByRole('button', { name: /Look at the notebook|Another one has got out/ }).click()
    await page.waitForTimeout(400)
    const notebook = page.getByRole('button', { name: 'Right' })
    if (await notebook.count()) {
      await notebook.click()
      await page.waitForTimeout(300)
    }
  }
}

// --- the workshop, still reachable through the switcher --------------------
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /The workshop/ }).click()
await page.waitForTimeout(1200)
if (!/working/.test(await page.textContent('header'))) problems.push('could not switch to the workshop')

// No screen may grow a score.
const body = await page.textContent('body')
if (/\d+\s*%/.test(body)) problems.push('a percentage is being shown')
if (/\b(accuracy|score)\b/i.test(body)) problems.push('scoring language is being shown')

await browser.close()

if (problems.length) {
  console.error(`SMOKE FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('smoke test clean: hunted in 3D, and the workshop still switches in')

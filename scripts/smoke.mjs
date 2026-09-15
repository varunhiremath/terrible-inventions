/**
 * End-to-end check, in a real browser with real WebGL.
 *
 * The unit tests cover the maze, the chasers and the game loop. Only this
 * catches a game that will not render, a control that does nothing, or a score
 * leaking onto a screen that has no business showing one.
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

const hud = async () => (await page.textContent('header'))?.replace(/\s+/g, ' ').trim() ?? ''
const scoreNow = async () => Number((await hud()).match(/· (\d+)/)?.[1] ?? -1)

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const canvas = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { w: c.width, gl: !!(c.getContext('webgl2') || c.getContext('webgl')) } : null
})
if (!canvas?.w || !canvas.gl) problems.push('the maze did not render')
if (!/Level 1/.test(await hud())) problems.push('did not open on level 1')

// The opening pause: nothing should have been eaten yet.
if ((await scoreNow()) > 0) problems.push('play started before the ready pause finished')

// Then it should run, and run at a sensible pace rather than in slow motion.
await page.waitForTimeout(4000)
const afterOpening = await scoreNow()
if (afterOpening <= 0) problems.push('nothing happened once the pause ended')

for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
  await page.keyboard.press(key)
  await page.waitForTimeout(900)
}
if ((await scoreNow()) <= afterOpening) problems.push('steering did not move the player')

// --- the shop: maths buys power, and never merely permission ---------------
await page.getByRole('button', { name: 'Shop', exact: true }).click()
await page.waitForTimeout(700)

const shopText = await page.textContent('body')
if (!/Harder problem, better prize/.test(shopText)) problems.push('the shop is not framed as a shop')
if (!/Two-player puzzle/.test(shopText)) problems.push('the two-player puzzle is not offered')

await page.getByRole('button', { name: /Spare life/ }).click()
await page.waitForTimeout(900)
if (!/nudge/i.test(await page.textContent('body'))) problems.push('the shop served no problem')

// A hint must always be free and reachable.
await page.getByRole('button', { name: /nudge/i }).click()
await page.waitForTimeout(300)
if (!/Nudge 1/.test(await page.textContent('body'))) problems.push('hints are not available in the shop')

await browser.close()

// No screen may grow a score for being right at maths.
if (/\d+\s*%/.test(shopText)) problems.push('a percentage is being shown')
if (/\b(accuracy)\b/i.test(shopText)) problems.push('scoring language is being shown')

if (problems.length) {
  console.error(`SMOKE FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('smoke test clean: played the maze in 3D and bought from the shop')

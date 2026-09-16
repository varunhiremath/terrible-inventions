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

// There are no control buttons any more: the board itself is the control. A
// tap to one side of the player steers him that way, a drag steers as it goes.
// An earlier build worked only by swipe and arrow key and was unplayable
// because nothing said so, so the hint that replaced the pad is checked too.
if (!/tap where you want to go/i.test(await page.locator('body').innerText())) {
  problems.push('nothing on screen says the board can be touched')
}
if ((await page.locator('button[aria-label="up"]').count()) > 0) {
  problems.push('the d-pad is still on screen')
}

// Tapping: aim well away from the player on each side in turn. Wherever he is,
// at least some of these must be legal turns.
const board = await page.locator('canvas').boundingBox()
const beforeTaps = await scoreNow()
for (const [x, y] of [
  [board.x + board.width * 0.5, board.y + board.height * 0.05],
  [board.x + board.width * 0.95, board.y + board.height * 0.5],
  [board.x + board.width * 0.5, board.y + board.height * 0.95],
  [board.x + board.width * 0.05, board.y + board.height * 0.5],
]) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(700)
}
if ((await scoreNow()) <= beforeTaps) problems.push('tapping the board did not move the player')

// Dragging: a drag has to steer too, and a vertical one especially, since
// that is the gesture a phone user reaches for first. All four directions get
// a turn, because any one of them may be a wall or an already-cleared corridor
// — the score is what proves he moved, and he has to be able to move at all.
const beforeDrag = await scoreNow()
for (const [dx, dy] of [[0, -300], [300, 0], [0, 300], [-300, 0]]) {
  const midX = board.x + board.width / 2
  const midY = board.y + board.height / 2
  await page.mouse.move(midX, midY)
  await page.mouse.down()
  await page.mouse.move(midX + dx, midY + dy, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(900)
}
if ((await scoreNow()) <= beforeDrag) problems.push('dragging did not move the player')

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

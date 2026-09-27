/**
 * Does the FIRE button fire?
 *
 * Everything that ever checked the gun used the space bar, and the space bar
 * worked: it fires between frames, so the next frame picks the bullet up. The
 * button did not, for as long as the gun has existed, because the frame wrote
 * the shot to one copy of the game and then advanced a different one. This
 * presses the button, with a pointer, in the cave the gun is in.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/gun.mjs
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 900, height: 620 } })
const problems = []

// Cave five is "Armed": the gun is on a platform a few steps to the right.
await page.goto('http://127.0.0.1:4173/?cave=5&armed=1', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: /the caves/i }).first().click()
await page.waitForTimeout(600)
const skip = page.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(800) }

const hud = async () => (await page.textContent('header')).replace(/\s+/g, ' ').trim()
if (!/level 05/i.test(await hud())) problems.push('the cave hook did not open cave five')

if (!/GUN/.test(await hud())) problems.push('the armed hook did not hand over a gun')

/*
 * Now the button, with a pointer. Its place comes from the same arithmetic the
 * game lays the pad out with: fire sits one gap left of the jump button, in
 * the bottom right.
 */
const box = await page.locator('canvas').boundingBox()
const dpr = await page.evaluate(() => Math.min(window.devicePixelRatio || 1, 2))
const r = Math.max(26, Math.min(56, Math.min(box.width * dpr, box.height * dpr) * 0.085)) / dpr
const edge = r * 0.85
const gap = r * 2.25
const fire = [box.x + box.width - edge - r - gap, box.y + box.height - edge - r]

const before = Number((await hud()).match(/shots (\d+)/i)?.[1] ?? '-1')
if (before < 0) problems.push('the shot count is not being reported')

// Three separate taps, short ones, which is how a shot is actually taken.
for (let i = 0; i < 3; i++) {
  await page.mouse.move(...fire)
  await page.mouse.down()
  await page.waitForTimeout(40)
  await page.mouse.up()
  await page.waitForTimeout(700)
}

const after = Number((await hud()).match(/shots (\d+)/i)?.[1] ?? '-1')
if (after <= before) problems.push(`the FIRE button fired nothing (shots ${before} -> ${after})`)

await browser.close()
if (problems.length) {
  console.error(`GUN FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`gun clean: the FIRE button fired it in cave five (shots ${before} -> ${after})`)

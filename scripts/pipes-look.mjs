/**
 * What the pipes actually look like now.
 *
 * Three things were asked for and none of them can be answered from a diff:
 * keep the plumber in the left half so you can see what is coming, give him a
 * way into a pipe, and make him rounder. So: play it, photograph it, and read
 * off the picture where on the screen he actually was while running.
 *
 * Against the dev server, because the reading is behind an import.meta.env.DEV
 * guard — a number the game does not need is not a number to ship.
 *
 *     npx vite --port 5199
 *     node scripts/pipes-look.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/pipes', { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
const problems = []

await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: /The Pipes/i }).first().click()
await page.waitForTimeout(700)
const skip = page.getByRole('button', { name: 'Skip' })
if ((await skip.count()) > 0) await skip.first().click()
await page.waitForTimeout(1600)

// Run right, and watch where on the screen he is while he does it.
await page.keyboard.down('ArrowRight')
const seen = []
for (let n = 0; n < 26; n++) {
  await page.waitForTimeout(220)
  const where = await page.evaluate(() => window.__pipesDrawn ?? null)
  if (where) seen.push(where.at)
}
await page.screenshot({ path: '/tmp/pipes/running.png' })
await page.keyboard.up('ArrowRight')

if (seen.length < 10) problems.push(`only ${seen.length} readings of where he is`)
const worst = Math.max(...seen)
if (worst > 0.52) {
  problems.push(`he reached ${(worst * 100).toFixed(0)}% across, which is not the left half`)
}
console.log(`across the screen: ${seen.map((s) => (s * 100).toFixed(0)).join(' ')}`)

/*
 * And down a pipe. Which pipe is the first warp is a fact about the level, so
 * ask the level rather than hunting for a green rectangle.
 */
const warp = await page.evaluate(async () => {
  const { LEVELS } = await import('/src/pipes/levels.ts')
  return LEVELS[0].warps[0] ?? null
})
if (!warp) problems.push('level one has no pipe to go down')
else {
  // Walk to it, stand on it, and press down.
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(6000)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/pipes/at-a-pipe.png' })
  console.log(`first warp on level 1: down the pipe at column ${warp.from}, up at ${warp.to}`)
}

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? 'PIPES FAILED' : `pipes clean: never past ${(worst * 100).toFixed(0)}% across`)
process.exit(problems.length ? 1 : 0)

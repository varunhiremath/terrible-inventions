/**
 * What deep space looks like now that something out there is shooting back.
 *
 * Not a test — a photograph. Two things were asked for and neither can be
 * judged from a diff: aliens to fight, and the whole thing read as having
 * depth. Flown out to a world where the saucers are, with the trigger held
 * down, in both shapes.
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/space-look.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/space', { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
})
const problems = []

/*
 * Four places, because past Neptune they stop being planets and start being a
 * star, a nebula, a black hole and a galaxy — four quite different drawings
 * that have never been looked at.
 */
for (const [shape, world, size] of [
  ['jupiter', 5, { width: 412, height: 915 }],
  ['sirius', 12, { width: 412, height: 915 }],
  ['crab-nebula', 14, { width: 412, height: 915 }],
  ['black-hole', 15, { width: 412, height: 915 }],
  ['andromeda', 16, { width: 915, height: 412 }],
]) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => problems.push(`${shape}: page error: ${e.message}`))
  await page.goto(`http://127.0.0.1:4173/?world=${world}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /long way out/i }).first().click()
  await page.waitForTimeout(700)
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: /skip to the game|^skip$/i })
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
  }

  // Trigger down, and take a picture every couple of seconds — the saucers
  // arrive when they arrive.
  await page.keyboard.down('ArrowUp')
  let sawAlien = false
  let sawShot = false
  for (let n = 0; n < 12; n++) {
    await page.waitForTimeout(1300)
    const now = await page.evaluate(() => window.__spaceDrawn ?? null)
    if (now?.aliens > 0) sawAlien = true
    if (now?.shots > 0) sawShot = true
    // Keep the card out of the way if a knock puts one up.
    const back = page.getByRole('button', { name: /back to it|carry on without/i })
    if (await back.count()) { await back.first().click(); await page.waitForTimeout(400) }
    if (sawAlien && sawShot) break
  }
  await page.screenshot({ path: `/tmp/space/${shape}.png` })
  await page.keyboard.up('ArrowUp')

  const deep = world > 8
  if (deep && !sawAlien) problems.push(`${shape}: flew for fifteen seconds and met no aliens`)
  if (!deep && sawAlien) problems.push(`${shape}: aliens inside the solar system`)
  if (deep && !sawShot) problems.push(`${shape}: nothing ever shot back`)
  console.log(`${shape}: ${deep ? 'aliens out there, and firing' : 'rock and weather, as it should be'}`)
  await page.close()
}

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? 'SPACE FAILED' : 'space clean')
process.exit(problems.length ? 1 : 0)

/**
 * A look at a cave, from the probe hook.
 *
 * The solver proves a cave can be finished. It does not prove it looks like
 * anything, and the flying level was rebuilt into a slalom — a thing that is
 * either readable at a glance or is a wall of orange.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/caves', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const cave of (process.env.CAVES ?? '4').split(',')) {
  const page = await browser.newPage({ viewport: { width: 900, height: 620 }, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:4173/?cave=${cave}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /the caves/i }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700) }
  await page.screenshot({ path: `/tmp/caves/cave-${cave}-start.png` })

  // Fly right for a few seconds and look again, which is where the slalom is.
  await page.keyboard.down('ArrowUp')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(3500)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('ArrowUp')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `/tmp/caves/cave-${cave}-along.png` })
  console.log('cave', cave, (await page.textContent('header')).replace(/\s+/g, ' ').trim())
  await page.close()
}
await browser.close()

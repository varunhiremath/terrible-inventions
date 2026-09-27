/** What the settings actually look like, on a phone and on a laptop. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/settings', { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const size of [{ w: 390, h: 844, tag: 'phone' }, { w: 1100, h: 800, tag: 'wide' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
  await page.getByRole('button', { name: 'Settings' }).first().click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `/tmp/settings/${size.tag}.png`, fullPage: true })
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  console.log(`${size.tag}: ${over ? 'OVERFLOWS SIDEWAYS' : 'fits'}`)
  await page.close()
}
await browser.close()

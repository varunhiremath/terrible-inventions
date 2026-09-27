/** The workshop, and the front door with the purse on it. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/shop2', { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const size of [{ w: 412, h: 915, tag: 'portrait' }, { w: 915, h: 412, tag: 'landscape' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `/tmp/shop2/home-${size.tag}.png` })
  await page.getByRole('button', { name: /the workshop/i }).first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `/tmp/shop2/workshop-${size.tag}.png` })
  console.log(size.tag, 'workshop open:', (await page.getByText(/on the shelf/i).count()) > 0)
  await page.close()
}
await browser.close()

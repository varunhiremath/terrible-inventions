/**
 * The shop, photographed.
 *
 * It only opens when you land, and landing takes a minute of flying nobody can
 * automate well, so this uses the probe hook to set off from Mercury with a
 * pocket full of scrap and then waits out the run. A picture is the only way
 * to find out whether five rows of shop fit under an arrival card on a phone.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/shop', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const size of [{ w: 412, h: 915, tag: 'portrait' }, { w: 915, h: 412, tag: 'landscape' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 })
  await page.goto('http://127.0.0.1:4173/?world=1&scrap=150', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /long way out/i }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700) }

  // Hug an edge, which is the cheapest way to survive without knowing where
  // anything is, and dismiss any fact card that still gets through.
  await page.keyboard.down('ArrowLeft')
  let landed = false
  for (let wait = 0; wait < 100 && !landed; wait++) {
    await page.waitForTimeout(1000)
    const again = page.getByRole('button', { name: /back to it/i })
    if (await again.count()) { await again.first().click(); await page.waitForTimeout(200) }
    landed = (await page.getByText(/scrap in hand/i).count()) > 0
      || (await page.getByText(/out of shields/i).count()) > 0
  }
  await page.keyboard.up('ArrowLeft')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/shop/shop-${size.tag}.png` })
  console.log(size.tag, 'shop open:', (await page.getByText(/scrap in hand/i).count()) > 0)
  await page.close()
}
await browser.close()

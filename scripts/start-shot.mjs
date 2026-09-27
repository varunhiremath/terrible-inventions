/**
 * The start of a race, and the end of one.
 *
 * Both are new and both are the sort of thing only a picture settles: five
 * cars on a grid three quarters of a lane apart, and a result panel with five
 * times in it.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/start', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const size of [{ w: 412, h: 915, tag: 'portrait' }, { w: 915, h: 412, tag: 'landscape' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 })
  await page.goto('http://127.0.0.1:4173/?sprint=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /the road/i }).first().click()
  await page.waitForTimeout(400)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }

  // Two lights in: the grid is still sitting there and the gantry is lit.
  await page.waitForTimeout(1700)
  await page.screenshot({ path: `/tmp/start/grid-${size.tag}.png` })

  await page.keyboard.down('ArrowUp')
  let done = false
  for (let wait = 0; wait < 25 && !done; wait++) {
    await page.waitForTimeout(700)
    done = (await page.getByText(/your best|no time to beat/i).count()) > 0
  }
  await page.keyboard.up('ArrowUp')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `/tmp/start/result-${size.tag}.png` })
  console.log(size.tag, 'finished:', done, '|', (await page.textContent('header')).replace(/\s+/g, ' ').trim())
  await page.close()
}
await browser.close()

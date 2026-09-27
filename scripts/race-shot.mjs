/**
 * The race, photographed: the field on the road, and the order at the flag.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/race', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const size of [{ w: 412, h: 915, tag: 'portrait' }, { w: 915, h: 412, tag: 'landscape' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /the road/i }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700) }

  // Hold the pedal: the field comes past in the first few seconds.
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `/tmp/race/road-${size.tag}.png` })

  // Then run the stage out for the finishing order.
  let done = false
  for (let wait = 0; wait < 90 && !done; wait++) {
    await page.waitForTimeout(1000)
    const q = page.locator('.rise-in.block-btn')
    if (await q.count()) {
      await q.first().click()
      await page.waitForTimeout(600)
      const back = page.getByRole('button', { name: /back to it/i })
      if (await back.count()) { await back.first().click(); await page.waitForTimeout(400) }
    }
    done = (await page.getByText(/on the line/i).count()) > 0
      || (await page.getByText(/back to the start of the motorway/i).count()) > 0
  }
  await page.keyboard.up('ArrowUp')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `/tmp/race/finish-${size.tag}.png` })
  console.log(size.tag, 'finished:', done, '|', (await page.textContent('header')).replace(/\s+/g, ' ').trim())
  await page.close()
}
await browser.close()

/**
 * Race a lap, then race it again and look for the ghost.
 *
 * The ghost only exists once somebody has set a time, so this has to do the
 * stage twice: the first run records it, the second should have a pale car on
 * the road alongside.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/ghost', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

const lap = async () => {
  await page.goto('http://127.0.0.1:4173/?sprint=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /the road/i }).first().click({ force: true })
  await page.waitForTimeout(400)
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
  await page.keyboard.down('ArrowUp')
  let done = false
  for (let i = 0; i < 25 && !done; i++) {
    await page.waitForTimeout(600)
    done = (await page.getByText(/best|no time to beat/i).count()) > 0
  }
  await page.keyboard.up('ArrowUp')
  return done
}

console.log('first lap recorded:', await lap())
const text = await page.innerText('body')
console.log('panel says:', (text.match(/(Your best yet[^\n]*|Best here[^\n]*|No time to beat[^\n]*)/) ?? ['-'])[0])

/*
 * Second lap, photographed while it is happening.
 *
 * The first go took the picture after the lap had already finished, which on
 * a four-second sprint means a picture of the results panel — and proved
 * nothing about whether the pale car is ever drawn.
 */
await page.goto('http://127.0.0.1:4173/?sprint=1', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /the road/i }).first().click({ force: true })
await page.waitForTimeout(400)
const skip2 = page.getByRole('button', { name: /skip/i })
if (await skip2.count()) { await skip2.first().click(); await page.waitForTimeout(500) }
// Through the lights, then a moment of racing, then the shot.
await page.waitForTimeout(3200)
await page.keyboard.down('ArrowUp')
await page.waitForTimeout(1100)
await page.screenshot({ path: '/tmp/ghost/racing.png' })
await page.keyboard.up('ArrowUp')
console.log('second lap shot taken mid-race')
await browser.close()

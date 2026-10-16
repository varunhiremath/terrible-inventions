/** A picture of every gun on the ladder, to check five shapes read as five. */
import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5174/guns.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/guns.png' })
await browser.close()
console.log('shot taken')

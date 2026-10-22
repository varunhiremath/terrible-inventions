/**
 * The front screen's shelf, measured rather than admired.
 *
 * What it is checking is the thing that went wrong: every tile the same size.
 * A screenshot shows that at a glance and a script should not have to squint
 * at one, so it reads the boxes off the page and compares them. It also drags
 * the shelf sideways to be sure the games past the edge can actually be
 * reached, and takes pictures at phone, landscape and tablet sizes, because
 * the sizes are where a layout goes wrong.
 */
import { chromium } from 'playwright'

const SITE = process.argv[2] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const shapes = [
  { name: 'phone', width: 430, height: 860 },
  { name: 'small', width: 360, height: 640 },
  { name: 'sideways', width: 860, height: 430 },
  { name: 'tablet', width: 834, height: 1112 },
]

let problems = 0
for (const shape of shapes) {
  const page = await browser.newPage({ viewport: { width: shape.width, height: shape.height } })
  page.on('pageerror', (e) => { problems++; console.log(`${shape.name}: page error: ${e.message}`) })
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1400)
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: 'Skip' })
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(400) }
  }
  await page.waitForTimeout(600)

  const shelf = page.locator('.shelf')
  const tiles = shelf.locator('button')
  const count = await tiles.count()

  // Every tile, as the browser has actually laid it out.
  const boxes = []
  for (let i = 0; i < count; i++) boxes.push(await tiles.nth(i).boundingBox())
  const wide = boxes.map((b) => Math.round(b.width))
  const high = boxes.map((b) => Math.round(b.height))
  const spread = (ns) => Math.max(...ns) - Math.min(...ns)

  console.log(`${shape.name} (${shape.width}x${shape.height}): ${count} tiles, ` +
    `${Math.min(...wide)}-${Math.max(...wide)} wide, ${Math.min(...high)}-${Math.max(...high)} high`)
  // A pixel of rounding is nobody's problem; a tile a different size is.
  if (spread(wide) > 2) { problems++; console.log(`  SHELF FAILED: widths differ by ${spread(wide)}px`) }
  if (spread(high) > 2) { problems++; console.log(`  SHELF FAILED: heights differ by ${spread(high)}px`) }

  // Can the ones off the right-hand edge be got to?
  const reach = await shelf.evaluate((el) => ({ seen: el.clientWidth, all: el.scrollWidth }))
  if (reach.all <= reach.seen + 4) {
    problems++
    console.log(`  SHELF FAILED: nothing to scroll (${reach.all} of ${reach.seen} visible)`)
  }
  await page.screenshot({ path: `/tmp/shelf-${shape.name}.png` })

  await shelf.evaluate((el) => el.scrollTo({ left: el.scrollWidth / 2.6, behavior: 'instant' }))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `/tmp/shelf-${shape.name}-middle.png` })

  await shelf.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  await page.waitForTimeout(500)
  const atEnd = await shelf.evaluate((el) => el.scrollLeft)
  const last = await tiles.nth(count - 1).boundingBox()
  const frame = page.viewportSize()
  if (last.x + last.width > frame.width + 2 || last.x < -2) {
    problems++
    console.log(`  SHELF FAILED: the last game is still off the screen at ${Math.round(last.x)}`)
  }
  console.log(`  scrolled ${Math.round(atEnd)} of ${reach.all - reach.seen}, last tile at ${Math.round(last.x)}`)
  await page.screenshot({ path: `/tmp/shelf-${shape.name}-end.png` })
  await page.close()
}

console.log(problems === 0 ? 'SHELF: every tile the same size, and all of them reachable' : `${problems} problems`)
await browser.close()

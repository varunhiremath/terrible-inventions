import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'

const URL = 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
// A phone on its side. 915x412 is a Pixel; 740x360 is a small/older one.
const SIZES = [{ w: 915, h: 412, tag: 'pixel' }, { w: 740, h: 360, tag: 'small' }]
mkdirSync('/tmp/land', { recursive: true })
const report = []

const audit = async (page, label, tag) => {
  await page.waitForTimeout(400)
  const facts = await page.evaluate(() => {
    const doc = document.documentElement
    const vw = window.innerWidth
    const vh = window.innerHeight

    /*
     * Whether the page can be scrolled to what is below the fold.
     *
     * Settings is a long list on purpose and runs well past one screen, so
     * "there is a button below the fold" is not a fault there — it is only a
     * fault if there is no way to reach it. A game or a question, which have
     * nowhere to scroll to, is a different matter: anything past the edge is
     * simply gone.
     */
    const scroller = document.scrollingElement
    const reachable = scroller.scrollHeight - scroller.clientHeight

    const off = []
    for (const el of document.querySelectorAll('button, canvas, input, textarea, h1, h2')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const text = (el.textContent || el.tagName).trim().slice(0, 30)
      const below = r.bottom - vh
      const lost = (below > 1 && below > reachable) || r.top < -1 - reachable || r.right > vw + 1 || r.left < -1
      if (lost) {
        off.push(`${el.tagName} "${text}" at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
    return {
      vw, vh,
      scrollH: doc.scrollHeight,
      scrollW: doc.scrollWidth,
      reachable,
      off,
    }
  })
  const overflowY = facts.scrollH > facts.vh + 2
  const overflowX = facts.scrollW > facts.vw + 2
  report.push({ label, tag, ...facts, overflowY, overflowX })
  writeFileSync(`/tmp/land/${tag}-${label}.png`, await page.screenshot())
}

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } })
  const skipIntro = async () => {
    const skip = page.getByRole('button', { name: 'Skip' })
    if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(700) }
  }

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await audit(page, 'home', size.tag)

  for (const game of ['Papa Panic', 'The Caves', 'The Dungeon', 'The Pipes']) {
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const b = page.getByRole('button', { name: new RegExp(game, 'i') })
    if ((await b.count()) === 0) { report.push({ label: game, tag: size.tag, missing: true }); continue }
    await b.first().click()
    await page.waitForTimeout(700)
    await audit(page, `intro-${game.replace(/\s+/g, '')}`, size.tag)
    await skipIntro()
    await page.waitForTimeout(1500)
    await audit(page, `game-${game.replace(/\s+/g, '')}`, size.tag)
  }
  // Settings, which is the longest scrolling screen in the app and the one
  // most likely to trap a control off the bottom edge.
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const gear = page.getByRole('button', { name: /settings/i })
  if ((await gear.count()) > 0) {
    await gear.first().click()
    await page.waitForTimeout(600)
    await audit(page, 'settings', size.tag)
  }

  /*
   * The question between lives.
   *
   * There is no route to it: it arrives when you lose a life. So the maze is
   * opened and left alone, which the four Machines resolve fairly promptly,
   * and the screen is caught when the answer buttons turn up.
   */
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /papa panic/i }).first().click()
  await page.waitForTimeout(700)
  await skipIntro()
  let caught = false
  for (let wait = 0; wait < 40 && !caught; wait++) {
    await page.waitForTimeout(1500)
    if ((await page.getByRole('button', { name: /^skip$/i }).count()) > 0) {
      await audit(page, 'question', size.tag)
      caught = true
    }
  }
  if (!caught) report.push({ label: 'question', tag: size.tag, missing: 'never lost a life' })

  await page.close()
}

console.log(JSON.stringify(report, null, 1))
await browser.close()

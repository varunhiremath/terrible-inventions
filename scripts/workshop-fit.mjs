/**
 * The maths lives in the workshop now, and the workshop is where the long
 * questions land: logic grids, "using all 45 blocks", route counting. On a
 * phone held sideways those are the cards that used to push their answer
 * buttons off the bottom. This walks a stack of problems and checks every
 * button is reachable — on screen, or scrollable to inside the card's column.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const problems = []
for (const size of [{ w: 915, h: 412, tag: 'pixel' }, { w: 740, h: 360, tag: 'small' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
  await page.getByRole('button', { name: /workshop/i }).first().click()
  await page.waitForTimeout(700)

  for (let round = 0; round < 12; round++) {
    const card = page.locator('.block-panel').first()
    if (!(await card.count())) break
    const prompt = ((await card.locator('p').first().textContent()) ?? '').trim()

    const state = await page.evaluate(() => {
      const scroller = document.querySelector('.overflow-y-auto')
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
      const room = scroller ? scroller.scrollHeight - scroller.clientHeight : 0
      const bad = []
      for (const el of document.querySelectorAll('.block-panel button')) {
        const r = el.getBoundingClientRect()
        // Reachable means: inside the scroller's column once you have scrolled
        // as far as it goes. Anything past that is genuinely unreachable.
        const below = r.bottom - box.bottom
        if (below > room + 1 || r.right > window.innerWidth + 1 || r.left < -1) {
          bad.push(`"${(el.textContent || '').trim().slice(0, 14)}" ${Math.round(below - room)}px past the end`)
        }
      }
      return { bad, room: Math.round(room) }
    })
    problems.push({ tag: size.tag, round, prompt: prompt.slice(0, 46), ...state })

    // Generated sums come with a keypad, not multiple choice, so there is no
    // button this probe can press to move on. Reloading into the workshop
    // rolls a fresh one, which is all we need for variety.
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const s2 = page.getByRole('button', { name: 'Skip' })
    if (await s2.count()) { await s2.first().click(); await page.waitForTimeout(400) }
    await page.getByRole('button', { name: /workshop/i }).first().click()
    await page.waitForTimeout(700)
  }
  await page.close()
}
await browser.close()

const broken = problems.filter((p) => p.bad.length)
for (const p of problems) {
  console.log(`${p.bad.length ? 'UNREACHABLE' : 'ok         '} ${p.tag} ${p.round} scroll=${p.room} "${p.prompt}" ${p.bad.join('; ')}`)
}
console.log(broken.length ? `\nWORKSHOP FAILED: ${broken.length} card(s) with unreachable buttons` : `\nworkshop fit clean: ${problems.length} cards, every button reachable`)
process.exit(broken.length ? 1 : 0)

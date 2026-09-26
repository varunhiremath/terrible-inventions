/**
 * Every shape of maths question, on a phone held sideways.
 *
 * The landscape audit can only catch whichever question happens to come up,
 * and it caught the route grid by luck. This walks all five kinds deliberately.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/questions'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const problems = []
for (const size of [{ w: 915, h: 412, tag: 'pixel' }, { w: 740, h: 360, tag: 'small' }]) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Straight to the maze, wait to be caught, then look at the question. Ten
  // goes round, because which kind comes up is the engine's business.
  for (let round = 0; round < 14; round++) {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: /papa panic/i }).first().click()
    await page.waitForTimeout(500)
    const skip = page.getByRole('button', { name: 'Skip' })
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600) }

    let seen = false
    for (let wait = 0; wait < 30 && !seen; wait++) {
      await page.waitForTimeout(1200)
      if (await page.locator('.rise-in.block-panel').count()) {
        // The panel slides in, so measuring the instant it appears reads
        // positions that are still moving. Two of the first run's three
        // "off-screen" findings were that, and only one was real.
        await page.waitForTimeout(900)
        seen = true
      }
    }
    if (!seen) continue

    const off = await page.evaluate(() => {
      const vh = window.innerHeight
      const vw = window.innerWidth
      const bad = []
      for (const el of document.querySelectorAll('.rise-in.block-panel button')) {
        const r = el.getBoundingClientRect()
        if (r.bottom > vh + 1 || r.right > vw + 1 || r.top < -1 || r.left < -1) {
          bad.push(`${(el.textContent || '').trim().slice(0, 12)} at ${Math.round(r.top)}`)
        }
      }
      const panel = document.querySelector('.rise-in.block-panel')
      return { bad, scrolls: panel ? panel.scrollHeight > panel.clientHeight + 1 : false }
    })
    const prompt = (await page.locator('.rise-in.block-panel p').first().textContent()) ?? ''
    problems.push({ tag: size.tag, round, prompt: prompt.slice(0, 48), ...off })
    await page.screenshot({ path: `${OUT}/${size.tag}-${round}.png` })
  }
  await page.close()
}

await browser.close()
for (const p of problems) {
  const flag = p.bad.length || p.scrolls ? 'OFF-SCREEN' : 'ok'
  console.log(flag.padEnd(11), p.tag, p.round, JSON.stringify(p.prompt), p.bad.join('; '))
}

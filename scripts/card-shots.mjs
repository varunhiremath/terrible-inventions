/**
 * Pictures of the question card.
 *
 * Losing a life on purpose is the only way to see this screen, and which
 * question turns up is a roll of the dice, so this goes round several times to
 * catch more than one shape of it: a flag to name, four flags to choose
 * between, a plain question, and a typed-in sum.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (let go = 1; go <= Number(process.argv[2] ?? 4); go++) {
  const page = await browser.newPage({ viewport: { width: 900, height: 820 } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Papa Panic/i }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) {
    await skip.first().click()
    await page.waitForTimeout(600)
  }

  // Stop steering and wait to be caught.
  let asked = false
  for (let i = 0; i < 50 && !asked; i++) {
    await page.waitForTimeout(1000)
    asked = /a quick one|numbers|history|geography|anything/i.test(await page.innerText('body'))
  }
  if (!asked) {
    console.log(`go ${go}: never died`)
    await page.close()
    continue
  }
  await page.waitForTimeout(700)

  // When a topic is named on the command line, keep going until that one turns
  // up. The flag questions are the newest and least proven path through this
  // screen, and they are also the least likely to appear by chance.
  const wanted = process.argv[3]
  const body = await page.innerText('body')
  if (wanted && !new RegExp(wanted, 'i').test(body)) {
    await page.close()
    continue
  }
  await page.screenshot({ path: `/tmp/card-${wanted ?? go}.png` })
  console.log(`go ${go}: captured${wanted ? ` (${wanted})` : ''}`)
  await page.close()
  if (wanted) break
}
await browser.close()

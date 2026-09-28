/**
 * Does the listening page survive the service worker?
 *
 * It is a plain HTML file sitting next to a single-page app, and workbox
 * answers any navigation it does not recognise with the app's own index.html.
 * On a phone with the app installed that would quietly load the games instead
 * — which is exactly the device this page exists for. So: install the worker,
 * then navigate to the page the way somebody tapping a link would.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 420, height: 800 } })
const problems = []

// Install the worker and get the page controlled, which is the state that matters.
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.evaluate(() => navigator.serviceWorker.ready.catch(() => null))
await page.reload({ waitUntil: 'networkidle' })
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
  problems.push('the page never came under the service worker, so this proves nothing')
}

await page.goto('http://127.0.0.1:4173/listen/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const title = await page.title()
if (!/listen/i.test(title)) problems.push(`the worker served something else: "${title}"`)

const players = await page.locator('audio').count()
if (players < 6) problems.push(`only ${players} players on the page`)

// And the audio has to actually decode, not just be linked.
const ok = await page.evaluate(async () => {
  const one = document.querySelector('audio')
  if (!one) return 'no player'
  const res = await fetch(one.getAttribute('src'))
  if (!res.ok) return `fetch ${res.status}`
  const bytes = await res.arrayBuffer()
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    const buf = await ctx.decodeAudioData(bytes)
    return `decoded ${buf.duration.toFixed(1)}s`
  } catch (e) {
    return `would not decode: ${e}`
  }
})
if (!String(ok).startsWith('decoded')) problems.push(`the clips do not play: ${ok}`)
else console.log(`first clip ${ok}`)

await page.screenshot({ path: '/tmp/listen.png', fullPage: true })
await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? 'LISTEN FAILED' : `listen clean: the page loads under the worker with ${players} players`)
process.exit(problems.length ? 1 : 0)

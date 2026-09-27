/**
 * Does the app actually play a rendered clip?
 *
 * The clips are looked up by a hash of the line as it is written in the
 * source. Get that wrong by one character — a filled-in name, a smart quote —
 * and every lookup misses, the synthesiser quietly takes over, and everything
 * looks and sounds exactly like it did before. So this watches for the audio
 * request rather than trusting the plumbing.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const asked = []
page.on('request', (r) => { if (r.url().includes('/voice/')) asked.push(r.url().split('/').pop()) })

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /the road/i }).first()
  .click({ force: true, timeout: 15000 })
await page.waitForTimeout(22000)

const clips = asked.filter((n) => n.endsWith('.opus'))
await browser.close()

if (!asked.includes('index.json')) {
  console.error('VOICE FAILED: the clip index was never fetched')
  process.exit(1)
}
// Several, not one: the first beat matching proves the plumbing, and a later
// beat matching proves the lookup is not accidentally right for one line.
if (clips.length < 3) {
  console.error(`VOICE FAILED: only ${clips.length} clip(s) played in an intro of seven lines`)
  process.exit(1)
}
if (new Set(clips).size !== clips.length) {
  console.error('VOICE FAILED: the same clip was played twice, so a lookup is collapsing')
  process.exit(1)
}
console.log(`voice clean: played ${clips.length} rendered clip(s) in the intro`)

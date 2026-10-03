/**
 * One photograph per beat of a cutscene.
 *
 * Taken from the real component rather than by calling a scene function, so
 * what comes back includes the caption, the title card and the skip button —
 * all the things that can cover up the picture and none of which a direct call
 * to the scene would show.
 *
 * Each beat is shot from a fresh mount, waiting out the beats in front of it.
 * The cutscene starts its own stopwatch when it mounts and takes no offset, so
 * there is no faster way that is also honest.
 *
 *     npx vite --port 5199
 *     node scripts/story-shot.mjs [story]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const story = process.argv[2] ?? 'space'
const out = `/tmp/story-${story}`
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 500, height: 950 } })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/story.html', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)

const beats = await page.evaluate((id) => window.__beats(id), story)
console.log(`${story}: ${beats.length} beats, ${beats[beats.length - 1].at + beats[beats.length - 1].seconds}s`)

for (const beat of beats) {
  await page.evaluate((id) => window.__go(id), story)
  // The middle of the beat: far enough in that whatever grows has grown, far
  // enough from the end that the next beat has not started.
  await page.waitForTimeout((beat.at + beat.seconds * 0.55) * 1000)

  // The bench has lied about canvas size before. Measure, then photograph.
  const size = await page.evaluate(() => window.__size())
  if (!size || size[1] < 400) throw new Error(`canvas is ${size}px — the page is not laid out`)

  const tag = String(beat.i).padStart(2, '0')
  await page.screenshot({ path: `${out}/${tag}-${beat.scene}.png` })
  console.log(`${tag} ${beat.scene.padEnd(9)} ${beat.voice.padEnd(8)} ${beat.line}`)
}

console.log(`\n${out}`)
await browser.close()

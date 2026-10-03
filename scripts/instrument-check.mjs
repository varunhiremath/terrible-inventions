/**
 * Do the four new voices behave like the things they are named after?
 *
 * A piano is not a waveform, it is a shape in time: struck in a few
 * thousandths of a second, bright at the moment it is struck, and losing its
 * top long before it goes quiet. An "FM piano" that holds a steady brightness
 * is an organ with a fast attack, and the difference is obvious to anybody
 * listening and invisible in the code.
 *
 * So each one plays a single middle C through the game's own synthesiser, and
 * this reports the three numbers that say which it is: how long to the peak,
 * how long until it has fallen to a tenth of that, and where the energy sits
 * at the start against a quarter of a second later.
 *
 *     npx vite --port 5199
 *     node scripts/instrument-check.mjs
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })

const rows = await page.evaluate(async () => {
  const player = await import('/src/music/player.ts')
  const RATE = 44100
  const out = []

  for (const wave of ['piano', 'bell', 'pluck', 'strings', 'triangle']) {
    const ctx = new OfflineAudioContext(1, RATE * 3, RATE)
    const gain = ctx.createGain()
    gain.gain.value = 1
    gain.connect(ctx.destination)
    /*
     * One note and nothing else.
     *
     * Two bars rather than one, and that is not padding. With a one-bar loop
     * the note is struck again two seconds in, inside the window being
     * measured — so the first reading off this said the piano reached its
     * loudest two seconds after it was struck, which is a probe describing the
     * second note while claiming to describe the first.
     *
     * No filters either: this is about the voice itself, and the two the game
     * listens through would colour every answer.
     *
     * A dot is a hold and a dash is a rest, which is the opposite way round
     * from how it reads. Written with dashes, this probe was measuring a
     * single eighth note and its tail and calling it the decay of the voice.
     */
    player.renderTrack(ctx, gain, {
      name: wave,
      beatsPerMinute: 120,
      parts: [{ wave, gain: 0.5, sustain: 1, pattern: `C4 ${'.  '.repeat(15)}` }],
    }, 2.5, 0)
    const buffer = await ctx.startRendering()
    out.push({ wave, data: Array.from(buffer.getChannelData(0)) })
  }
  return { rate: RATE, out }
})
await browser.close()

const { rate, out } = rows

/** Energy above 1 kHz as a share of the whole, in a window. */
function bright(d, from, length) {
  const n = 2048
  const slice = d.slice(from, from + Math.min(length, n))
  if (slice.length < n) return 0
  let hi = 0
  let all = 0
  // A plain DFT over a handful of bands is enough, and is its own check: a
  // library doing this out of sight is how a previous probe reported a
  // confident number about the wrong thing.
  for (let k = 1; k < n / 2; k++) {
    let re = 0
    let im = 0
    for (let i = 0; i < n; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
      re += slice[i] * w * Math.cos((-2 * Math.PI * k * i) / n)
      im += slice[i] * w * Math.sin((-2 * Math.PI * k * i) / n)
    }
    const mag = Math.hypot(re, im)
    all += mag
    if ((k * rate) / n > 1000) hi += mag
  }
  return all > 0 ? hi / all : 0
}

/*
 * Loudness as a curve, not as samples.
 *
 * Two of these voices are two oscillators a few cents apart — which is what a
 * piano is, three strings to a key, slightly out with each other — so the
 * waveform passes through silence once or twice a second where they cancel.
 * Reading "how long until it is a tenth as loud" off raw samples found the
 * first of those nulls and called it the decay, and reported every one of
 * these as dying in a third of a second. Taking the loudness in hundredths of
 * a second rather than sample by sample did not fix it: the two carriers
 * cancel completely for a tenth of a second at a time, so the nulls are still
 * there, just tidier.
 *
 * So the curve is the loudest hundredth in the last four fifths of a second —
 * longer than the slowest beat any of these can produce. What is left is the
 * decay, which is what was being asked about.
 */
const STEP = 0.01
const OVER = 80
function envelope(data) {
  const n = Math.round(rate * STEP)
  const loud = []
  for (let i = 0; i + n <= data.length; i += n) {
    let sum = 0
    for (let k = i; k < i + n; k++) sum += data[k] * data[k]
    loud.push(Math.sqrt(sum / n))
  }
  return { loud, held: loud.map((_, i) => Math.max(...loud.slice(i, i + OVER))) }
}

console.log('voice      peak at   down to 1/10   top above 1kHz: struck -> +0.25s')
for (const { wave, data } of out) {
  // Two curves, because they answer different questions. How quickly it
  // arrives has to be read before the smoothing, which by design flattens the
  // first four fifths of a second into one number; how slowly it leaves has to
  // be read after it, or the beating answers instead.
  const { loud, held } = envelope(data)
  let rose = 0
  for (let i = 0; i < Math.min(loud.length, OVER); i++) if (loud[i] > loud[rose]) rose = i
  let peakAt = 0
  for (let i = 0; i < held.length; i++) if (held[i] > held[peakAt]) peakAt = i
  const tenth = held[peakAt] / 10
  let fell = held.length
  for (let i = peakAt; i < held.length; i++) if (held[i] < tenth) { fell = i; break }
  peakAt = Math.round(rose * STEP * rate)
  fell = Math.round(fell * STEP * rate)
  const a = bright(data, peakAt, 2048)
  const b = bright(data, peakAt + Math.round(rate * 0.25), 2048)
  console.log(
    `${wave.padEnd(9)} ${(peakAt / rate).toFixed(3)}s   ${(fell / rate).toFixed(2)}s`.padEnd(34) +
    `   ${(a * 100).toFixed(0)}% -> ${(b * 100).toFixed(0)}%`,
  )
  if (process.env.CURVE) {
    const every = Math.round(0.1 / STEP)
    console.log('           ' + held.filter((_, i) => i % every === 0).slice(0, 22).map((v) => v.toFixed(3)).join(' '))
  }
}

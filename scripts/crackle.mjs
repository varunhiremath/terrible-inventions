/**
 * What actually comes out of the speaker when a question opens.
 *
 * Reported twice now: "plenty of cracking and static noise when a question
 * pops, like in Dave". The first go at this measured the things that *could*
 * crackle — the music's own arithmetic, the aliasing in the voice renderer,
 * the Opus bitrate, the headroom on the clips — found a real fault in the last
 * of those, fixed it, and did not fix the noise. Which means it was never
 * measuring the thing that was wrong.
 *
 * So this measures the only thing that matters: the samples. It puts a tap
 * between the app's audio graph and the speaker by handing the app a recorder
 * where it asks for `destination`, plays a game until a question comes up, and
 * reports what went through.
 *
 * Three things give a crackle away in samples:
 *   clipped     anything at or past full scale, which is a buzz
 *   jumps       a step between neighbouring samples too big to be a waveform,
 *               which is a click — the loudest possible thing in one sample
 *   silence     gaps where the graph produced nothing, which is a dropout
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/crackle.mjs
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
})
/*
 * Where to listen. The default is the local preview of `dist`, which is the
 * same artifact the deploy builds from. Point SITE at the live URL to check
 * what the son's phone actually gets; the proxy in front of this container
 * re-signs HTTPS, so the certificate has to be let through for that to work.
 */
const SITE = process.env.SITE ?? 'http://127.0.0.1:4173/'
const page = await browser.newPage({ viewport: { width: 420, height: 880 }, ignoreHTTPSErrors: true })
page.on('pageerror', (e) => console.log('page error:', e.message))

await page.addInitScript(() => {
  // `destination` lives on BaseAudioContext, not on AudioContext — looking for
  // it on the wrong prototype is how the first run of this reported nothing at
  // all rather than failing.
  const where = BaseAudioContext.prototype
  const real = Object.getOwnPropertyDescriptor(where, 'destination').get
  window.__heard = { blocks: 0, peak: 0, clipped: 0, jumps: 0, worstJump: 0, quiet: 0, marks: [] }

  /*
   * How many voices are sounding, and how loud the master is set.
   *
   * The samples say what came out; these say why. A peak five times the rest
   * of the game is either a gain that moved or a great many notes landing
   * together, and the two want opposite fixes.
   */
  window.__live = 0
  window.__made = 0
  window.__started = 0
  window.__stopped = 0
  window.__ended = 0
  window.__never = 0
  const make = AudioContext.prototype.createOscillator
  AudioContext.prototype.createOscillator = function (...a) {
    const osc = make.apply(this, a)
    window.__made += 1
    if (window.__made % 17 === 0) {
      const where = (new Error().stack || '').split('\n').slice(1, 4).join(' | ')
      window.__from[where] = (window.__from[where] ?? 0) + 1
    }
    const start = osc.start.bind(osc)
    const stop = osc.stop.bind(osc)
    let told = false
    osc.addEventListener('ended', () => { window.__ended += 1; window.__live -= 1 })
    osc.start = (...s) => {
      window.__started += 1
      window.__live += 1
      if (window.__notes.length < 4000) window.__notes.push(Math.round(osc.frequency.value))
      return start(...s)
    }
    osc.stop = (...s) => { told = true; window.__stopped += 1; return stop(...s) }
    // A note that is started and never told when to end plays for ever.
    setTimeout(() => { if (!told) window.__never += 1 }, 4000)
    return osc
  }
  /*
   * How many schedulers are running, and what every note's frequency was.
   *
   * Seventy notes a second where the tune calls for five is either one
   * scheduler running fast or a dozen schedulers running normally, and those
   * want completely different fixes.
   */
  window.__timers = 0
  const every = window.setInterval
  window.setInterval = function (fn, ms, ...rest) {
    if (ms === 25) window.__timers += 1
    return every.call(window, fn, ms, ...rest)
  }
  const clear = window.clearInterval
  window.clearInterval = function (id) { if (id) window.__timers -= 1; return clear.call(window, id) }
  window.__notes = []
  /*
   * Where the notes are coming from.
   *
   * Reading `osc.frequency.value` to tell them apart was useless — a fresh
   * oscillator reads 440 Hz until something sets it, and `playNote` sets a
   * *scheduled* value rather than that one, so every note in the game came
   * back as A4. The stack says which function asked for it, which is the
   * question that actually needed answering.
   */
  window.__from = {}

  const gain = AudioContext.prototype.createGain
  AudioContext.prototype.createGain = function (...a) {
    const g = gain.apply(this, a)
    if (!window.__master) window.__master = g
    return g
  }
  window.__mark = (what) => window.__heard.marks.push({ what, at: window.__heard.blocks })

  Object.defineProperty(where, 'destination', {
    configurable: true,
    get() {
      if (!this.__tap) {
        const out = real.call(this)
        const tap = this.createScriptProcessor(2048, 2, 2)
        tap.onaudioprocess = (e) => {
          const h = window.__heard
          const left = e.inputBuffer.getChannelData(0)
          // Pass it through, or the page goes silent and the measurement is of
          // a game nobody can hear.
          e.outputBuffer.getChannelData(0).set(left)
          e.outputBuffer.getChannelData(1).set(e.inputBuffer.getChannelData(1))
          h.blocks += 1
          let loud = 0
          let last = left[0]
          let worstAt = -1
          for (let i = 0; i < left.length; i++) {
            const v = left[i]
            const a = Math.abs(v)
            if (a > h.peak) { h.peak = a; worstAt = i }
            if (a >= 0.999) h.clipped += 1
            if (a > loud) loud = a
            const step = Math.abs(v - last)
            if (step > 0.35) { h.jumps += 1; if (step > h.worstJump) h.worstJump = step }
            last = v
          }
          if (loud < 1e-5) h.quiet += 1
          // Keep the block the loudest thing so far was in, so the shape of it
          // can be looked at rather than guessed at from a number.
          if (worstAt >= 0) {
            h.worstBlock = [...left].map((v) => Math.round(v * 1000) / 1000)
            h.worstBlockAt = h.blocks
            h.liveThen = window.__live
            h.masterThen = window.__master ? window.__master.gain.value : -1
          }
          h.mostLive = Math.max(h.mostLive ?? 0, window.__live)
          h.loudest = Math.max(h.loudest ?? 0, loud)
        }
        tap.connect(out)
        this.__tap = tap
        window.__ctx = this
      }
      return this.__tap
    },
  })
})

const read = () => page.evaluate(() => ({
  ...window.__heard,
  made: window.__made,
  seconds: window.__ctx ? window.__ctx.currentTime : 0,
}))
const since = (was) => {
  const now = read()
  return now
}

await page.goto(SITE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
/*
 * Papa Panic rather than the caves. The report named the caves as an example —
 * the card is the same card in every game — and sitting still in the maze
 * brings a question up in half a minute, where walking right in the caves can
 * go a minute without finding anything to die on.
 */
await page.getByRole('button', { name: /Papa Panic/i }).first().click()
await page.waitForTimeout(700)
for (let i = 0; i < 3; i++) {
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500) }
}
await page.waitForTimeout(2500)

const playing = await read()
const rate = (a, b) => ((b.made - a.made) / Math.max(0.001, b.seconds - a.seconds)).toFixed(1)
const zero = { made: 0, seconds: 0 }
console.log(`while playing:  peak ${playing.peak.toFixed(3)}  clipped ${playing.clipped}  ` +
            `jumps ${playing.jumps}  notes/sec ${rate(zero, playing)}`)

// Sit still until something catches him, and wait for the question.
const offer = page.getByRole('button', { name: /^Answer it for/ })
let came = false
for (let n = 0; n < 90 && !came; n++) {
  await page.waitForTimeout(1000)
  came = (await offer.count()) > 0
}
if (!came) {
  console.log('PROBLEM: never got a question')
  await browser.close()
  process.exit(1)
}

const atQuestion = await read()
const d = (a, b, k) => b[k] - a[k]
console.log(`dying + the card: notes/sec ${rate(playing, atQuestion)}  peak ${atQuestion.peak.toFixed(3)}  ` +
            `clipped +${d(playing, atQuestion, 'clipped')}  ` +
            `jumps +${d(playing, atQuestion, 'jumps')} (worst ${atQuestion.worstJump.toFixed(2)})  ` +
            `blocks +${d(playing, atQuestion, 'blocks')}`)

// And then sit on the card, where the thinking tune is the only thing playing.
const before = await read()
await page.waitForTimeout(6000)
const sitting = await read()
console.log(`sitting on it:  notes/sec ${rate(before, sitting)}  peak ${sitting.peak.toFixed(3)}  ` +
            `clipped +${d(before, sitting, 'clipped')}  ` +
            `jumps +${d(before, sitting, 'jumps')}  ` +
            `silent blocks +${d(before, sitting, 'quiet')} of ${d(before, sitting, 'blocks')}`)

// The shape of the loudest moment, so it can be recognised rather than guessed
// at: a clipped waveform has a flat top, a click is one sample out of place.
const shape = sitting.worstBlock ?? []
const peakAt = shape.reduce((best, v, i) => (Math.abs(v) > Math.abs(shape[best]) ? i : best), 0)
console.log(`at the loudest: ${sitting.liveThen} oscillators live, master gain ` +
            `${Number(sitting.masterThen).toFixed(3)} (most live all run: ${sitting.mostLive})`)
const tally = await page.evaluate(() => ({
  made: window.__made, started: window.__started, stopped: window.__stopped,
  ended: window.__ended, never: window.__never, live: window.__live,
  timers: window.__timers,
  from: Object.entries(window.__from).sort((a, b) => b[1] - a[1]).slice(0, 4),
}))
console.log(`schedulers running: ${tally.timers}`)
for (const [where, n] of tally.from) console.log(`  x${n}  ${where}`)
console.log(`oscillators: made ${tally.made}, started ${tally.started}, told to stop ` +
            `${tally.stopped}, actually ended ${tally.ended}, never told ${tally.never}, ` +
            `still live ${tally.live}`)
console.log(`the loudest block (${sitting.worstBlockAt}), around sample ${peakAt}:`)
console.log('  ' + shape.slice(Math.max(0, peakAt - 24), peakAt + 24).join(' '))

await browser.close()

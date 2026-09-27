/**
 * Is the music actually less harsh, or does it only look it in the diff?
 *
 * "High pitched and not soothing" is a statement about energy in a particular
 * band, and that can be measured. This renders the old voicing and the new one
 * through a real Web Audio graph — offline, so it takes no time — and compares
 * how much of each lands above 3 kHz, which is the band where bright turns
 * into piercing and the one the ear is least able to tune out.
 *
 * It is not a judgement of whether the tune is any good. Nothing can do that
 * but a person listening to it.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })

/** Whatever the player is currently set to, read out of the source. */
const VOLUME = Number(
  /let volume = ([\d.]+)/.exec(readFileSync('src/music/player.ts', 'utf8'))?.[1] ?? NaN,
)
if (!Number.isFinite(VOLUME)) throw new Error('could not find the master volume')

const score = readFileSync('src/music/score.ts', 'utf8')
const LEAD = Number(
  /wave: 'triangle',\s*\n\s*gain: ([\d.]+),[\s\S]{0,160}?pattern: CHASE_LEAD/.exec(score)?.[1] ?? NaN,
)
if (!Number.isFinite(LEAD)) throw new Error('could not find the chase lead gain')
console.log(`master volume: ${VOLUME}, chase lead gain: ${LEAD}`)

const result = await page.evaluate(async ([VOLUME, LEAD]) => {
  const RATE = 44100
  const SECONDS = 2

  /** The pulse wave the player builds, so the comparison uses the real thing. */
  function pulseWave(ctx, duty) {
    const n = 32
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty)
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  }

  /** Eight notes of a melody in one voicing, with or without the softener. */
  async function render({ wave, duty, gain, notes, filtered }) {
    const ctx = new OfflineAudioContext(1, RATE * SECONDS, RATE)
    let out = ctx.destination
    if (filtered) {
      const harsh = ctx.createBiquadFilter()
      harsh.type = 'peaking'
      harsh.frequency.value = 3100
      harsh.Q.value = 1.1
      harsh.gain.value = -6.5
      const low = ctx.createBiquadFilter()
      low.type = 'lowpass'
      low.frequency.value = 6000
      low.Q.value = 0.6
      harsh.connect(low)
      low.connect(ctx.destination)
      out = harsh
    }
    notes.forEach((hz, i) => {
      const osc = ctx.createOscillator()
      if (wave === 'pulse') osc.setPeriodicWave(pulseWave(ctx, duty))
      else osc.type = wave
      osc.frequency.value = hz
      const env = ctx.createGain()
      const at = (i * SECONDS) / notes.length
      const len = SECONDS / notes.length
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(gain, at + 0.018)
      env.gain.setValueAtTime(gain, at + len - 0.06)
      env.gain.linearRampToValueAtTime(0, at + len)
      osc.connect(env)
      env.connect(out)
      osc.start(at)
      osc.stop(at + len)
    })
    const buffer = await ctx.startRendering()
    return buffer.getChannelData(0)
  }

  /**
   * Share of the energy above a given frequency.
   *
   * A plain DFT over a handful of windows. The first version of this sampled
   * every eighth input sample to make the sums cheaper, which is decimation
   * without a filter in front of it — so everything above a fifth of the rate
   * folded back down into the bins being measured and a pure triangle wave
   * came out as seventy per cent high-frequency energy. It measured its own
   * aliasing. Full rate now, with a smaller window to pay for it.
   */
  function above(samples, hz) {
    const N = 1024
    const step = Math.floor((samples.length - N) / 12)
    let high = 0
    let all = 0
    for (let o = 0; o + N <= samples.length; o += step) {
      // A Hann window, or the edges of each block ring across every bin.
      const win = new Float32Array(N)
      for (let n = 0; n < N; n++) {
        win[n] = samples[o + n] * 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
      }
      for (let k = 1; k < N / 2; k++) {
        const f = (k * RATE) / N
        if (f > 14000) break
        let re = 0
        let im = 0
        for (let n = 0; n < N; n++) {
          const a = (-2 * Math.PI * k * n) / N
          re += win[n] * Math.cos(a)
          im += win[n] * Math.sin(a)
        }
        const power = re * re + im * im
        all += power
        if (f >= hz) high += power
      }
    }
    return all > 0 ? high / all : 0
  }

  // The old chase lead: quarter-duty pulse, A minor, up to A5, straight out.
  const OLD = [440, 523.25, 659.25, 523.25, 880, 659.25, 523.25, 440]
  // The new one: triangle, C major, topping out at E5, through the softener.
  const NEW = [523.25, 659.25, 523.25, 392, 659.25, 587.33, 523.25, 392]

  const before = await render({ wave: 'pulse', duty: 0.25, gain: 0.15, notes: OLD, filtered: false })
  const after = await render({ wave: 'triangle', gain: LEAD, notes: NEW, filtered: true })

  /**
   * How loud it actually sounds, rather than how big the numbers are.
   *
   * Plain RMS is the wrong yardstick for this comparison and says so loudly:
   * by RMS the new voicing is twice the old one, and by ear it is softer. The
   * reason is that the ear is about ten decibels more sensitive at three
   * kilohertz than at five hundred, and the old lead put its energy in the
   * first place while the new one puts it in the second. A-weighting is the
   * standard curve for exactly this, so it is what decides the volume.
   */
  function weighted(samples) {
    const N = 1024
    const step = Math.floor((samples.length - N) / 12)
    let total = 0
    let windows = 0
    for (let o = 0; o + N <= samples.length; o += step) {
      const win = new Float32Array(N)
      for (let n = 0; n < N; n++) {
        win[n] = samples[o + n] * 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
      }
      for (let k = 1; k < N / 2; k++) {
        const f = (k * RATE) / N
        if (f > 16000) break
        let re = 0
        let im = 0
        for (let n = 0; n < N; n++) {
          const a = (-2 * Math.PI * k * n) / N
          re += win[n] * Math.cos(a)
          im += win[n] * Math.sin(a)
        }
        const f2 = f * f
        const ra =
          (12194 ** 2 * f2 * f2) /
          ((f2 + 20.6 ** 2) *
            Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) *
            (f2 + 12194 ** 2))
        const gain = ra * 1.2589  // +2.00 dB, the curve's own offset
        total += (re * re + im * im) * gain * gain
      }
      windows += 1
    }
    return Math.sqrt(total / Math.max(1, windows)) / N
  }
  return {
    beforeHigh: above(before, 3000),
    afterHigh: above(after, 3000),
    // Scaled by the master volume of each era, which is the number that
    // actually reaches the speaker.
    beforeLoud: weighted(before) * 0.55,
    afterLoud: weighted(after) * VOLUME,
  }
}, [VOLUME, LEAD])

await browser.close()

const pct = (x) => `${(x * 100).toFixed(1)}%`
console.log(`energy above 3 kHz — before: ${pct(result.beforeHigh)}   after: ${pct(result.afterHigh)}`)
console.log(
  `loudness as the ear hears it — before: ${result.beforeLoud.toFixed(4)}` +
  `   after: ${result.afterLoud.toFixed(4)}` +
  `   (${((result.afterLoud / result.beforeLoud - 1) * 100).toFixed(0)}%)`,
)

const problems = []
if (result.afterHigh >= result.beforeHigh * 0.5) {
  problems.push(`the harsh band is still ${pct(result.afterHigh)} of the signal`)
}
// He asked for quieter, so it has to actually be quieter.
if (result.afterLoud > result.beforeLoud) {
  problems.push(`it got louder: ${result.afterLoud.toFixed(4)} against ${result.beforeLoud.toFixed(4)}`)
}
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length
  ? 'MUSIC FAILED'
  : `music clean: the harsh band is ${(result.beforeHigh / Math.max(result.afterHigh, 1e-9)).toFixed(0)}x smaller than it was`)
process.exit(problems.length ? 1 : 0)

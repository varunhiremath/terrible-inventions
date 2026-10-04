/**
 * Every tune and every cue in the app, measured the same way.
 *
 * Three numbers each: how loud (rms), how loud at its loudest (peak), and how
 * much of it lands above 3 kHz — the band where bright turns into piercing,
 * and the one this project has already had to go back and fix twice because
 * "it sounds a bit shrill" is not something a diff can show you.
 *
 * The point is not the absolute figures, which depend on the speaker. It is
 * that a new noise can be put next to forty shipped ones and seen to be in
 * family or not, before anybody has to listen to it.
 *
 *     node scripts/noise-check.mjs            everything
 *     node scripts/noise-check.mjs flood      just the ones matching 'flood'
 */
import { chromium } from 'playwright'

const ONLY = process.argv[2]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })

const rows = await page.evaluate(async () => {
  const score = await import('/src/music/score.ts')
  const player = await import('/src/music/player.ts')
  const RATE = 44100

  /** Share of the energy above a frequency, by a plain Goertzel sweep. */
  function above(data, hz) {
    // A coarse band split is enough: sum the squared difference of neighbouring
    // samples (a crude high pass) against the total. Monotonic in brightness,
    // which is all that is being compared.
    let total = 0
    let high = 0
    for (let i = 1; i < data.length; i++) {
      total += data[i] * data[i]
      const d = data[i] - data[i - 1]
      high += d * d
    }
    // The difference of a sine at f has gain 2·sin(pi·f/rate); solve for the
    // frequency this is being asked about so the figure means something.
    const gain = 2 * Math.sin((Math.PI * hz) / RATE)
    return total > 0 ? Math.min(1, high / (total * gain * gain)) : 0
  }

  const measure = async (track, seconds, warmth) => {
    const ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE)
    const harsh = ctx.createBiquadFilter()
    harsh.type = 'peaking'
    harsh.frequency.value = 3100
    harsh.Q.value = 1.1
    harsh.gain.value = -6.5
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 6000
    low.Q.value = 0.6
    const master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(harsh)
    harsh.connect(low)
    low.connect(ctx.destination)
    player.renderTrack(ctx, master, track, seconds, warmth)
    const data = (await ctx.startRendering()).getChannelData(0)
    let sum = 0
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
      const v = Math.abs(data[i])
      if (v > peak) peak = v
    }
    return { rms: Math.sqrt(sum / data.length), peak, high: above(data, 3000) }
  }

  const out = []
  for (const [name, track] of Object.entries(score.TRACKS)) {
    out.push({ kind: 'tune', name, ...(await measure(track, 16, 1)) })
  }
  for (const [name, track] of Object.entries(score.CUES)) {
    out.push({ kind: 'cue', name, ...(await measure(track, 2.5, 0)) })
  }
  return out
})

await browser.close()

const shown = ONLY ? rows.filter((r) => r.name.toLowerCase().includes(ONLY.toLowerCase())) : rows
const mid = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

for (const kind of ['tune', 'cue']) {
  const all = rows.filter((r) => r.kind === kind)
  const here = shown.filter((r) => r.kind === kind)
  if (here.length === 0) continue
  console.log(`\n${kind}s — typical rms ${mid(all.map((r) => r.rms)).toFixed(3)}, ` +
    `peak ${mid(all.map((r) => r.peak)).toFixed(3)}, ` +
    `above 3 kHz ${(mid(all.map((r) => r.high)) * 100).toFixed(0)}%`)
  console.log('name              rms    peak   >3kHz')
  for (const r of here.sort((a, b) => b.high - a.high)) {
    const loud = r.rms > mid(all.map((x) => x.rms)) * 1.6 ? ' LOUD' : ''
    const bright = r.high > mid(all.map((x) => x.high)) * 1.8 ? ' BRIGHT' : ''
    console.log(
      `${r.name.padEnd(16)} ${r.rms.toFixed(3)}  ${r.peak.toFixed(3)}  ` +
      `${(r.high * 100).toFixed(0).padStart(4)}%${loud}${bright}`,
    )
  }
}

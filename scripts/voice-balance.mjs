/**
 * How loud each voice of a tune actually is, one at a time.
 *
 * Written because the flood's two heat voices — the drip and the bell, the two
 * that are supposed to say "hurry up" — moved the whole tune's loudness by
 * four per cent when they came in, which is to say they were not audible. A
 * gain figure in the score says nothing about that on its own: a part playing
 * two notes a bar at 0.035 and a part playing eight at 0.085 are not in the
 * ratio their gains suggest.
 *
 *     node scripts/voice-balance.mjs flood 1
 */
import { chromium } from 'playwright'

const WHICH = process.argv[2] ?? 'flood'
const WARMTH = Number(process.argv[3] ?? 1)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })

const rows = await page.evaluate(async ([which, warmth]) => {
  const score = await import('/src/music/score.ts')
  const player = await import('/src/music/player.ts')
  const track = score.TRACKS[which] ?? score.CUES[which]
  if (!track) return { error: `no track called ${which}` }

  const RATE = 44100
  const SECONDS = 24

  const measure = async (parts) => {
    const ctx = new OfflineAudioContext(1, RATE * SECONDS, RATE)
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
    player.renderTrack(ctx, master, { ...track, parts, drums: parts === track.parts ? track.drums : undefined }, SECONDS, warmth)
    const buffer = await ctx.startRendering()
    const data = buffer.getChannelData(0)
    let sum = 0
    let peak = 0
    // Only where something is playing, so a sparse part is not scored down
    // for the silence between its notes.
    let loud = 0
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i])
      sum += data[i] * data[i]
      if (v > peak) peak = v
      if (v > 0.01) loud += 1
    }
    return {
      rms: Math.sqrt(sum / data.length),
      busy: Math.sqrt(sum / Math.max(1, loud)),
      peak,
      share: loud / data.length,
    }
  }

  const out = []
  out.push({ name: 'all', ...(await measure(track.parts)) })
  for (const part of track.parts) {
    out.push({ name: `${part.wave}${part.from ? ` (from ${part.from})` : ''}`, ...(await measure([part])) })
  }
  return out
}, [WHICH, WARMTH])

await browser.close()
if (rows.error) { console.log(rows.error); process.exit(1) }

console.log(`${WHICH} at heat ${WARMTH}`)
console.log('voice                 rms    when playing   peak   sounding')
for (const r of rows) {
  console.log(
    `${r.name.padEnd(20)} ${r.rms.toFixed(4)}  ${r.busy.toFixed(4)}        ` +
    `${r.peak.toFixed(3)}  ${(r.share * 100).toFixed(0)}%`,
  )
}

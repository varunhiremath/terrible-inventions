/**
 * Render a tune to a file, so somebody can hear it.
 *
 * Everything else about this music can be measured — how much of it is above
 * three kilohertz, how far the tempo moves, where the gaps fall — and none of
 * that answers "is it any good". This does not answer it either, but it puts
 * the question to somebody who can.
 *
 * It builds the same graph the player builds, in an OfflineAudioContext, so
 * what comes out is what comes out of the game rather than an approximation
 * of it — the same pulse wave, the same filters, the same envelopes.
 *
 *     node scripts/render-music.mjs chase 34
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const WHICH = process.argv[2] ?? 'chase'
const SECONDS = Number(process.argv[3] ?? 30)
/** Heat, 0 to 1: the voices a game brings in as a run goes badly. */
const WARMTH = Number(process.argv[4] ?? 0)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
// The dev server, because this needs the score as modules rather than as a
// minified bundle with the names gone.
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })

const samples = await page.evaluate(async ([which, seconds, warmth]) => {
  const score = await import('/src/music/score.ts')
  const player = await import('/src/music/player.ts')
  const extra = await import('/src/music/candidates.ts')
  const track = score.TRACKS[which] ?? score.CUES[which] ?? extra.CANDIDATES[which]
  if (!track) return { error: `no track called ${which}` }

  const RATE = 44100
  const ctx = new OfflineAudioContext(1, RATE * seconds, RATE)

  // The same two filters the player puts between the music and the speaker.
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
  // Louder than the game plays it, because this is being listened to on
  // purpose rather than under a game.
  master.gain.value = 0.8
  master.connect(harsh)
  harsh.connect(low)
  low.connect(ctx.destination)

  /*
   * The game's own synthesiser, not a copy of it.
   *
   * This script used to carry its own `note()` — the same envelopes, the same
   * pulse waves, written out twice — under a comment admitting it had to be
   * kept in step by hand. It would have been wrong the day the piano arrived:
   * four instruments the copy had never heard of, rendered as bare
   * oscillators, in a file put in front of somebody to choose by.
   */
  player.renderTrack(ctx, master, track, seconds, warmth)

  const buffer = await ctx.startRendering()
  return {
    rate: RATE,
    data: Array.from(buffer.getChannelData(0)),
    bars: score.loopLength(track),
    step: score.eighthSeconds(track, warmth, 0),
  }
}, [WHICH, SECONDS, WARMTH])

await browser.close()

if (samples.error) {
  console.log(samples.error)
  process.exit(1)
}

/** A plain 16-bit WAV, which is the least code that anything will play. */
function wav(data, rate) {
  const n = data.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-1, Math.min(1, data[i])) * 32767, 44 + i * 2)
  }
  return buf
}

const out = process.env.MUSIC_OUT ?? `/tmp/${WHICH}.wav`
writeFileSync(out, wav(samples.data, samples.rate))

/*
 * How loud it came out, every time, because one tune being twice as loud as
 * the next is not a thing anybody hears while listening to it on its own.
 *
 * The four oscillator tunes land between 0.09 and 0.13 and peak around 0.36.
 * The first pass of the piano one measured 0.20 and 0.90 — switch games and
 * the volume would have jumped — and nothing about writing it suggested that,
 * because a struck note rings past its written length and the next one starts
 * on top of it.
 */
const peak = samples.data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const rms = Math.sqrt(samples.data.reduce((s, v) => s + v * v, 0) / samples.data.length)
console.log(`   peak ${peak.toFixed(3)}  rms ${rms.toFixed(3)}   (the others: rms 0.09 to 0.13, peak about 0.36)`)
console.log(
  `${out}  ${SECONDS}s  ${samples.bars} eighths a loop, ` +
  `${(samples.bars * samples.step).toFixed(1)}s round`,
)

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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
// The dev server, because this needs the score as modules rather than as a
// minified bundle with the names gone.
await page.goto('http://127.0.0.1:5199/wipes.html', { waitUntil: 'networkidle' })

const samples = await page.evaluate(async ([which, seconds]) => {
  const score = await import('/src/music/score.ts')
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

  function pulseWave(duty) {
    const n = 32
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty)
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  }

  function note(voice, frequency, at, length, level) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    if (voice.wave === 'pulse') osc.setPeriodicWave(pulseWave(voice.duty ?? 0.25))
    else osc.type = voice.wave
    if (voice.arp && voice.arp.length > 1) {
      const rate = voice.arpRate ?? 18
      for (let i = 0; i < Math.max(1, Math.ceil(length * rate)); i++) {
        osc.frequency.setValueAtTime(
          frequency * Math.pow(2, voice.arp[i % voice.arp.length] / 12),
          at + i / rate,
        )
      }
    } else osc.frequency.setValueAtTime(frequency, at)
    const attack = 0.018
    const release = Math.min(0.09, length * 0.45)
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(level, at + attack)
    env.gain.setValueAtTime(level, Math.max(at + attack, at + length - release))
    env.gain.linearRampToValueAtTime(0, at + length)
    osc.connect(env)
    env.connect(master)
    osc.start(at)
    osc.stop(at + length + 0.02)
  }

  const step = score.eighthSeconds(track, 0, 0)
  const bars = score.loopLength(track)
  const parts = track.parts.map((p) => ({ part: p, notes: score.readPart(p.pattern) }))
  const drums = track.drums ? track.drums.trim().split(/\s+/) : []

  for (let eighth = 0; eighth * step < seconds; eighth++) {
    const beat = score.beatAt(track, eighth)
    if (beat < 0) continue
    const at = eighth * step
    // The same lean the player puts on the off-beats, and the drums below do
    // not get it — see the note in the player. This block is a copy of that
    // scheduler and has to be kept in step with it, or the thing being
    // listened to is not the thing that plays.
    const lean = score.swingShift(track, eighth, step)
    for (const { part, notes } of parts) {
      // Heat stays at nothing: this is the tune as it opens.
      if (part.from !== undefined) continue
      for (const n of notes) {
        if (n.at !== beat) continue
        note(
          part,
          n.frequency,
          at + lean,
          Math.max(0.03, n.length * step * (part.sustain ?? 0.9) - lean),
          part.gain,
        )
      }
    }
    if (drums[beat] === 'x') {
      const src = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, RATE * 0.06, RATE)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      src.buffer = buf
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 7000
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.09, at)
      env.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
      src.connect(hp)
      hp.connect(env)
      env.connect(master)
      src.start(at)
      src.stop(at + 0.06)
    }
  }

  const buffer = await ctx.startRendering()
  return { rate: RATE, data: Array.from(buffer.getChannelData(0)), bars, step }
}, [WHICH, SECONDS])

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
console.log(
  `${out}  ${SECONDS}s  ${samples.bars} eighths a loop, ` +
  `${(samples.bars * samples.step).toFixed(1)}s round`,
)

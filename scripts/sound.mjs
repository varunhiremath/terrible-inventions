/**
 * Does the game actually make a sound?
 *
 * Every other check in here can pass while the app is silent. A cue is looked
 * up by name, scheduled inside a try/catch so a refused audio context cannot
 * take the game down, and then nothing happens — no error, no sound, nothing
 * to notice. So this counts the notes the page really schedules, in the real
 * build, while a real game is played.
 *
 *   npm run build && npm run preview &
 *   node scripts/sound.mjs
 */
import { chromium } from 'playwright'
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const p = await b.newPage({ viewport: { width: 420, height: 860 } })

// Count every oscillator the page actually starts, tagged by frequency, before
// any app code runs. If a cue is wired but silent, this stays flat.
await p.addInitScript(() => {
  window.__notes = []
  const wrap = (Klass) => {
    if (!Klass) return
    const make = Klass.prototype.createOscillator
    Klass.prototype.createOscillator = function (...a) {
      const osc = make.apply(this, a)
      /*
       * Record the frequency where it is SET, not where the oscillator starts.
       * It is scheduled with setValueAtTime, so reading .value at start() gives
       * whatever the param happens to hold right then — which is the 440 it was
       * built with. Measuring that way reported zero of every cue while the
       * game was audibly making them.
       */
      const sched = osc.frequency.setValueAtTime.bind(osc.frequency)
      osc.frequency.setValueAtTime = (v, t) => {
        window.__notes.push(Math.round(v))
        return sched(v, t)
      }
      const start = osc.start
      osc.start = function (...b) {
        window.__notes.push(Math.round(osc.frequency.value))
        return start.apply(this, b)
      }
      return osc
    }
  }
  wrap(window.AudioContext); wrap(window.webkitAudioContext)
})

await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.getByRole('button', { name: /papa panic/i }).first().click()
await p.waitForTimeout(600)
const skip = p.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(800) }
await p.mouse.click(210, 400)            // a tap steers the runner
const before = await p.evaluate(() => window.__notes.length)
await p.waitForTimeout(6000)             // let him eat his way along a corridor
const notes = await p.evaluate(() => window.__notes.slice())
// The chomp is A5 then E5 — 880Hz and 659Hz — and nothing in the chase loop
// sits on that pair, so counting them counts dots eaten.
const chomps = notes.filter((n) => n === 880).length
console.log('maze: notes', before, '->', notes.length, '| A5 chomps:', chomps)

// And the caves.
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.evaluate(() => { window.__notes.length = 0 })
await p.getByRole('button', { name: /the caves/i }).first().click()
await p.waitForTimeout(600)
const s2 = p.getByRole('button', { name: /skip/i })
if (await s2.count()) { await s2.first().click(); await p.waitForTimeout(800) }
const mid = await p.evaluate(() => window.__notes.length)
// Walk right into the diamonds on the opening floor.
await p.keyboard.down('ArrowRight')
await p.waitForTimeout(4000)
await p.keyboard.up('ArrowRight')
const cave = await p.evaluate(() => window.__notes.slice())
// A gem is D5 then A5 — 587Hz and 880Hz.
console.log('caves: notes', mid, '->', cave.length, '| D5 gems:', cave.filter((n) => n === 587).length)
// And space: the laser, which is the one cue in the app that fires several
// times a second and therefore the one most likely to be heard as a fault if
// it is wrong.
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.evaluate(() => { window.__notes.length = 0 })
await p.getByRole('button', { name: /the long way out/i }).first().click()
await p.waitForTimeout(600)
const s3 = p.getByRole('button', { name: /skip/i })
if (await s3.count()) { await s3.first().click(); await p.waitForTimeout(800) }
const sky = await p.evaluate(() => window.__notes.length)
await p.keyboard.down(' ')
await p.waitForTimeout(4000)
await p.keyboard.up(' ')
const space = await p.evaluate(() => window.__notes.slice())
// The laser is B5 then E5 — 988Hz and 659Hz. Four seconds of holding the
// trigger at one shot every 0.26s is about fifteen of them.
console.log('space: notes', sky, '->', space.length, '| B5 lasers:', space.filter((n) => n === 988).length)


/*
 * And the pipes, which is the only game whose music is not made of
 * oscillators any more.
 *
 * That makes this the one check that would have caught the piano being
 * inaudible: a part naming an instrument with no patch behind it falls through
 * to the oscillator path and comes out as a bare sine, and a part whose
 * envelope never opens makes no sound at all while every test still passes.
 * The coin is C6 then E6 — 1047Hz and 1319Hz.
 */
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.evaluate(() => { window.__notes.length = 0 })
await p.getByRole('button', { name: /the pipes/i }).first().click()
await p.waitForTimeout(600)
const s4 = p.getByRole('button', { name: /skip/i })
if (await s4.count()) { await s4.first().click(); await p.waitForTimeout(800) }
const under = await p.evaluate(() => window.__notes.length)
await p.keyboard.down('ArrowRight')
await p.waitForTimeout(5000)
await p.keyboard.up('ArrowRight')
const pipes = await p.evaluate(() => window.__notes.slice())
/*
 * The tune is C major and the melody sits in the fifth and sixth octaves, so
 * these are the notes it cannot be playing anything else with. Counted as a
 * set rather than a total: a total goes up if the piano is a sine, and the
 * point of this is whether the right notes are being played at all.
 */
const wanted = [262, 330, 392, 523, 659]
const heard = wanted.filter((n) => pipes.some((v) => Math.abs(v - n) <= 1))
console.log(
  'pipes: notes', under, '->', pipes.length,
  '| of C E G c e, heard', heard.length, 'of 5',
)

await b.close()

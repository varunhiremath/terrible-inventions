/**
 * Does the music actually play?
 *
 * Nothing in the unit tests can answer that: they read the score, and a score
 * that parses perfectly is exactly what silence looks like from in there. So
 * count the oscillators the page really creates, per game, in a real browser.
 * This is the check that once found the maze's chase tune running underneath
 * the dungeon, where the whole point was silence.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
const URL = 'http://127.0.0.1:4173/'

await page.addInitScript(() => {
  window.__osc = []
  const make = AudioContext.prototype.createOscillator
  AudioContext.prototype.createOscillator = function () {
    const osc = make.call(this)
    const entry = { pulse: false, steps: 0 }
    window.__osc.push(entry)

    // A pulse voice is the one thing that cannot be seen from the score alone
    // reaching the speaker: it is set on the oscillator, not chosen by name.
    const setWave = osc.setPeriodicWave.bind(osc)
    osc.setPeriodicWave = (...args) => {
      entry.pulse = true
      return setWave(...args)
    }
    // And an arpeggio is several pitch changes booked inside one note.
    const setAt = osc.frequency.setValueAtTime.bind(osc.frequency)
    osc.frequency.setValueAtTime = (...args) => {
      entry.steps += 1
      return setAt(...args)
    }

    const start = osc.start.bind(osc)
    osc.start = (...args) => {
      entry.hz = Math.round(osc.frequency.value)
      return start(...args)
    }
    return osc
  }
})

const count = () => page.evaluate(() => window.__osc.length)
const voices = () =>
  page.evaluate(() => ({
    pulse: window.__osc.filter((o) => o.pulse).length,
    arped: window.__osc.filter((o) => o.steps > 2).length,
  }))
const reset = () => page.evaluate(() => { window.__osc = [] })

const enter = async (name) => {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  // Pressing the tile is itself the gesture that lets audio start, which is
  // exactly how a player gets there.
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click()
  await page.waitForTimeout(500)
  const skip = page.getByRole('button', { name: 'Skip' })
  if (await skip.count()) {
    await skip.first().click()
    await page.waitForTimeout(600)
  }
}

for (const game of ['Papa Panic', 'Dangerous Dave', 'The Dungeon', 'The Pipes']) {
  await enter(game)
  await reset()
  await page.waitForTimeout(5000)
  const heard = await voices()
  console.log(
    `${game.padEnd(16)} ${String(await count()).padStart(4)} notes in 5s idle` +
      `  ${String(heard.pulse).padStart(4)} on a pulse wave` +
      `  ${String(heard.arped).padStart(3)} arpeggiated`,
  )
}

// And the pipes have to answer what he does, not just play underneath him.
// Measured against an idle window of the same length, because the tune is
// running the whole time and a cue is only the difference between the two.
await enter('The Pipes')
await page.waitForTimeout(1200)
await reset()
await page.waitForTimeout(3000)
const idle = await count()

await reset()
for (let i = 0; i < 6; i++) {
  await page.keyboard.down('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowRight')
}
const busy = await count()
console.log(`pipes: ${idle} notes in 3s standing still, ${busy} in 3s running and jumping`)
console.log(busy > idle ? 'the game answers him' : 'NOTHING ANSWERS HIM — the cues are not firing')

await browser.close()

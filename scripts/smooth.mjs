/**
 * Is the dungeon actually drawing between steps?
 *
 * It simulates at fifteen a second and used to draw at fifteen too, which on a
 * sixty-hertz screen is the same picture four times and then a jump.
 *
 * Counting frames does not settle it: this browser renders far too slowly
 * headless to show sixty of anything, so a frame count proves nothing either
 * way. What does settle it is comparing the drawn position against the
 * simulated one on the same frame. Locked together they are equal every time;
 * any frame where they differ is a frame drawn between two steps.
 *
 * Needs the DEV build, because that is where the two windows are exposed:
 *
 *   npx vite --port 5199 &
 *   node scripts/smooth.mjs
 */
import { chromium } from 'playwright'
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await b.newPage({ viewport: { width: 420, height: 860 } })
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.getByRole('button', { name: /the dungeon/i }).first().click()
await p.waitForTimeout(700)
const skip = p.getByRole('button', { name: /skip/i })
if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(1200) }

// Sample what actually reaches the canvas, once per animation frame.
await p.evaluate(() => {
  window.__samples = []
  const tick = () => {
    const d = window.dungeonDrawn
    const sim = window.dungeon
    // Both at once: if the drawing were locked to the simulation these would
    // be equal on every single frame. Any sample where they differ is a frame
    // drawn between two steps, which is the whole point and does not depend
    // on how fast this machine can render.
    if (d && sim) window.__samples.push({ drawn: d.col, sim: sim.col })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const room = await p.locator('canvas').boundingBox()
const r = Math.max(24, Math.min(54, Math.min(room.width, room.height) * 0.082))
const buttonY = room.y + room.height - r * 0.85 - r
await p.mouse.move(room.x + r * 4.1, buttonY)
await p.mouse.down()
await p.waitForTimeout(2500)
await p.mouse.up()

const out = await p.evaluate(() => {
  const s = window.__samples
  const between = s.filter((v) => Math.abs(v.drawn - v.sim) > 1e-9)
  return {
    frames: s.length,
    drawnBetweenSteps: between.length,
    biggestGap: s.reduce((m, v) => Math.max(m, Math.abs(v.drawn - v.sim)), 0),
  }
})
console.log(JSON.stringify(out))
// Simulation runs at 15/s. Over ~2.5s of walking that is ~38 distinct positions
// if the drawing is locked to it, and several times that if it is not.
await b.close()

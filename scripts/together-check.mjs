/**
 * Two devices, one race.
 *
 * Nothing about this can be unit-tested: the question is whether two browsers
 * talking through a relay end up looking at the same race, and the only way to
 * ask it is to open two of them. So: start the relay, open two pages, put one
 * in as host and one as guest with the same code, hold both pedals, and check
 * that the guest is seeing a race at all and that it is the host's race.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('/tmp/together', { recursive: true })
const problems = []

/*
 * The relay this run started, and no other.
 *
 * The first version let the spawn fail and carried on, and on the second run
 * it passed against the relay still listening from the first — which is a
 * probe reporting on a program it did not build. If the port is taken, that is
 * the answer, not a detail.
 */
const relay = spawn('node', ['server/relay.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '8899' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let listening = false
relay.stdout.on('data', (d) => {
  if (String(d).includes('listening')) listening = true
})
relay.stderr.on('data', (d) => console.log('relay:', String(d).trim().split('\n')[0]))
for (let i = 0; i < 40 && !listening; i++) await new Promise((r) => setTimeout(r, 100))
if (!listening) {
  console.log('TOGETHER FAILED: the relay would not start (is one already on port 8899?)')
  relay.kill()
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

/** Open the app, get past the intros, and stand on the road. */
async function onTheRoad(label) {
  // A context each, so the two pages do not share one save file.
  const context = await browser.newContext({ viewport: { width: 900, height: 500 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`${label}: page error ${e.message}`))
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  for (let i = 0; i < 3; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(450) }
  }
  await page.getByRole('button', { name: 'The Road' }).first().click()
  await page.waitForTimeout(800)
  for (let i = 0; i < 3; i++) {
    const s = page.getByRole('button', { name: 'Skip' })
    if (await s.count()) { await s.first().click(); await page.waitForTimeout(600) }
  }
  // Left open on purpose: the lobby is set up from inside it.
  return page
}

const host = await onTheRoad('host')
const guest = await onTheRoad('guest')

/** The lobby is set up from the garage, which opens by itself the first time. */
async function openLobby(page, label) {
  const setUp = page.getByRole('button', { name: 'Set up' })
  if (!(await setUp.count())) {
    problems.push(`${label}: no way into the lobby from the garage`)
    return
  }
  await setUp.first().click()
  await page.waitForTimeout(400)
}

await openLobby(host, 'host')
await openLobby(guest, 'guest')

// The relay address, typed once on each.
for (const page of [host, guest]) {
  const box = page.getByLabel('Relay address')
  if (await box.count()) {
    await box.first().fill('ws://127.0.0.1:8899')
    await page.waitForTimeout(200)
  }
}

await host.getByRole('button', { name: 'Start a race' }).first().click()
await host.waitForTimeout(900)
const code = (await host.locator('.font-mono.text-5xl').first().textContent() ?? '').trim()
console.log('code:', code)
if (!/^[A-Z0-9]{4}$/.test(code)) problems.push(`the host did not show a code (got "${code}")`)

await guest.getByLabel('Race code').first().fill(code)
await guest.getByRole('button', { name: 'Join' }).first().click()
await guest.waitForTimeout(2500)

await host.screenshot({ path: '/tmp/together/host.png' })
await guest.screenshot({ path: '/tmp/together/guest.png' })

const readOut = async (page) =>
  (await page.evaluate(() => document.querySelector('header')?.textContent ?? '')).replace(/\s+/g, ' ').trim()

// Both hold the pedal, and the clocks should agree.
await host.keyboard.down('ArrowUp')
await guest.keyboard.down('ArrowUp')
await host.waitForTimeout(4000)

const h = await readOut(host)
const g = await readOut(guest)
console.log('host: ', h)
console.log('guest:', g)

const clockOf = (text) => Number(/TIME ([\d.]+)/.exec(text)?.[1] ?? NaN)
const speedOf = (text) => Number(/SPEED (\d+)/.exec(text)?.[1] ?? NaN)

if (!Number.isFinite(clockOf(g))) problems.push('the guest is not showing a race clock')
else if (Math.abs(clockOf(h) - clockOf(g)) > 1.5) {
  problems.push(`the two clocks disagree: host ${clockOf(h)} vs guest ${clockOf(g)}`)
}
if (!(speedOf(g) > 0)) problems.push('the guest pressed the pedal and its car did not move')

await host.keyboard.up('ArrowUp')
await guest.keyboard.up('ArrowUp')
await host.screenshot({ path: '/tmp/together/host-racing.png' })
await guest.screenshot({ path: '/tmp/together/guest-racing.png' })

await browser.close()
relay.kill()

for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length
  ? `TOGETHER FAILED: ${problems.length} problem(s)`
  : 'together clean: two browsers, one relay, one race')
process.exit(problems.length ? 1 : 0)

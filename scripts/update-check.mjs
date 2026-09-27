/**
 * Does the app actually notice a new version?
 *
 * The failure this exists to catch is silent by construction: an installed web
 * app serves the copy it has, so a broken update path looks exactly like a
 * working one until somebody says "the thing you told me about isn't there".
 * You cannot see it in a screenshot and no unit test reaches it.
 *
 * So: open the app, wait for the service worker to take hold, publish a
 * different build underneath it, nudge the page the way returning to it would,
 * and see whether it offers the new version.
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 915, height: 412 } })
const problems = []

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
const active = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  return !!reg?.active
})
if (!active) problems.push('the service worker never became active')
else console.log('service worker: active')

/*
 * One reload, to get into the state a returning player is actually in.
 *
 * On the very first visit the worker installs and activates but does not
 * control the page that installed it, and an uncontrolled page has nothing to
 * refresh *from* — the browser simply swaps the worker. Every visit after the
 * first is controlled, and that is the case this probe is about.
 */
await page.reload({ waitUntil: 'networkidle' })
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
if (!controlled) problems.push('the page is still not controlled after a reload')
else console.log('page: controlled by the worker')

/*
 * A different build, published under the running app.
 *
 * It has to actually differ, or the asset hashes match, the precache manifest
 * is identical, and the app is right that there is nothing new — which would
 * make this probe pass by doing nothing at all. The first version of it tried
 * appending a comment to a source file and that is exactly what happened: the
 * minifier dropped the comment and sw.js came out byte for byte the same.
 * BUILD_ID is a string that survives into the bundle, which is half of why it
 * exists.
 */
execSync('npm run build', {
  cwd: process.cwd(),
  stdio: 'ignore',
  env: { ...process.env, BUILD_ID: `probe ${Date.now()}` },
})
console.log('published a second build')

// Returning to the app is what should trigger the check.
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await page.waitForTimeout(500)
await page.evaluate(() => window.dispatchEvent(new Event('focus')))

const state = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'no registration'
  await reg.update().catch((e) => `update threw: ${e}`)
  await new Promise((r) => setTimeout(r, 4000))
  return {
    installing: reg.installing?.state ?? null,
    waiting: reg.waiting?.state ?? null,
    active: reg.active?.state ?? null,
    controller: !!navigator.serviceWorker.controller,
    scriptURL: reg.active?.scriptURL ?? null,
  }
})
console.log('registration after update():', JSON.stringify(state))

const pill = page.getByRole('button', { name: /new version|updating/i })
try {
  await pill.first().waitFor({ state: 'visible', timeout: 20000 })
  console.log('the app offered the new version')
} catch {
  problems.push('a new build was published and the app never noticed')
}

// And it should take it by itself on the front screen.
try {
  await page.waitForFunction(
    () => !document.body.textContent?.includes('New version'),
    undefined,
    { timeout: 20000 },
  )
  console.log('and took it without being asked')
} catch {
  problems.push('the front screen did not take the update by itself')
}

await browser.close()
for (const p of problems) console.log(`PROBLEM: ${p}`)
console.log(problems.length ? `UPDATE FAILED: ${problems.length} problem(s)` : 'update clean: a new build is noticed and taken')
process.exit(problems.length ? 1 : 0)

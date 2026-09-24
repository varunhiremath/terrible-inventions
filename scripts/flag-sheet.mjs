/**
 * A contact sheet of every flag.
 *
 * The tests can check that a coordinate sits inside the flag and that a colour
 * is a colour. They cannot tell you the cross is on the wrong side or the star
 * is upside down, and that is most of what goes wrong when you draw something
 * out of numbers. So: draw them all at once, and look.
 *
 *   npx esbuild scripts/flag-entry.ts --bundle --format=iife --outfile=/tmp/flags.bundle.js
 *   node scripts/flag-sheet.mjs
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Built by the real compiler rather than picked apart with regexes: stripping
// types by hand quietly broke on a multi-line union and drew nothing at all.
execSync(
  'npx esbuild scripts/flag-entry.ts --bundle --format=iife --outfile=/tmp/flags.bundle.js',
  { stdio: 'inherit' },
)
const bundle = readFileSync('/tmp/flags.bundle.js', 'utf8')

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

await page.setContent(`<body style="margin:0;background:#14161f;font:13px system-ui;color:#e8ebf5">
<div id="sheet" style="display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:16px"></div>
<script>${bundle}</script>
<script>
const sheet = document.getElementById('sheet')
for (const [, flag] of Object.entries(window.FLAGS)) {
  const cell = document.createElement('div')
  const c = document.createElement('canvas')
  c.width = 300; c.height = 200
  c.style.width = '100%'
  c.style.border = '1px solid #2c3145'
  window.drawFlag(c.getContext('2d'), flag, 0, 0, c.width, c.height)
  cell.appendChild(c)
  const label = document.createElement('div')
  label.textContent = flag.country
  label.style.marginTop = '5px'
  cell.appendChild(label)
  sheet.appendChild(cell)
}
</script></body>`)
await page.waitForTimeout(600)
console.log(`${await page.evaluate(() => document.getElementById('sheet').children.length)} flags drawn`)
await page.locator('#sheet').screenshot({ path: '/tmp/flags.png' })
await browser.close()

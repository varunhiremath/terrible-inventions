/**
 * Can the live app open a `ws://` relay at all?
 *
 * The relay the README tells you to run on a laptop speaks plain `ws://`, and
 * the app is served over `https://`. A browser is not supposed to allow that.
 * This asks the browser, with a control that proves the relay and this probe
 * both work: the same socket from an http:// page.
 */
import { chromium } from 'playwright'

const BROWSER = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const LAN = process.argv[2] ?? '127.0.0.1'

const browser = await chromium.launch({
  executablePath: BROWSER,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const tryDial = async (from, target) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  const said = []
  page.on('console', (m) => said.push(m.text()))
  try {
    await page.goto(from, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } catch (error) {
    await page.close()
    return { from, target, got: `page would not load: ${error.message.split('\n')[0]}` }
  }
  const got = await page.evaluate(
    (url) =>
      new Promise((done) => {
        let socket
        try {
          socket = new WebSocket(url)
        } catch (error) {
          done(`threw on open: ${error}`)
          return
        }
        const timer = setTimeout(() => done('nothing happened in 8s'), 8000)
        socket.onopen = () => { clearTimeout(timer); done('OPEN') }
        socket.onmessage = (e) => { clearTimeout(timer); done(`OPEN, first message ${e.data}`) }
        socket.onerror = () => { clearTimeout(timer); done('error event') }
        socket.onclose = (e) => { clearTimeout(timer); done(`closed ${e.code}`) }
      }),
    target,
  )
  await page.close()
  return { from, target, got, said: said.filter((line) => /mixed|insecure|websocket/i.test(line)) }
}

const runs = [
  // The control: an http:// page, which is allowed to open a ws:// socket.
  [`http://127.0.0.1:8787/`, `ws://127.0.0.1:8787/TEST`],
  // The real question, twice: the phone's own address and a wifi address.
  [`https://varunhiremath.com/terrible-inventions/`, `ws://127.0.0.1:8787/TEST`],
  [`https://varunhiremath.com/terrible-inventions/`, `ws://${LAN}:8787/TEST`],
]

for (const [from, target] of runs) {
  const result = await tryDial(from, target)
  console.log('---')
  console.log(`from   ${result.from}`)
  console.log(`dial   ${result.target}`)
  console.log(`got    ${result.got}`)
  for (const line of result.said ?? []) console.log(`says   ${line}`)
}

await browser.close()

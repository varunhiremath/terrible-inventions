/**
 * End-to-end check, in a real browser with real WebGL.
 *
 * The unit tests cover the maze, the chasers and the game loop. Only this
 * catches a game that will not render, a control that does nothing, or a score
 * leaking onto a screen that has no business showing one.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const EXECUTABLE = process.env.CHROMIUM_PATH

const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  // Headless has no GPU; without a software rasteriser the canvas stays blank.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })

/**
 * Gets past a game's intro, if one is playing.
 *
 * Every game now tells its story the first time you open it, which sits
 * between the menu and the game. Adding that broke every route in here at
 * once, which is exactly what this file is for.
 */
const skipIntro = async () => {
  const skip = page.getByRole('button', { name: 'Skip' })
  if ((await skip.count()) > 0) {
    await skip.first().click()
    await page.waitForTimeout(700)
  }
}


const problems = []
let questionText = ''
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()} :: ${m.location()?.url ?? ''}`)
})

// innerText, not textContent: the bar is a row of separate blocks, and
// textContent runs them together into "1up80high score80level1".
const hud = async () => (await page.innerText('header'))?.replace(/\s+/g, ' ').trim() ?? ''
/** The arcade bar reads "1UP <score> HIGH SCORE <best> LEVEL <n>". */
const scoreNow = async () => Number((await hud()).match(/1up (\d+)/i)?.[1] ?? -1)

/*
 * The front door.
 *
 * The app used to open straight into the maze, which quietly made that one
 * "the game" and left the other three as things you had to know were hidden
 * in the settings. It opens on a grid of four now, so every route in here
 * starts by picking one off it.
 */
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const GAMES = ['Papa Panic', 'Dangerous Dave', 'The Dungeon', 'The Pipes']
const homeText = await page.innerText('body')
for (const game of GAMES) {
  if (!new RegExp(game, 'i').test(homeText)) problems.push(`${game} is not on the front screen`)
}
if (/shop/i.test(homeText)) problems.push('the shop is still being offered')
if ((await page.locator('canvas').count()) !== GAMES.length) {
  problems.push('the four tiles are not each drawing their own emblem')
}

/** Opens a game from the front door, and gets past its story. */
const enter = async (name) => {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const button = page.getByRole('button', { name: new RegExp(name, 'i') })
  if ((await button.count()) === 0) {
    problems.push(`no way in to ${name} from the front screen`)
    return false
  }
  await button.first().click()
  await page.waitForTimeout(600)
  await skipIntro()
  return true
}

await enter('Papa Panic')

// The opening pause: nothing should have been eaten in the moment the maze
// appears. Read straight away — the pause is a couple of seconds, and waiting
// around to ask is the same as not asking.
if ((await scoreNow()) > 0) problems.push('play started before the ready pause finished')

await page.waitForTimeout(1500)

const canvas = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { w: c.width, gl: !!(c.getContext('webgl2') || c.getContext('webgl')) } : null
})
if (!canvas?.w || !canvas.gl) problems.push('the maze did not render')
if (!/level 1/i.test(await hud())) problems.push('did not open on level 1')

// Then it should run, and run at a sensible pace rather than in slow motion.
await page.waitForTimeout(4000)
const afterOpening = await scoreNow()
if (afterOpening <= 0) problems.push('nothing happened once the pause ended')

// There are no control buttons any more: the board itself is the control. A
// tap to one side of the player steers him that way, a drag steers as it goes.
// An earlier build worked only by swipe and arrow key and was unplayable
// because nothing said so, so the hint that replaced the pad is checked too.
if (!/tap where you want to go/i.test(await page.locator('body').innerText())) {
  problems.push('nothing on screen says the board can be touched')
}
if ((await page.locator('button[aria-label="up"]').count()) > 0) {
  problems.push('the d-pad is still on screen')
}

// Nothing to press while playing except the quiet settings gear. A button on
// the board is an invitation to stop playing, and the arcade puts none there.
// The one question you are ever asked comes between lives, where it costs
// nothing to stop and think.
const loud = await page
  .locator('header button, footer button')
  .filter({ hasNotText: /^\s*$/ })
  .evaluateAll((nodes) =>
    nodes
      .filter((n) => n.getAttribute('aria-label') !== 'Settings')
      .map((n) => n.textContent?.trim())
      .filter(Boolean),
  )
if (loud.length > 0) problems.push(`buttons on the board while playing: ${loud.join(', ')}`)
if ((await page.locator('button[aria-label="Settings"]').count()) !== 1) {
  problems.push('no way to reach settings')
}

// The lives left are shown, and shown as the player himself.
if ((await page.locator('[aria-label$="lives left"]').count()) !== 1) {
  problems.push('the lives are not on screen')
}

// Tapping: aim well away from the player on each side in turn. Wherever he is,
// at least some of these must be legal turns.
const board = await page.locator('canvas').boundingBox()
const beforeTaps = await scoreNow()
// Twice round the compass. Once is not enough to prove anything: a single
// turn can easily send him back down a corridor he has already cleared, and
// then the score sits still however well the tapping works.
for (let pass = 0; pass < 2; pass++) {
  for (const [fx, fy] of [
    [0.5, 0.05],
    [0.95, 0.5],
    [0.5, 0.95],
    [0.05, 0.5],
  ]) {
    await page.mouse.click(board.x + board.width * fx, board.y + board.height * fy)
    await page.waitForTimeout(700)
  }
}
if ((await scoreNow()) <= beforeTaps) problems.push('tapping the board did not move the player')

// Dragging: a drag has to steer too, and a vertical one especially, since
// that is the gesture a phone user reaches for first. All four directions get
// a turn, because any one of them may be a wall or an already-cleared corridor
// — the score is what proves he moved, and he has to be able to move at all.
const beforeDrag = await scoreNow()
for (const [dx, dy] of [[0, -300], [300, 0], [0, 300], [-300, 0]]) {
  const midX = board.x + board.width / 2
  const midY = board.y + board.height / 2
  await page.mouse.move(midX, midY)
  await page.mouse.down()
  await page.mouse.move(midX + dx, midY + dy, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(900)
}
if ((await scoreNow()) <= beforeDrag) problems.push('dragging did not move the player')

for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
  await page.keyboard.press(key)
  await page.waitForTimeout(900)
}
if ((await scoreNow()) <= afterOpening) problems.push('steering did not move the player')

/*
 * The question between lives.
 *
 * Stop steering and the machines close in, which is the one death in any of
 * the four games you can rely on happening on its own. Checked in a browser
 * rather than left to the unit tests because the whole point of the thing is
 * that it appears on the screen at the moment a life is lost, and that getting
 * past it puts you straight back into the game.
 */
const livesLeft = async () =>
  Number(
    ((await page.locator('[aria-label$="lives left"]').first().getAttribute('aria-label')) ?? '')
      .match(/(\d+) lives/)?.[1] ?? -1,
  )
let died = false
for (let i = 0; i < 60 && !died; i++) {
  await page.waitForTimeout(1000)
  died = (await livesLeft()) < 3
}

if (!died) {
  problems.push('never lost a life in the maze, so the question was never shown')
} else {
  questionText = await page.innerText('body')
  if (!/a quick one|something else/i.test(questionText)) {
    problems.push('losing a life did not bring up a question')
  }
  // Either shape of question can be got past without answering it. The skip is
  // there so that a bad moment is never a wall.
  const skipQuestion = page.getByRole('button', { name: /^skip$/i })
  if ((await skipQuestion.count()) === 0) {
    problems.push('the question cannot be got past')
  } else {
    await skipQuestion.first().click()
    await page.waitForTimeout(1500)
    const after = await page.innerText('body')
    if (/a quick one|something else/i.test(after)) problems.push('the question would not go away')
    if (!/level 1/i.test(await hud())) problems.push('the maze did not come back after the question')
  }
}

// --- Dangerous Dave: the board is the controller here too -----------------
// Reachable without having to lose a life first, which is how a grown-up
// setting the thing up will look for it.
if (await enter('Dangerous Dave')) {
  await page.waitForTimeout(1200)

  // textContent, not innerText: Dave's score bar is drawn into the picture and
  // the text copy of it is there for screen readers, out of sight. innerText
  // reads what is rendered, so it reads nothing at all.
  const daveHud = async () => (await page.textContent('header')).replace(/\s+/g, ' ').trim()
  const daveScore = async () => Number((await daveHud()).match(/score:?\s*(\d+)/i)?.[1] ?? -1)
  if (!/level:?\s*0*1\b/i.test(await daveHud())) problems.push('Dave did not open on level 1')
  if (!/daves:?\s*3\b/i.test(await daveHud())) problems.push('Dave did not start with three lives')

  /*
   * The buttons sit in a strip along the bottom: walking on the left, jumping
   * on the right. Worked out here the same way the game works them out, so
   * this keeps testing the buttons rather than two guessed spots on the glass.
   */
  const board = await page.locator('canvas').boundingBox()
  const radius = Math.max(26, Math.min(58, Math.min(board.width, board.height) * 0.085))
  const buttonY = board.y + board.height - radius * 0.85 - radius
  const at = {
    left: board.x + radius * 1.85,
    right: board.x + radius * 4.1,
    up: board.x + board.width - radius * 1.85,
  }
  if (!Number.isFinite(at.right) || at.right >= at.up) {
    problems.push('the walk and jump buttons are not where they should be')
  }

  const before = await daveScore()
  await page.mouse.move(at.right, buttonY)
  await page.mouse.down()
  await page.waitForTimeout(2500)
  await page.mouse.up()
  if ((await daveScore()) <= before) problems.push('the walk-right button did not move Dave')

  // And the jump button, which has to be reachable by a different thumb.
  await page.mouse.move(at.up, buttonY)
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  await page.waitForTimeout(600)

  const daveText = await page.innerText('body')
  if (/\d+\s*%/.test(daveText)) problems.push('a percentage is being shown in Dave')
}

// --- the dungeon: an hour on the clock, and it never goes back -------------
if (await enter('The Dungeon')) {
  await page.waitForTimeout(1500)

  const dungeonHud = async () => (await page.textContent('header')).replace(/\s+/g, ' ').trim()
  if (!/level 1\b/i.test(await dungeonHud())) problems.push('the dungeon did not open on level 1')
  if (!/minutes 60\b/i.test(await dungeonHud())) problems.push('the dungeon did not start with the full hour')

  // Walking: the buttons are laid out the same way Dave's are.
  const room = await page.locator('canvas').boundingBox()
  const r = Math.max(24, Math.min(54, Math.min(room.width, room.height) * 0.082))
  const buttonY = room.y + room.height - r * 0.85 - r
  await page.mouse.move(room.x + r * 4.1, buttonY)
  await page.mouse.down()
  await page.waitForTimeout(1800)
  await page.mouse.up()
  await page.waitForTimeout(400)

  // The clock is the whole game: it has to be running down.
  const minutes = Number((await dungeonHud()).match(/minutes (\d+)/i)?.[1] ?? -1)
  if (minutes < 0 || minutes > 60) problems.push(`the dungeon clock reads ${minutes}`)
}

// --- the pipes: momentum, a jump, and the flag at the far end --------------
if (await enter('The Pipes')) {
  await page.waitForTimeout(1400)

  const pipesHud = async () => (await page.textContent('header')).replace(/\s+/g, ' ').trim()
  if (!/level 1\b/i.test(await pipesHud())) problems.push('the pipes did not open on level 1')
  if (!/lives 3\b/i.test(await pipesHud())) problems.push('the pipes did not start with three lives')

  // Run right for a while. He has to actually get somewhere.
  await page.keyboard.down('ArrowRight')
  await page.keyboard.down('Shift')
  await page.waitForTimeout(2500)
  await page.keyboard.up('Shift')
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(400)

  const pipesText = await page.innerText('body')
  if (/\d+\s*%/.test(pipesText)) problems.push('a percentage is being shown in the pipes')
}

await browser.close()

// No screen may grow a score for being right at maths. The question between
// lives is the only place maths is ever put to him now, so it is the one that
// has to be clean.
if (/\d+\s*%/.test(questionText)) problems.push('a percentage is being shown')
if (/\b(accuracy)\b/i.test(questionText)) problems.push('scoring language is being shown')

if (problems.length) {
  console.error(`SMOKE FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('smoke test clean: picked from the front door, played the maze, answered the question between lives, ran Dave through the hideout, went down into the dungeon, and ran the pipes')

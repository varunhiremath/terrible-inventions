/**
 * The pictures.
 *
 * Each scene is a function of how far through its beat we are, so it can be
 * scrubbed, paused or replayed and always looks the same at the same moment.
 * Nothing here reads a clock of its own.
 *
 * They are the games. Not drawings of the games: the real level data, drawn by
 * the game's own drawing code, with a camera panning along it. The cutscene is
 * a lap of the first level, and the last thing it reaches is the thing the
 * level wants from you — the trophy, the exit, the flag.
 *
 * That is the whole design rule here, and it came from the only review that
 * matters: "I want the intro video to contain quick snapshots from the game
 * itself. A quick run through the levels and final objectives. Here the videos
 * look very different from the actual game." They were. Every scene below used
 * to be its own hand-drawn approximation, and an approximation of a game you
 * are about to play is worse than nothing — it teaches you to expect the wrong
 * thing.
 *
 * The one scene that is not a game is the workshop, and it is a silhouette. It
 * is nobody's portrait.
 */
import { drawPrince, drawRoom, FLOOR_DEPTH } from '../arcade/dungeon/draw'
import { isSolid as dungeonSolid, levelCols, ROOM_COLS, ROOM_ROWS } from '../arcade/dungeon/level'
import { levelFor as dungeonLevel } from '../arcade/dungeon/levels'
import { newPrince } from '../arcade/dungeon/prince'
import { boardFor, isWall, key as cellKey, neighbours, TILE as MAZE, type Board, type Cell } from '../arcade/maze/maze'
import { drawLevel as drawCave, EGA as DAVE_EGA, drawDave } from '../dave/draw'
import { isSolid as caveSolid, VIEW_TILES_X, VIEW_TILES_Y } from '../dave/level'
import { levelFor as caveLevel } from '../dave/levels'
import { newDave } from '../dave/physics'
import { drawBackdrop, drawEnemies, drawFlag, drawHero, drawItems, drawLevel as drawPipes, INK as PIPE_INK } from '../pipes/draw'
import { isSolid as pipeSolid, VIEW_ROWS, VIEW_TOP } from '../pipes/level'
import { levelFor as pipeLevel } from '../pipes/levels'
import { newBody } from '../pipes/physics'
import { newRun } from '../pipes/run'
import { drawMachine, drawRunner, MACHINE_INK } from '../render/silhouettes'

type Ctx = CanvasRenderingContext2D

export interface Stage {
  ctx: Ctx
  w: number
  h: number
  /** How far through this beat, 0 to 1. */
  t: number
  /** Seconds since the story began, for anything that should not restart. */
  clock: number
}

/** Eased, so nothing in a cutscene moves at a constant speed. */
const ease = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

/**
 * How far along the level we are by now, 0 to 1.
 *
 * Off the story clock rather than the beat, so the camera carries on through
 * a cut instead of snapping back to the start of the level every time the
 * narrator draws breath. A story is around half a minute; `over` is set a
 * little under that for each game so the pan lands on the objective while
 * there is still a line left to say about it.
 */
const sweep = (clock: number, over: number) => ease(clamp(clock / over, 0, 1))

function wash(ctx: Ctx, w: number, h: number, top: string, bottom: string): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, top)
  sky.addColorStop(1, bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
}

/**
 * The surface under a column, starting the search at `from` and going down.
 *
 * Every one of these levels is a room with a border, so searching from the top
 * finds the ceiling and stands whoever it is on the roof. Searching down from
 * where they start finds the floor they are actually on.
 *
 * Over a pit there is no answer, and the honest thing is to keep the last one:
 * a walker crossing a gap in a cutscene is mid-jump, not falling out of shot.
 */
export function floorUnder(
  rows: readonly string[],
  col: number,
  from: number,
  solid: (tile: string) => boolean,
): number | null {
  const x = Math.round(col)
  for (let y = Math.max(0, Math.floor(from)); y < rows.length; y++) {
    const line = rows[y]
    if (x < 0 || x >= line.length) return null
    if (solid(line[x])) return y
  }
  return null
}

/**
 * A walker's height over a level, smoothed between columns.
 *
 * Taking the floor under the nearest column alone makes them climb steps like
 * a lift. Blending the two columns they are between, and arcing over anything
 * with no floor at all, is a walk.
 */
function walkHeight(
  rows: readonly string[],
  col: number,
  from: number,
  solid: (tile: string) => boolean,
  fallback: number,
): number {
  const left = floorUnder(rows, Math.floor(col), from, solid)
  const right = floorUnder(rows, Math.floor(col) + 1, from, solid)
  if (left === null && right === null) return fallback
  if (left === null) return right!
  if (right === null) return left
  /*
   * The higher of the two, not a blend between them.
   *
   * Blending looks like a smooth walk up a slope right until the step is a
   * stack of blocks, and then he is drawn halfway inside it. Standing on
   * whichever surface is higher means he is always on top of something.
   */
  return Math.min(left, right)
}

/*
 * Levels are built once and kept. They are plain data and nothing here changes
 * them, and rebuilding a hundred-column level sixty times a second to draw one
 * frame of a cutscene is work for nothing.
 */
const CAVE = caveLevel(1)
const PIPE_RUN = newRun(pipeLevel(1), 1)
const DUNGEON = dungeonLevel(1)

/**
 * One step, ignoring the tunnel.
 *
 * Walking out of one side and back in the other is a legal move and it
 * teleports whoever does it clean across the frame, which reads as a glitch
 * rather than as a tunnel when there is no time to explain it.
 */
function stepsFrom(board: Board, cell: Cell): Cell[] {
  return neighbours(board, cell).filter(
    (n) => Math.abs(n.x - cell.x) <= 1 && Math.abs(n.y - cell.y) <= 1,
  )
}

/** The shortest way from `from` to the nearest cell that `wanted` accepts. */
function routeTo(board: Board, from: Cell, wanted: (cell: Cell) => boolean): Cell[] {
  const came = new Map<string, Cell | null>([[cellKey(from), null]])
  const queue: Cell[] = [from]

  while (queue.length > 0) {
    const at = queue.shift()!
    if (wanted(at) && cellKey(at) !== cellKey(from)) {
      const back: Cell[] = []
      let cursor: Cell | null = at
      while (cursor && cellKey(cursor) !== cellKey(from)) {
        back.unshift(cursor)
        cursor = came.get(cellKey(cursor)) ?? null
      }
      return back
    }
    for (const next of stepsFrom(board, at)) {
      if (came.has(cellKey(next))) continue
      came.set(cellKey(next), at)
      queue.push(next)
    }
  }
  return []
}

/**
 * A run round a board, worked out once: head for the nearest dot, eat it,
 * head for the next.
 *
 * The first version of this carried straight on and turned where it could not,
 * which is roughly how the board is played right up until it walks into a dead
 * end — and then it ping-ponged on the spot for the rest of the cutscene while
 * four Machines piled on top of it. Rendering the scene is the only thing that
 * showed that; every number involved was perfectly reasonable.
 */
const TOURS = new Map<string, Cell[]>()
function tourOf(board: Board): Cell[] {
  const cached = TOURS.get(board.name)
  if (cached) return cached

  const left = new Set<string>()
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const tile = board.rows[y][x]
      if (tile === MAZE.DOT || tile === MAZE.POWER) left.add(cellKey({ x, y }))
    }
  }

  const path: Cell[] = [board.playerStart]
  left.delete(cellKey(board.playerStart))

  while (left.size > 0 && path.length < 600) {
    const leg = routeTo(board, path[path.length - 1], (cell) => left.has(cellKey(cell)))
    if (leg.length === 0) break
    for (const cell of leg) {
      path.push(cell)
      left.delete(cellKey(cell))
    }
  }

  TOURS.set(board.name, path)
  return path
}

/** The way one Machine comes at you: the real shortest path down real corridors. */
const CHASES = new Map<string, Cell[]>()
function chaseOf(board: Board, start: Cell): Cell[] {
  const id = `${board.name}:${cellKey(start)}`
  const cached = CHASES.get(id)
  if (cached) return cached
  const route = [start, ...routeTo(board, start, (cell) => cellKey(cell) === cellKey(board.playerStart))]
  CHASES.set(id, route)
  return route
}

/**
 * The columns of the dungeon he can actually stand on, worked out once.
 *
 * Holes are left out rather than spanned. The version before this gave every
 * column an answer and arced him across whatever had no floor under it — and
 * since most of this level is hole, the result was a man bouncing through the
 * air for most of the pan, reported as exactly that. A column with nothing
 * under it is not a place he is. It is a place he jumps over, and a jump
 * belongs between two columns rather than across twelve.
 *
 * The search only ever looks down, because a dungeon is a thing you descend.
 */
export const DUNGEON_PATH: { col: number; row: number }[] = (() => {
  const steps: { col: number; row: number }[] = []
  let row = DUNGEON.start.row
  for (let col = 0; col < levelCols(DUNGEON); col++) {
    const found = floorUnder(DUNGEON.rows, col, row, dungeonSolid)
    if (found === null) continue
    row = found
    steps.push({ col, row })
  }
  return steps
})()

/**
 * How fast he goes through it, in columns a second.
 *
 * A man running in this game covers about two tiles a second, and the camera
 * has to agree with his legs or he moonwalks. The clock drove the animation
 * and a separate clock drove the camera before, which is why it came back as
 * running weirdly fast.
 */
const DUNGEON_PACE = 1.8

/** The four Machines, in the colours they are on the board. */
const MACHINES = ['#e8503a', '#f49ac1', '#5ad2e0', '#f0a04b']

/** Every scene any story can name. */
export const SCENES: Record<string, (stage: Stage) => void> = {
  /**
   * The maze: the real board, the real route, the real characters.
   *
   * Level one's board, drawn from the same rows the game plays on — which
   * means the corners in the cutscene are the corners you are about to turn.
   */
  maze({ ctx, w, h, clock }) {
    wash(ctx, w, h, '#05070c', '#0b1020')

    const board = boardFor(1)
    const s = Math.min(w / (board.width + 1), h / (board.height + 1))
    const ox = (w - board.width * s) / 2
    const oy = (h - board.height * s) / 2
    const at = (cell: Cell) => ({ x: ox + (cell.x + 0.5) * s, y: oy + (cell.y + 0.5) * s })

    // Walls, as the bars the board is built from.
    ctx.fillStyle = '#f24fd6'
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (!isWall(board, { x, y })) continue
        ctx.fillRect(ox + x * s + s * 0.12, oy + y * s + s * 0.12, s * 0.76, s * 0.76)
      }
    }

    const tour = tourOf(board)
    /** Where along a route something is by now, never off the end of it. */
    const alongOf = (route: Cell[], speed: number) =>
      Math.min(clock * speed, Math.max(0, route.length - 1.001))
    // Six cells a second: quick enough to cover ground in a beat, slow enough
    // to watch.
    const along = alongOf(tour, 6)
    const eaten = new Set(tour.slice(0, Math.floor(along) + 1).map(cellKey))

    // Dots, going out as the route passes over them.
    const pulse = 0.5 + Math.sin(clock * 6) * 0.5
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tile = board.rows[y][x]
        if (tile !== MAZE.DOT && tile !== MAZE.POWER) continue
        if (eaten.has(cellKey({ x, y }))) continue
        const p = at({ x, y })
        ctx.fillStyle = '#ffe9a8'
        ctx.beginPath()
        ctx.arc(p.x, p.y, tile === MAZE.POWER ? s * (0.24 + pulse * 0.06) : s * 0.09, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    /** Where something is between two cells of its route, and which way. */
    const rideOn = (route: Cell[], along: number) => {
      const i = Math.floor(along)
      const from = at(route[i])
      const to = at(route[Math.min(i + 1, route.length - 1)])
      const f = along - i
      return {
        x: lerp(from.x, to.x, f),
        y: lerp(from.y, to.y, f),
        // Canvas y runs down the screen; a heading is measured the other way up.
        heading: Math.atan2(-(to.y - from.y), to.x - from.x),
        dx: Math.sign(to.x - from.x),
        dy: Math.sign(to.y - from.y),
      }
    }

    const runner = rideOn(tour, along)

    // The Machines, coming down real corridors on the real shortest path. They
    // stop a few cells short: the intro is a chase, not a mauling.
    board.ghostStarts.forEach((start, n) => {
      const route = chaseOf(board, start)
      // Each stops a different distance out, or all four arrive on the same
      // cell and read as one Machine.
      const reach = Math.max(0, route.length - 3 - n * 3)
      const machine = rideOn(route, Math.min(clamp(clock - 1 - n * 0.4, 0, 99) * 2.4, reach))
      drawMachine(
        ctx, machine.x, machine.y, s * 0.46,
        machine.dx, machine.dy,
        (clock * 1.4 + n * 0.25) % 1,
        MACHINE_INK(MACHINES[n % MACHINES.length]),
      )
    })

    drawRunner(ctx, runner.x, runner.y, s * 0.46, runner.heading, clock * 4)
  },

  /**
   * Dave's caves: level one, drawn by the game, panned end to end.
   *
   * This used to be coloured rectangles on a brown background that matched
   * nothing — reported as "so weird and nothing like the game", which was
   * fair. Now it is `drawLevel` and `drawDave` off the real level, so the
   * bricks, the diamonds, the trophy and the man are the ones in the game
   * because they are literally the same code.
   */
  cave({ ctx, w, h, clock }) {
    ctx.fillStyle = DAVE_EGA.black
    ctx.fillRect(0, 0, w, h)

    // The screen's own rule, so the cutscene is framed like the game rather
    // than cropped into a close-up of three bricks.
    const size = Math.min(w / VIEW_TILES_X, h / VIEW_TILES_Y)
    const span = w / size
    const world = CAVE.rows[0].length
    const camera = sweep(clock, 22) * Math.max(0, world - span)

    // Letterboxed into the middle, as the screen does it. Drawn from the top
    // of the frame the level sits in a band with the whole bottom half black.
    ctx.save()
    ctx.translate(0, Math.max(0, (h - size * VIEW_TILES_Y) / 2))

    drawCave(ctx, CAVE, { camera, size, clock }, new Set(), false, w)

    // Him, a third in from the left so there is always level ahead of him.
    const x = camera + span * 0.3
    const ground = walkHeight(CAVE.rows, x, CAVE.start.y, caveSolid, CAVE.start.y)
    drawDave(
      ctx,
      { ...newDave({ x: 0, y: 0 }), x, y: ground, onGround: true, vx: 1, facing: 1 },
      { camera, size, clock },
    )
    ctx.restore()
  },

  /**
   * The dungeon: level one, drawn by the game, panned along.
   *
   * Three floors on screen, which is what the game shows, so the drop the
   * cutscene walks past is the drop you will be looking down.
   */
  dungeon({ ctx, w, h, clock }) {
    wash(ctx, w, h, '#12151a', '#080a0e')

    // The screen's own rule: the tile decides the floor, and as many floors as
    // fit are shown, which is how you can see what is under a ledge.
    const size = Math.min(w / ROOM_COLS, (h / (ROOM_ROWS + FLOOR_DEPTH)) * 0.78)
    const floorHeight = size / 0.78
    const fits = Math.floor(h / floorHeight - FLOOR_DEPTH)
    const rows = Math.max(ROOM_ROWS, Math.min(fits, DUNGEON.rows.length))
    const world = levelCols(DUNGEON)

    /*
     * He leads and the camera follows, rather than the two being driven off
     * the clock independently. That is the whole of the fix for a man who ran
     * at one speed while the stonework slid past at another.
     */
    const along = Math.min(clock * DUNGEON_PACE, DUNGEON_PATH.length - 1.001)
    const step = Math.floor(along)
    const f = along - step
    const from = DUNGEON_PATH[step]
    const to = DUNGEON_PATH[Math.min(step + 1, DUNGEON_PATH.length - 1)]
    // A gap in the columns, or a change of floor, is a jump. Anything else is
    // one pace of a run.
    const jumping = to.col - from.col > 1 || to.row !== from.row
    const col = lerp(from.col, to.col, f)
    const row = lerp(from.row, to.row, f) - (jumping ? Math.sin(f * Math.PI) * 0.3 : 0)
    const camera = clamp(col - ROOM_COLS * 0.3, 0, Math.max(0, world - ROOM_COLS))

    const top = clamp(Math.round(row) - 1, 0, Math.max(0, DUNGEON.rows.length - rows))
    const view = { col: camera, row: top, rows, size, floorHeight, clock }

    const boardH = floorHeight * (rows + FLOOR_DEPTH)
    ctx.save()
    ctx.translate(0, Math.max(0, (h - boardH) / 2))

    drawRoom(ctx, DUNGEON, view, w, boardH, false, [])

    /*
     * No guard is drawn in. Level one has none, and the point of this scene is
     * that it is level one — inventing a guard for the cutscene is the exact
     * thing that made these scenes worth rewriting.
     */
    drawPrince(
      ctx,
      {
        ...newPrince(DUNGEON),
        col,
        row,
        facing: 1,
        // A change of floor, or no floor at all, is a gap — and the only
        // honest way across a gap in this game is a running jump.
        action: jumping ? 'runJump' : 'run',
        // Off distance covered, not off the clock. Legs that keep time with
        // the wall rather than with the ground are legs running on the spot.
        frame: Math.floor(along * 3) % 8,
      },
      view,
      false,
    )
    ctx.restore()
  },

  /**
   * The pipes: level one, drawn by the game, panned to the flag.
   *
   * The pan ends on the pole, because the pole is the answer to the only
   * question a first-time player has.
   */
  pipes({ ctx, w, h, clock }) {
    wash(ctx, w, h, PIPE_INK.skyDeep, PIPE_INK.sky)

    const level = PIPE_RUN.level
    // The screen's own rule again: never fewer than ten tiles across.
    const size = Math.min(h / VIEW_ROWS, w / 10)
    const span = w / size
    const world = level.rows[0].length
    const camera = sweep(clock, 24) * Math.max(0, world - span)
    const view = { col: camera, size, clock }

    const boardH = size * VIEW_ROWS
    ctx.save()
    ctx.translate(0, Math.max(0, (h - boardH) / 2))

    drawBackdrop(ctx, view, boardH)
    drawPipes(ctx, PIPE_RUN, view, w)
    drawItems(ctx, PIPE_RUN, view)
    drawEnemies(ctx, PIPE_RUN, view)
    drawFlag(ctx, level, view, false, clock)

    // The apprentice, running along in front of the camera with a hop in him,
    // because a level in this game is read through what he can clear.
    const x = camera + span * 0.28
    const ground = walkHeight(level.rows, x, VIEW_TOP, pipeSolid, PIPE_RUN.body.y)
    const hop = Math.max(0, Math.sin(clock * 2.4)) * 1.8
    drawHero(
      ctx,
      { ...newBody(x, ground - hop), facing: 1, onGround: hop < 0.05, vx: 4 },
      view,
      0,
      clock,
    )
    ctx.restore()
  },

  /**
   * The maths door: the card the app actually puts in front of you.
   *
   * This was a dark room with a glowing crack in it, which looked like a
   * horror game and told you nothing. It is the question card now, in the
   * app's own colours and at the app's own size, because the honest thing to
   * show somebody about the maths door is the maths.
   */
  question({ ctx, w, h, t, clock }) {
    // Bright. The whole intro was reported as "dark and weird", and this is
    // the one beat that was never a dark place to begin with.
    wash(ctx, w, h, '#2b3350', '#1d2030')
    const s = Math.min(w, h)

    const cardW = Math.min(w * 0.86, s * 1.1)
    const cardH = Math.min(h * 0.72, cardW * 0.95)
    const x = (w - cardW) / 2
    const y = (h - cardH) / 2
    const grow = ease(Math.min(1, t * 3))

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(lerp(0.9, 1, grow), lerp(0.9, 1, grow))
    ctx.translate(-w / 2, -h / 2)

    ctx.fillStyle = '#e8ebf5'
    ctx.beginPath()
    ctx.roundRect(x, y, cardW, cardH, s * 0.05)
    ctx.fill()

    // The sum, big and dark on white, which is how it looks when it matters.
    // Shrunk to fit rather than set at a fixed size: "144 ÷ 12" is twice the
    // width of "15²" and ran off both edges of the card at the size that
    // suited the short one.
    const sums = ['7 × 8', '144 ÷ 12', '96 + 47', '15²']
    const sum = sums[Math.floor(clock / 3) % sums.length]
    const room = cardW * 0.82
    let type = cardH * 0.2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let tries = 0; tries < 12; tries++) {
      ctx.font = `bold ${type}px ui-monospace, monospace`
      if (ctx.measureText(sum).width <= room) break
      type *= 0.9
    }
    ctx.fillStyle = '#14161f'
    ctx.fillText(sum, w / 2, y + cardH * 0.2)

    // A keypad under it, with one key lit the way a pressed key lights. Three
    // rows have to fit between the sum and the bottom of the card, so the key
    // height comes out of what is left rather than being picked.
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    const pad = cardW * 0.05
    const keyW = (cardW - pad * 4) / 3
    const top = y + cardH * 0.38
    const keyH = (y + cardH - pad * 1.5 - top - pad * 1.6) / 3
    const lit = Math.floor(clock * 1.6) % keys.length
    keys.forEach((key, i) => {
      const kx = x + pad * 1.5 + (i % 3) * (keyW + pad)
      const ky = top + Math.floor(i / 3) * (keyH + pad * 0.8)
      ctx.fillStyle = i === lit ? '#ffc84a' : '#2c3145'
      ctx.beginPath()
      ctx.roundRect(kx, ky, keyW, keyH, s * 0.02)
      ctx.fill()
      ctx.fillStyle = i === lit ? '#14161f' : '#e8ebf5'
      ctx.font = `bold ${keyH * 0.6}px ui-monospace, monospace`
      ctx.fillText(key, kx + keyW / 2, ky + keyH / 2)
    })
    ctx.restore()
  },

}

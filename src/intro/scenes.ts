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
import { LANES as ROAD_LANES, SIGHT as ROAD_SIGHT, TANK } from '../road/level'
import { drawRun as drawRoadRun } from '../road/draw'
import { FIXED as ROAD_FIXED, NO_INPUT as ROAD_STILL, newRun as newDrive, step as driveOn, type Run as Drive } from '../road/run'
import { SHIP_WIDE, SIZE_OF as RUBBLE_SIZE } from '../space/level'
import { drawRun as drawFlight } from '../space/draw'
import { FIXED as SPACE_FIXED, newRun as newFlight, step as flyOn, type Input as Stick, type Run as Flight } from '../space/run'
import { ARENA as GARDEN_EDGE } from '../snake/level'
import { drawRun as drawWall } from '../bricks/draw'
import {
  newRun as newWall, serve as newBall, step as knockOn, type Run as Wall,
} from '../bricks/run'
import { drawRun as drawGarden } from '../snake/draw'
import { drawRun as drawFlood } from '../sums/draw'
import {
  newRun as newFlood, step as stepFlood, grab as grabFlood, reach as reachFlood,
  release as releaseFlood, findsOn as floodFinds, type Run as Flood,
} from '../sums/run'
import { drawRun as drawPencil } from '../puzzles/draw'
import {
  newRun as newPencil, touch as touchPencil, drag as dragPencil, lift as liftPencil,
  type Run as Pencil,
} from '../puzzles/run'
import {
  headOf as crawlHead, newRun as newGarden, respawn as crawlAgain, step as crawlOn,
  type Run as Crawl,
} from '../snake/run'

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

/**
 * Half a minute of the road, driven once and kept.
 *
 * A scene has to be a pure function of the clock so it can be scrubbed and
 * replayed, and the road is a simulation — so it is played through once, in
 * advance, and the cutscene reads off the recording. Driven by something no
 * cleverer than a person: hold the pedal, move to whichever lane is clear.
 */
let roadFilm: Drive[] | null = null

function roadFootage(): Drive[] {
  if (roadFilm) return roadFilm
  const frames: Drive[] = []
  let run = newDrive(1, 99, 0, 12)
  let target: number | null = null

  for (let t = 0; t < 46; t += ROAD_FIXED) {
    const gapIn = (lane: number) => {
      let soonest = Infinity
      for (const car of run.cars) {
        if (Math.abs(car.lane - lane) >= 0.9) continue
        const ahead = car.y - run.distance
        if (ahead < 0) continue
        const closing = run.speed - car.speed
        if (closing > 0.5) soonest = Math.min(soonest, ahead / closing)
      }
      return soonest
    }

    const here = Math.round(run.lane)
    let input = { ...ROAD_STILL, go: true }
    if (target !== null && Math.abs(run.lane - target) > 0.12) {
      input = { ...input, left: target < run.lane, right: target > run.lane }
    } else {
      target = null
      if (gapIn(here) < 3) {
        for (let reach = 1; reach < ROAD_LANES && target === null; reach++) {
          for (const lane of [here - reach, here + reach]) {
            if (lane < 0 || lane > ROAD_LANES - 1 || gapIn(lane) < 3) continue
            target = lane
            input = { ...input, left: lane < run.lane, right: lane > run.lane }
            break
          }
        }
      }
    }

    run = driveOn(run, input, ROAD_FIXED)
    if (run.status !== 'driving') run = { ...run, status: 'driving', fuel: TANK, stunned: 0 }
    // Every sixth step, which is plenty to read back at any frame rate. The
    // recording has to outlast the story that reads it: it used to stop at
    // forty seconds against a forty-two second story, and the last beat was a
    // photograph of a race rather than a race.
    if (Math.round(t / ROAD_FIXED) % 6 === 0) frames.push(run)
  }
  roadFilm = frames
  return frames
}

/**
 * A pilot no cleverer than a person, flown once and kept.
 *
 * Flown on demand, not at the top of the file. All four of these recordings
 * used to be built the moment anything imported this module, which is the
 * moment the app starts — and between them that was two and a half seconds of
 * a blank screen before the front door appeared, for everybody, whether or not
 * they were about to watch a cutscene. Measured, after it made the smoke test
 * flaky and the reason took three wrong guesses to find.
 *
 * Same trick as the road, and for the same reason: a scene has to be a pure
 * function of the clock, and the game is a simulation. So it is flown through
 * in advance — aim for the widest gap in the sky ahead, hold the trigger down
 * — and the cutscene reads the recording back. What you watch is the game,
 * played.
 */
function fly(world: number, seed: number, hold: [number, number], seconds = 46): Flight[] {
  const frames: Flight[] = []
  let run = newFlight(world, 99, 0, seed)

  for (let t = 0; t < seconds; t += SPACE_FIXED) {
    const soon = run.rubble.filter((r) => r.y > 0.2 && r.y < 1)
    const shut = soon
      .map((r): [number, number] => {
        const half = RUBBLE_SIZE[r.kind] / 2 + SHIP_WIDE / 2
        return [r.x - half, r.x + half]
      })
      .sort((a, b) => a[0] - b[0])

    let best = run.x
    let widest = 0
    let edge = 0
    for (const [left, right] of shut) {
      if (left - edge > widest) { widest = left - edge; best = (edge + left) / 2 }
      edge = Math.max(edge, right)
    }
    if (1 - edge > widest) { widest = 1 - edge; best = (edge + 1) / 2 }
    best = Math.min(1 - SHIP_WIDE / 2, Math.max(SHIP_WIDE / 2, best))

    const off = best - run.x
    const stick: Stick = { left: off < -0.01, right: off > 0.01, fire: true }
    run = flyOn(run, stick, SPACE_FIXED)
    // Knocked or arrived, keep flying: the beat wants thirty seconds of sky,
    // not an ending. The progress is held inside a band rather than let run,
    // because the world ahead grows with it and the beat wants it a readable
    // size the whole way through rather than a dot at one end and a wall at
    // the other.
    if (run.status !== 'flying') {
      run = { ...run, status: 'flying', shields: 3, mercy: 0 }
    }
    if (run.progress < hold[0] || run.progress > hold[1]) {
      run = { ...run, progress: hold[0] }
    }
    if (Math.round(t / SPACE_FIXED) % 6 === 0) frames.push(run)
  }
  return frames
}

/*
 * Mars rather than Mercury because Mercury is a grey dot and Mars is red, and
 * the beat has to say "space" in the first half second.
 */
const flights = new Map<string, Flight[]>()

function flown(world: number, seed: number, hold: [number, number]): Flight[] {
  const key = `${world}:${seed}`
  const had = flights.get(key)
  if (had) return had
  const made = fly(world, seed, hold)
  flights.set(key, made)
  return made
}

const FLIGHT = () => flown(4, 7, [0.1, 0.9])

/*
 * And the other half of the game, which the story used to stop short of.
 *
 * The cutscene talked about eight worlds and ended at Neptune, which is what
 * the game was when it was written and is not what it is now — there is a
 * whole second half out past the planets, and a story that does not mention
 * it is a story that tells you the game is over when it is not.
 *
 * Sagittarius A* for the picture, out of the eight deep worlds, because it is
 * the one that could not be mistaken for the solar system: a black hole with
 * the sky bent round it, aliens in the traffic, and a current that pushes the
 * ship sideways whether it is steering or not. The progress is held high so
 * the hole is big — the whole point of the beat is that it looks nothing like
 * the place you started.
 *
 * The seed is measured rather than picked. The first one had no alien on
 * screen at all during the beat that says something lives out here, which is a
 * line delivered over an empty sky. Twelve were flown and counted; this one
 * has one in frame for 97 per cent of the five deep beats, against 41 for the
 * worst of them.
 */
const DEEP = () => flown(15, 97, [0.55, 0.88])

/** The four Machines, in the colours they are on the board. */
const MACHINES = ['#e8503a', '#f49ac1', '#5ad2e0', '#f0a04b']

/** Every scene any story can name. */
/**
 * The garden, grown once and kept.
 *
 * Same trick again: the scene has to be a pure function of the clock and the
 * game is five snakes making decisions, so it is played through in advance by
 * somebody who keeps off the walls and eats, and the cutscene reads it back.
 *
 * It is played at a length that shows the thing the game is for — a snake long
 * enough to ring somebody — because a beat about encircling over a picture of
 * two short worms says nothing.
 *
 * Grown on demand rather than at the top of the file, unlike the race and the
 * two flights. Those are cheap; this one is five snakes making decisions for
 * forty-six seconds, which is a couple of seconds of work — and done at module
 * load that is a couple of seconds of white screen before the front door
 * appears, for everybody, including the six people who were not going to watch
 * this cutscene.
 */
let gardenFilmed: Crawl[] | null = null

function gardenFilm(): Crawl[] {
  if (gardenFilmed) return gardenFilmed
  const frames: Crawl[] = []
  /*
   * Three rivals, not five, and stepped twenty-four times a second rather than
   * sixty.
   *
   * At the full count and the full rate this took four and a half seconds to
   * grow — which is four and a half seconds of frozen screen before the
   * cutscene starts, and on a slower machine it was over five and timed two
   * tests out. Nothing is lost: the beat wants a garden with snakes in it, and
   * at a step of a twenty-fourth a snake still moves less than one bead, so
   * nothing passes through anything.
   */
  let run = newGarden(31, 3)
  // A head start on length, so the beats that talk about rings are played over
  // a snake that could actually close one.
  run = { ...run, snakes: run.snakes.map((s, i) => (i === 0 ? { ...s, length: 11 } : s)) }

  const step = 1 / 24
  for (let t = 0; t < 46; t += step) {
    const you = run.snakes[0]
    const head = crawlHead(you)
    let want = you.heading
    /*
     * And from twenty seconds in, it curls.
     *
     * Because the two beats that run over that stretch are the ones about
     * looping round onto your own tail, and the first cut of this played them
     * over a snake going in a straight line eating. That is the one move
     * nobody will find on their own and the one the whole game is for; a beat
     * explaining it over a picture of something else is worse than no beat.
     *
     * Scripted rather than hoped for, which a cutscene is allowed to be.
     */
    if (t > 19 && t < 34) {
      want = you.heading + 1
    } else if (Math.hypot(head.x, head.y) > GARDEN_EDGE * 0.6) {
      // Turn in, and keep turning: a snake wandering the rim of the garden is
      // a snake the camera follows into an empty corner for ten seconds.
      want = Math.atan2(-head.y, -head.x)
    } else {
      let near = Infinity
      for (const p of run.pellets) {
        const gap = Math.hypot(p.x - head.x, p.y - head.y)
        if (gap < near) { near = gap; want = Math.atan2(p.y - head.y, p.x - head.x) }
      }
    }
    run = crawlOn(run, { x: Math.cos(want), y: Math.sin(want), dash: false }, step)
    if (run.status !== 'playing') run = crawlAgain(run)
    /*
     * Kept long, however the round goes.
     *
     * A snake that comes back after being caught comes back the length it
     * started, and a snake that short cannot close a ring at all: a full turn
     * at this speed is nearly six units round and it is two and a half long.
     * So the beats about looping played over a snake physically incapable of
     * it, and the reason was a death fifteen seconds earlier that nothing in
     * the picture showed.
     */
    if (run.snakes[0].length < 10) {
      run = { ...run, snakes: run.snakes.map((sn, i) => (i === 0 ? { ...sn, length: 11 } : sn)) }
    }
    // Ten frames a second, which is what the scene reads it back at.
    if (frames.length < Math.floor(t * 10) + 1) frames.push(run)
  }
  gardenFilmed = frames
  return frames
}

/**
 * The wall, knocked about once and kept.
 *
 * A bat that follows the ball, which is the whole of what anybody does in that
 * game, on a wall a few levels in so there is something to look at rather than
 * a plain grid. Cheap enough to grow on demand without anybody noticing: this
 * one has no snakes making decisions in it, only a ball.
 */
let wallFilmed: Wall[] | null = null

function wallFilm(): Wall[] {
  if (wallFilmed) return wallFilmed
  const frames: Wall[] = []
  let run = newWall(4, 99, 0, 11)
  const step = 1 / 60
  for (let t = 0; t < 46; t += step) {
    const lowest = [...run.balls].sort((a, b) => b.y - a.y)[0]
    // A little off the ball, and wandering: parked exactly under it sends the
    // ball back up the same hole for ever, which is a dull thing to watch and
    // was the first cut of this.
    const lean = Math.sin(t * 0.8) * 0.7
    run = knockOn(run, {
      to: lowest ? lowest.x + lean : null,
      left: false,
      right: false,
      act: true,
    }, step)
    if (run.status !== 'playing') run = newBall({ ...run, lives: 99, status: 'lost' })
    if (frames.length < Math.floor(t * 10) + 1) frames.push(run)
  }
  wallFilmed = frames
  return frames
}

/**
 * How long each recorded scene has footage for, in seconds.
 *
 * Exported so the stories can be checked against it. A beat that starts after
 * its recording ran out is not an error and does not look like one: it is a
 * photograph where there should be a game, held for four seconds, and both the
 * road and the space story had one at the end.
 */
/**
 * The flood, played by somebody who is good at it but not instant.
 *
 * A bot that waits a beat before each tap rather than clearing the board at
 * sixty taps a second, because the thing the footage has to show is the water
 * going down when a block breaks — and a board solved instantly shows an empty
 * chamber and nothing else.
 *
 * It also deliberately gets one wrong, twice, about eight seconds apart: the
 * surge is the only way to see what a wrong answer costs, and a cutscene that
 * only ever shows the good case is an advertisement rather than an
 * explanation.
 */
let floodFilmed: Flood[] | null = null

function floodFilm(): Flood[] {
  if (floodFilmed) return floodFilmed
  const frames: Flood[] = []
  let run = newFlood(2, 1200, 99, 0, 12)
  const step = 1 / 60
  let waited = 0
  /** Partway through dragging a find: which blocks of it are under the finger. */
  let drawing: number[] | null = null
  let got = 0

  for (let t = 0; t < 46; t += step) {
    waited += step
    if (drawing && waited > 0.16) {
      waited = 0
      got += 1
      if (got <= drawing.length - 1) {
        run = reachFlood(run, drawing[got])
      } else {
        // Held on the finished selection for a moment before letting go, so
        // the green that says "this reads as something" is actually seen.
        run = releaseFlood(run)
        drawing = null
      }
    } else if (!drawing && waited > 1.1) {
      waited = 0
      const found = floodFinds(run.cells, 1)[0]
      if (found) {
        drawing = found.cells
        got = 0
        run = grabFlood(run, found.cells[0])
      }
    }
    run = stepFlood(run, step)
    // Never finishes: the footage is a chamber being worked at, and a run that
    // ends halfway through leaves the beats talking over a still picture.
    if (run.status !== 'playing') {
      run = { ...newFlood(run.level + 1, 1200, 99, run.score, 12), water: 0.3 }
      drawing = null
    }
    if (frames.length < Math.floor(t * 10) + 1) frames.push(run)
  }
  floodFilmed = frames
  return frames
}

/**
 * The notebook: somebody solving one, slowly enough to follow.
 *
 * Three recordings rather than one, so a beat can be about the puzzle it is
 * playing over. A single film cycling through all three would have worked and
 * would have tied every beat's length to where the film had got to — which is
 * the arrangement that has already made two cutscenes outrun their own
 * footage.
 *
 * Drawn at about four places a second: fast enough not to be a slideshow,
 * slow enough that you can see a finger making a decision.
 */
const PENCILS: Record<string, Pencil[] | null> = { stroke: null, maze: null, flow: null }

function pencilFilm(kind: 'stroke' | 'maze' | 'flow'): Pencil[] {
  const found = PENCILS[kind]
  if (found) return found

  const frames: Pencil[] = []
  const first = kind === 'stroke' ? 1 : kind === 'maze' ? 2 : 3

  /*
   * Two of them, one after the other, rather than one and a long stare.
   *
   * One puzzle solved at a pace you can follow is five seconds of film, and
   * the beats that play over it need twenty. The first way round that was to
   * hold on the finished picture, which is a photograph with music over it.
   * Several different puzzles of the same kind fill the same time and are
   * actually about something — they show that the puzzles keep coming.
   */
  /*
   * Enough film for the whole story, not just for the beats that name it.
   *
   * A scene's clock runs from the start of the cutscene rather than from when
   * that scene comes up — so the third scene of a forty-second story is read
   * at forty seconds however late it arrives. Twenty seconds of film each
   * looked right and left the last scene holding one frozen frame for the last
   * four seconds of the story.
   */
  for (let level = first; frames.length < 460; level += 3) {
    let run = newPencil(level, 6 + level)
    const board = run.board
    const paths =
      board.kind === 'stroke' ? [board.figure.answer]
      : board.kind === 'maze' ? [board.maze.answer]
      : board.flow.answer

    // A moment on the blank puzzle, so it is clear what is being asked.
    for (let i = 0; i < 10; i++) frames.push(run)
    for (const path of paths) {
      if (path.length === 0) continue
      run = touchPencil(run, path[0])
      frames.push(run, run)
      for (let i = 1; i < path.length; i++) {
        run = dragPencil(run, path[i])
        // Three frames a place at ten a second: about three places a second,
        // which is roughly the speed of somebody who knows where they are
        // going but is not racing.
        frames.push(run, run, run)
      }
      run = liftPencil(run)
      frames.push(run, run)
    }
    // And a moment on the finished one.
    for (let i = 0; i < 16; i++) frames.push(run)
  }

  PENCILS[kind] = frames
  return frames
}

export const FOOTAGE_SECONDS: Record<string, number> = {
  get road() { return roadFootage().length / 10 },
  get space() { return FLIGHT().length / 10 },
  get deep() { return DEEP().length / 10 },
  /*
   * The only one of these that has to be grown to be measured. It is a
   * one-off at the moment the stories are first checked against their footage,
   * which is a test and the first play of the cutscene, and never again.
   */
  get garden() { return gardenFilm().length / 10 },
  get wall() { return wallFilm().length / 10 },
  get flood() { return floodFilm().length / 10 },
  get oneline() { return pencilFilm('stroke').length / 10 },
  get throughit() { return pencilFilm('maze').length / 10 },
  get joined() { return pencilFilm('flow').length / 10 },
}

/** The deep-space recording, for the test that counts what is in it. */
export const DEEP_FOOTAGE = DEEP

/** And the garden's, for the test that checks it actually closes a ring. */
export const gardenFootage = gardenFilm



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
   * The road: a real drive, recorded once and played back.
   *
   * Same rule as every other scene in here — it is the game, drawn by the
   * game's own code, rather than a picture of the game.
   */
  road({ ctx, w, h, clock }) {
    const film = roadFootage()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    const lane = Math.min(w / (ROAD_LANES + 1.6), h / (ROAD_SIGHT * 0.55))
    drawRoadRun(ctx, frame, frame.lane, {
      lane,
      depth: h / ROAD_SIGHT,
      left: (w - lane * ROAD_LANES) / 2,
      line: h * 0.82,
      distance: frame.distance,
      clock,
    }, w, h)
  },

  /**
   * Space: the recording, played back at the size of the beat.
   *
   * The drawing works in fractions of its own box, so the same footage fills a
   * phone held either way round without anything being laid out twice.
   */
  space({ ctx, w, h, clock }) {
    const film = FLIGHT()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    drawFlight(ctx, frame, { w, h, clock }, clock * 0.3)
  },

  /**
   * The garden: a snake going about its business.
   *
   * Drawn by the game's own code at the game's own size, so what the beats
   * talk about is what is on the screen while they say it.
   */
  garden({ ctx, w, h, clock }) {
    const film = gardenFilm()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    drawGarden(ctx, frame, { w, h, clock })
  },

  /**
   * The flood: a board of sums, and the water in the chamber above it.
   */
  flood({ ctx, w, h, clock }) {
    const film = floodFilm()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    drawFlood(ctx, frame, { w, h, clock })
  },

  /** The notebook: a figure being traced in one line. */
  oneline({ ctx, w, h, clock }) {
    const film = pencilFilm('stroke')
    drawPencil(ctx, film[Math.min(film.length - 1, Math.floor(clock * 10))], { w, h, clock })
  },

  /** The notebook: a finger finding the way out. */
  throughit({ ctx, w, h, clock }) {
    const film = pencilFilm('maze')
    drawPencil(ctx, film[Math.min(film.length - 1, Math.floor(clock * 10))], { w, h, clock })
  },

  /** The notebook: the dots being joined up. */
  joined({ ctx, w, h, clock }) {
    const film = pencilFilm('flow')
    drawPencil(ctx, film[Math.min(film.length - 1, Math.floor(clock * 10))], { w, h, clock })
  },

  /**
   * The wall: a bat, a ball, and bricks coming down.
   */
  wall({ ctx, w, h, clock }) {
    const film = wallFilm()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    drawWall(ctx, frame, { w, h, clock })
  },

  /**
   * Deep space: the same game, out where the planets have run out.
   *
   * A separate recording rather than the same one further along, because the
   * difference is the point. Different sky, different things coming at you,
   * and the ship visibly drifting against a current it is not steering into.
   */
  deep({ ctx, w, h, clock }) {
    const film = DEEP()
    const frame = film[Math.min(film.length - 1, Math.floor(clock * 10))]
    drawFlight(ctx, frame, { w, h, clock }, clock * 0.3)
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

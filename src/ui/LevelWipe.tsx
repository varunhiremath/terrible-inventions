import { useEffect, useRef } from 'react'
import { playCue } from '../music/player'
import { drawRunner } from '../render/silhouettes'
import { WALL_THICKNESS, wallBars } from '../render/mazeGeometry'
import { MAZE_INK } from '../render/mazeInk'
import { TILE as MAZE_TILE } from '../arcade/maze/maze'
import { drawDave, drawFrame, drawLevel as drawCave, drawSky as drawCaveSky } from '../dave/draw'
import { newDave } from '../dave/physics'
import {
  drawBackdrop,
  drawFlag,
  drawHero,
  drawLevel as drawPipes,
  drawSky as drawPipeSky,
} from '../pipes/draw'
import { newBody } from '../pipes/physics'
import { newRun as newPipeRun } from '../pipes/run'
import { FLOOR_DEPTH, drawPrince, drawRoom } from '../arcade/dungeon/draw'
import { newPrince } from '../arcade/dungeon/prince'
import { ROOM_COLS } from '../arcade/dungeon/level'
import { drawRun as drawSpace } from '../space/draw'
import { newRubble, newRun as newSpaceRun, type Rubble } from '../space/run'
import { drawFinish, drawMine, drawRoad } from '../road/draw'
import { CAR_LONG, CAR_WIDE, LANES, SIGHT, carNamed, type Racer } from '../road/level'
import {
  CAVE_FLOOR,
  CAVE_LOOT,
  CAVE_TUNNEL,
  CAVE_WALK,
  KEEP_HALL,
  KEEP_WALK,
  MAZE_DOTS,
  MAZE_LANE,
  MAZE_STRIP,
  PIPE_COINS,
  PIPE_GROUND,
  PIPE_RUN,
  PIPE_WALK,
} from './wipeWorlds'

/**
 * The walk from one level to the next.
 *
 * Cutting straight from a finished board to a fresh one loses the only moment
 * in the game that is purely a reward. Nothing is being asked of anybody here:
 * it is two and a half seconds of somebody small going somewhere, and then the
 * next level.
 *
 * Nothing in this file draws anything. Every scene builds a fragment of its
 * game's own world — the fragments are in `wipeWorlds.ts` — hands it to that
 * game's own drawing code, and moves the game's own character along it. That
 * is the second time this rule has had to be learnt. The first version drew a
 * generic stick figure, which was reported straight away; the second kept the
 * real characters but stood them in front of scenery painted here, and that
 * was reported too, and rightly. A cave mouth that exists in no cave, two
 * green pipes that are in no level, a staircase the dungeon does not have: the
 * character was right and the place was nowhere.
 *
 * So every one of these is the same sentence in six languages — two rooms, a
 * thin way through between them, something to pick up on the way, and a door
 * at the far end — said in tiles the game itself would recognise.
 */
export type WipeScene = 'maze' | 'cave' | 'pipes' | 'dungeon' | 'road' | 'space'

/** How long the whole thing takes. Long enough to watch, short enough to sit through. */
export const WIPE_SECONDS = 2.4

/** What it fades from and to. */
const BACK = '#0d1016'

type Ctx = CanvasRenderingContext2D

/** Eased 0..1, so nothing starts or stops abruptly. */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** The stretch of `t` a thing happens over, as its own 0..1. */
function during(t: number, from: number, to: number): number {
  return Math.max(0, Math.min(1, (t - from) / (to - from)))
}

/**
 * Where a tile-built scene sits on the screen.
 *
 * The four games that are made of tiles all want the same thing: as big as
 * fits, whole tiles, centred, and clear of the title at the top. Written once
 * because getting it slightly different in four places is how one of them ends
 * up cropped and nobody notices until it is on a phone.
 */
function fit(w: number, h: number, cols: number, rows: number, tall = 1) {
  const room = { w: w * 0.96, h: h * 0.62 }
  const size = Math.min(room.w / cols, room.h / (rows * tall))
  return {
    size,
    left: Math.round((w - size * cols) / 2),
    // Below the title, and centred in what is left, so a short scene floats in
    // the middle of the space rather than clinging to the bottom edge.
    top: Math.round(h * 0.35 + (room.h - size * rows * tall) / 2),
  }
}

/** Everything inside the box, and nothing outside it. */
function inBox(
  ctx: Ctx,
  box: { left: number; top: number },
  w: number,
  h: number,
  paint: () => void,
) {
  ctx.save()
  ctx.translate(box.left, box.top)
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  paint()
  ctx.restore()
}

/** A camera that follows something along a strip without running off the end. */
function follow(at: number, visible: number, width: number, ahead = 0.4): number {
  return Math.max(0, Math.min(width - visible, at - visible * ahead))
}

type Scene = (ctx: Ctx, w: number, h: number, t: number, car: Racer) => void

const SCENES: Record<WipeScene, Scene> = {
  /**
   * Papa Panic: out of one room, down the passage eating as he goes, into the
   * next.
   *
   * The board is drawn in three dimensions and this is a flat canvas, so the
   * walls cannot be the same objects — but they are the same *shapes*, from
   * the same `wallBars`, at the same thickness and in the same pink, so a
   * corridor here is a corridor of that maze.
   */
  maze(ctx, w, h, t) {
    const cols = MAZE_STRIP[0].length
    const rows = MAZE_STRIP.length
    const box = fit(w, h, cols, rows)
    const s = box.size

    const go = during(t, 0.08, 0.86)
    const at = 1 + smooth(go) * (cols - 3)

    inBox(ctx, box, s * cols, s * rows, () => {
      ctx.fillStyle = MAZE_INK.back
      ctx.fillRect(0, 0, s * cols, s * rows)

      ctx.fillStyle = MAZE_INK.wall
      for (const bar of wallBars(MAZE_STRIP, MAZE_TILE.WALL, WALL_THICKNESS)) {
        ctx.fillRect(
          (bar.x - bar.width / 2 + 0.5) * s,
          (bar.z - bar.depth / 2 + 0.5) * s,
          bar.width * s + 0.5,
          bar.depth * s + 0.5,
        )
      }

      ctx.fillStyle = MAZE_INK.dot
      for (const dot of MAZE_DOTS) {
        // Eaten once he is past, which is the whole point of the scene.
        if (dot.y === MAZE_LANE && dot.x < at - 0.4) continue
        ctx.beginPath()
        ctx.arc((dot.x + 0.5) * s, (dot.y + 0.5) * s, s * 0.14, 0, Math.PI * 2)
        ctx.fill()
      }

      // The same wedge-nosed scout the board and the intro draw.
      drawRunner(ctx, (at + 0.5) * s, (MAZE_LANE + 0.5) * s, s * 0.46, 0, t * 7)
    })
  },

  /**
   * The caves: through the tunnel, taking the diamonds, to the door at the far
   * end.
   *
   * Sky, tiles, frame and Dave are all the caves' own drawing. The only thing
   * this scene decides is where he is and where the camera is.
   */
  cave(ctx, w, h, t) {
    const cols = CAVE_TUNNEL.rows[0].length
    const rows = CAVE_TUNNEL.rows.length
    // Ten rows is the height of a screen in that game.
    const box = fit(w, h, CAVE_WALK.visible, rows)
    const s = box.size
    const bandW = Math.min(w * 0.96, s * cols)
    const visible = bandW / s
    box.left = Math.round((w - bandW) / 2)

    const go = during(t, 0.06, 0.88)
    const x = CAVE_WALK.from + smooth(go) * (CAVE_WALK.to - CAVE_WALK.from)
    const view = { camera: follow(x, visible, cols), size: s, clock: t * 2 }

    // The diamonds behind him are gone, so the walk is worth something.
    const taken = new Set(
      CAVE_LOOT.filter((gem) => gem.x < x - 0.4).map((gem) => `${gem.x},${gem.y}`),
    )
    // The door opens once he has the last of them, which is what a door in
    // this game is waiting for.
    const opened = taken.size >= CAVE_LOOT.length

    inBox(ctx, box, bandW, s * rows, () => {
      drawCaveSky(ctx, view, bandW, s * rows)
      drawCave(ctx, CAVE_TUNNEL, view, taken, opened, bandW)
      drawFrame(ctx, CAVE_TUNNEL, view, bandW, s * rows)
      drawDave(
        ctx,
        {
          ...newDave({ x: x - 0.5, y: CAVE_FLOOR - 1 }),
          vx: 4,
          onGround: true,
          facing: 1,
          hasTrophy: opened,
        },
        view,
      )
    })
  },

  /**
   * The pipes: along the low run under the blocks, taking the coins, out to
   * the flag.
   *
   * Sky, hills, tiles, coins, flag and the plumber are all that game's own
   * drawing, down to the coins vanishing through the same `changed` map the
   * game itself spends them with.
   */
  pipes(ctx, w, h, t) {
    const cols = PIPE_RUN.rows[0].length
    const rows = PIPE_RUN.rows.length - 4 // the top four are never drawn
    const box = fit(w, h, 14, rows)
    const s = box.size
    const bandW = Math.min(w * 0.96, s * cols)
    const visible = bandW / s
    box.left = Math.round((w - bandW) / 2)

    const go = during(t, 0.06, 0.9)
    const x = PIPE_WALK.from + smooth(go) * (PIPE_WALK.to - PIPE_WALK.from)
    const view = { col: follow(x, visible, cols), size: s, clock: t * 2 }

    const run = newPipeRun(PIPE_RUN, 1)
    for (const coin of PIPE_COINS) {
      if (coin.col < x - 0.5) run.changed[`${coin.col},${coin.row}`] = ' '
    }

    inBox(ctx, box, bandW, s * rows, () => {
      drawPipeSky(ctx, bandW, s * rows)
      drawBackdrop(ctx, view, s * rows)
      drawPipes(ctx, run, view, bandW)
      drawFlag(ctx, PIPE_RUN, view, x >= PIPE_WALK.to - 1, t * 2)
      drawHero(
        ctx,
        { ...newBody(x, PIPE_GROUND), onGround: true, facing: 1 },
        view,
        0,
        t * 2,
      )
    })
  },

  /**
   * The dungeon: along the hall, through the gate, out the far door.
   *
   * The room, the stone, the torches and the prince are the dungeon's own,
   * and the camera pans across whole rooms the way the game's does.
   */
  dungeon(ctx, w, h, t) {
    const cols = KEEP_HALL.rows[0].length
    const floors = KEEP_HALL.rows.length
    // The floor is taller than a tile is wide — the same 0.78 the board uses,
    // which is what stops a room reading as a cavern.
    const box = fit(w, h, ROOM_COLS, floors + FLOOR_DEPTH, 1 / 0.78)
    const s = box.size
    const floorHeight = s / 0.78
    const bandW = s * ROOM_COLS
    const bandH = floorHeight * (floors + FLOOR_DEPTH)
    box.left = Math.round((w - bandW) / 2)

    const go = during(t, 0.08, 0.88)
    const col = KEEP_WALK.from + smooth(go) * (KEEP_WALK.to - KEEP_WALK.from)
    const view = {
      col: follow(col, ROOM_COLS, cols),
      row: 0,
      rows: floors,
      size: s,
      floorHeight,
      clock: t * 2,
    }

    inBox(ctx, box, bandW, bandH, () => {
      // The gate is open, because the whole scene is him going through it.
      drawRoom(ctx, KEEP_HALL, view, bandW, bandH, true, [])
      drawPrince(
        ctx,
        {
          ...newPrince(KEEP_HALL),
          col,
          row: KEEP_WALK.row,
          facing: 1,
          action: 'run',
          frame: Math.floor(t * 24) % 8,
        },
        view,
        false,
      )
    })
  },

  /**
   * The road: up the road and over the line.
   *
   * Drawn with the road's own `drawRoad`, on a view built the way the race
   * builds one, so the lanes, the kerbs, the hedges and the dashes are the
   * road you have just been driving on. The car was previously placed in a
   * lane of an invisible road while a grey rectangle was painted somewhere
   * else entirely, which is why it sat off the tarmac — reported, and exactly
   * what happens when a scene draws its own scenery instead of the game's.
   */
  road(ctx, w, h, t, car) {
    const depth = h / SIGHT
    const longEnough = (CAR_LONG * depth) / (1.45 * CAR_WIDE)
    const lane = Math.min((w * 0.96) / (LANES + 1.4), longEnough)
    const view = {
      lane,
      depth,
      left: (w - lane * LANES) / 2,
      // He sits low, so almost all of it is the road ahead — same as the race.
      line: h * 0.82,
      // Twelve lengths up the road over the scene, which puts the line behind
      // him at the end rather than the moment it arrives.
      distance: smooth(during(t, 0, 1)) * 26,
      clock: t * 2,
    }

    drawRoad(ctx, view, w, h)
    // The chequers at eighteen, so they come into sight, arrive, and go.
    drawFinish(ctx, 18, view)
    // A drift across two lanes, so there is a line being taken rather than a
    // car sliding up a rail.
    const across = 1.5 + Math.sin(smooth(during(t, 0.1, 0.95)) * Math.PI) * 0.9
    drawMine(ctx, across, view, 0, 0, Math.cos(during(t, 0.1, 0.95) * Math.PI) * 0.5, car)
  },

  /**
   * Space: up the gap between two drifts of rubble, towards the next world.
   *
   * A real run of that game, with its rubble laid out as two walls and a lane
   * between them, handed to the game's own `drawRun` — so the sky, the planet,
   * the rocks and the ship are all the ones from the run just finished.
   */
  space(ctx, w, h, t) {
    const run = newSpaceRun(1)
    const go = smooth(during(t, 0, 1))
    run.progress = 0.15 + go * 0.75

    // Two drifts with a lane up the middle. They scroll down past the ship,
    // which is the direction everything moves in that game.
    const rubble: Rubble[] = []
    let id = 0
    for (let n = 0; n < 9; n++) {
      const y = ((n / 9 + go * 1.4) % 1.35) - 0.2
      for (const side of [-1, 1]) {
        rubble.push({
          ...newRubble(n % 3 === 0 ? 'shard' : 'rock', 0.5 + side * (0.27 + ((n * 7) % 5) * 0.012), y),
          id: id++,
        })
      }
    }
    run.rubble = rubble
    // Threading the lane: a small weave rather than a straight line, because
    // the ship is never still in that game.
    run.x = 0.5 + Math.sin(go * Math.PI * 2) * 0.05

    drawSpace(ctx, run, { w, h, clock: t * 2 }, go * 2)
  },
}

export function LevelWipe({
  scene,
  title,
  car,
  onDone,
}: {
  scene: WipeScene
  /** What to call where it is going: "Level 3", "Room 4", "Mars". */
  title: string
  /** Which car drives off the end of a level: whichever one drove it. */
  car?: string
  onDone: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Something to walk to. The level's own music has already stopped by now,
    // so this has the place to itself.
    playCue('travel')

    let frame = 0
    const began = performance.now()
    /*
     * Ends on its own clock rather than on the last frame.
     *
     * A backgrounded tab stops painting, and a wipe that waited for its own
     * animation to finish would leave somebody staring at a frozen picture
     * when they came back. The timer runs whatever the browser is doing.
     */
    const timer = window.setTimeout(() => done.current(), WIPE_SECONDS * 1000)

    const paint = () => {
      const box = canvas.getBoundingClientRect()
      /*
       * Nothing to draw into yet.
       *
       * A canvas can be measured before the layout that gives it a size — on
       * the frame it mounts, or across an orientation change — and the scenes
       * divide by that size. At a tile a sixteenth of a pixel across, the
       * pipes' own tile drawing asks for a rounded rectangle two pixels
       * narrower than nothing, which throws, which stops the animation frame
       * being asked for again, which freezes the transition on a black screen
       * until the timer lets the level through. Wait a frame instead.
       */
      if (box.width < 2 || box.height < 2) {
        frame = requestAnimationFrame(paint)
        return
      }
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(box.width * dpr))
      canvas.height = Math.max(1, Math.round(box.height * dpr))
      const w = canvas.width
      const h = canvas.height
      const t = Math.min(1, (performance.now() - began) / (WIPE_SECONDS * 1000))

      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = 1
      ctx.fillStyle = BACK
      ctx.fillRect(0, 0, w, h)

      SCENES[scene](ctx, w, h, t, carNamed(car))

      /*
       * In and out at the ends, as a wash rather than as an alpha.
       *
       * Setting `globalAlpha` and letting the scene inherit it does not work
       * here and the reason is worth keeping: these scenes are drawn by the
       * games' own code, and several of those functions set `globalAlpha` back
       * to 1 themselves — quite correctly, since in their own game nothing
       * else is fading. So half the transitions faded and half did not, which
       * is precisely the sort of thing a still photograph of an animation
       * hides. A rectangle painted over the top cannot be undone from inside.
       */
      const lit = Math.min(smooth(during(t, 0, 0.12)), 1 - smooth(during(t, 0.9, 1)))
      if (lit < 1) {
        ctx.globalAlpha = 1 - lit
        ctx.fillStyle = BACK
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      }

      /*
       * The title, on a plate.
       *
       * The scenes fill the frame now — a real sky, a lit room, a road — so
       * white text on its own lands on whatever happens to be behind it.
       */
      const text = smooth(during(t, 0.25, 0.5)) * lit
      ctx.globalAlpha = text
      const size = Math.max(16, Math.min(w, h) * 0.1)
      ctx.font = `bold ${size}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const words = title.toUpperCase()
      const wide = ctx.measureText(words).width
      ctx.fillStyle = 'rgba(8,10,16,0.72)'
      ctx.beginPath()
      ctx.roundRect(w / 2 - wide / 2 - size * 0.5, h * 0.24 - size * 0.8, wide + size, size * 1.6, size * 0.35)
      ctx.fill()
      ctx.fillStyle = '#eef2f8'
      ctx.fillText(words, w / 2, h * 0.24)
      ctx.globalAlpha = 1

      if (t < 1) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [scene, car])

  return (
    <div
      className="fade-in absolute inset-0 z-50"
      aria-live="polite"
      aria-label={`On to ${title}`}
      /* The games steer on pointer events and capture them. */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  )
}

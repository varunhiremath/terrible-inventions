import { useEffect, useRef } from 'react'
import { drawCan, drawCar, drawMine, drawRacer, drawRoad } from '../road/draw'
import { BEAD as SNAKE_BEAD, ROSTER as SNAKE_ROSTER } from '../snake/level'
import { newRun as newWall, readWall } from '../bricks/run'
import { drawRun as drawWall } from '../bricks/draw'
import { newRun as newGarden, newSnake } from '../snake/run'
import { drawRun as drawGarden } from '../snake/draw'
import { newRun as newFlood } from '../sums/run'
import { drawRun as drawFlood } from '../sums/draw'
import { drawRun as drawPencil } from '../puzzles/draw'
import {
  newRun as newPencil, touch as touchPencil, drag as dragPencil,
} from '../puzzles/run'
import { ROSTER } from '../road/level'
import { drawRubble, drawShip, drawSky, drawWorld } from '../space/draw'
import { newRubble } from '../space/run'
import { worldFor } from '../space/level'
import { useStore } from '../store'
import { UpdatePill } from '../ui/UpdatePill'
import type { Screen } from '../store'
import { drawHero, drawLevel as drawPipes, drawSky as drawPipeSky } from '../pipes/draw'
import { VIEW_TOP } from '../pipes/level'
import { newBody } from '../pipes/physics'
import { newRun as newPipeRun } from '../pipes/run'
import { drawRunner, drawMachine, MACHINE_INK } from '../render/silhouettes'
import { WALL_THICKNESS, wallBars } from '../render/mazeGeometry'
import { MAZE_INK } from '../render/mazeInk'
import { TILE as MAZE_TILE } from '../arcade/maze/maze'
import { drawDave, drawFrame, drawLevel as drawCave, drawSky as drawCaveSky } from '../dave/draw'
import { newDave } from '../dave/physics'
import {
  CAVE_FLOOR, CAVE_TUNNEL, MAZE_DOTS, MAZE_LANE, MAZE_STRIP, PIPE_GROUND, PIPE_RUN, PIPE_WALK,
} from '../ui/wipeWorlds'
import { drawTaste } from '../mob/draw'
import { drawMeadow } from '../archer/emblem'
import { drawCompound } from '../outpost/emblem'
import { fill } from '../config/profile'

/**
 * The front door.
 *
 * Twelve games, and nothing else on the screen. The app used to open straight
 * into the maze, which quietly made that one the game and the other three
 * things you had to know were hidden in the settings.
 *
 * The Dungeon is not here any more. It is the one game in the set that was
 * reported as too buggy to play, and a tile that opens something broken is
 * worse than no tile: everything behind it still exists, tests and all, so
 * putting it back is this list plus one line in `App.tsx`. See `README.md`.
 *
 * Each tile draws its own emblem rather than carrying a picture file, in
 * keeping with the rest of this: no assets, nothing to download, and it stays
 * sharp on any screen.
 */

interface Tile {
  id: Screen
  title: string
  blurb: string
  tint: string
  emblem: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

/**
 * The tiles.
 *
 * Each one shows the character you will actually be, drawn with that game's
 * own code wherever there is any — the pipes' apprentice and the swarm's cart
 * are the same functions the games call. The first version of these
 * was shapes: a rectangle for a person, a triangle for a trophy. It was
 * reported as "I only see some blocks", which was fair.
 *
 * The maze's two are drawn here rather than borrowed, because that game is
 * rendered in three dimensions and has no flat drawing to reuse. They are
 * Papa and one of his machines: our own, like everything else in here.
 */
const TILES: Tile[] = [
  {
    id: 'arcade',
    title: 'Papa Panic',
    blurb: 'Clear the maze. Four machines want a word.',
    tint: '#1b2340',
    /*
     * Drawn with the game's own pieces, like every other tile on this screen.
     *
     * It used to be a hand-made boy with a face and a red box on treads, and
     * neither of them is in the game: the one you play is a wedge-nosed yellow
     * scout and the ones chasing you are the Machines out of `silhouettes.ts`.
     * Reported as "match the display images of the games with the actual
     * character in the game", which is the third time this exact fault has
     * been found — in the level transitions, then here.
     *
     * The maze is a corner of the same strip the transition walks down, drawn
     * with the same `wallBars` at the same thickness in the same pink as the
     * board.
     */
    emblem(ctx, w, h) {
      const cols = 9
      const rows = MAZE_STRIP.length
      const size = Math.min(w / cols, h / rows)
      const left = (w - size * cols) / 2
      const top = (h - size * rows) / 2

      ctx.fillStyle = MAZE_INK.back
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.translate(left, top)

      ctx.fillStyle = MAZE_INK.wall
      for (const bar of wallBars(MAZE_STRIP, MAZE_TILE.WALL, WALL_THICKNESS)) {
        ctx.fillRect(
          (bar.x - bar.width / 2 + 0.5) * size,
          (bar.z - bar.depth / 2 + 0.5) * size,
          bar.width * size + 0.5,
          bar.depth * size + 0.5,
        )
      }
      ctx.fillStyle = MAZE_INK.dot
      for (const dot of MAZE_DOTS) {
        if (dot.x < 3) continue
        ctx.beginPath()
        ctx.arc((dot.x + 0.5) * size, (dot.y + 0.5) * size, size * 0.14, 0, Math.PI * 2)
        ctx.fill()
      }

      // Him in the passage, and one of them coming the other way.
      drawRunner(ctx, 3.5 * size, (MAZE_LANE + 0.5) * size, size * 0.46, 0, 0.25)
      drawMachine(
        ctx, 8.2 * size, (MAZE_LANE + 0.5) * size, size * 0.46,
        -1, 0, 0.3, MACHINE_INK('#e8503a'),
      )
      ctx.restore()
    },
  },
  {
    id: 'archer',
    title: 'The Meadow',
    blurb: 'Balloons going up, all round you. Pull the bow back and aim high.',
    tint: '#1b3f63',
    /*
     * The only tile not drawn by the game's own code, because the game's own
     * code is three.js: ten WebGL contexts on the front screen would cost more
     * than everything else on it put together. So this is the meadow painted
     * flat — but from the game's own colours and the game's own parts, down to
     * the bow sitting in the corner of your view where it really sits.
     */
    emblem(ctx, w, h) {
      drawMeadow(ctx, w, h, performance.now() / 1000)
    },
  },
  {
    id: 'dave',
    title: 'The Caves',
    blurb: 'Ten caves. Take the trophy, find the door.',
    tint: '#2b1810',
    /*
     * The real Dave, in a real cave. The one here before was a hand-made
     * figure in a blue jacket and a red helmet; his are a red cap, a red shirt
     * and blue trousers, and the brick is the caves' own brick.
     */
    emblem(ctx, w, h) {
      /*
       * Sized to fill the tile rather than to fit inside it.
       *
       * Fitting is the obvious thing and it was right while a tile was a wide
       * strip. On a tall one it left a third of the tile as bare brown
       * backing above and below a letterboxed cave, which is the one tile on
       * the shelf that looked broken. Filling crops a couple of columns off
       * the side of the passage instead, and nobody can tell.
       */
      const cols = 11
      const size = Math.max(w / cols, h / CAVE_TUNNEL.rows.length)
      const view = { camera: 14, size, clock: 0 }
      const band = size * CAVE_TUNNEL.rows.length
      /*
       * And cropped around Dave rather than around the middle of the cave. A
       * tile of this game with him not in it is a tile of some bricks, which
       * is what a phone on its side was getting: the band it kept was the roof
       * of the passage.
       */
      const onHim = h / 2 - (CAVE_FLOOR - 0.5) * size
      ctx.save()
      ctx.translate(0, Math.max(h - band, Math.min(0, onHim)))
      ctx.beginPath()
      ctx.rect(0, 0, w, band)
      ctx.clip()
      drawCaveSky(ctx, view, w, band)
      drawCave(ctx, CAVE_TUNNEL, view, new Set(), true, w)
      drawFrame(ctx, CAVE_TUNNEL, view, w, band)
      drawDave(
        ctx,
        { ...newDave({ x: 16.5, y: CAVE_FLOOR - 1 }), vx: 4, onGround: true, facing: 1 },
        view,
      )
      ctx.restore()
    },
  },
  {
    id: 'mob',
    title: 'The Swarm',
    blurb: 'Monsters coming down. Better guns in the crates, if you have time.',
    tint: '#101a33',
    /*
     * The game's own pieces at the game's own scale: a few of the monsters, a
     * crate with its price on it, and you at the bottom with two shots in the
     * air. Drawn by `drawTaste`, which calls the same functions the game
     * calls — the fault this project has found three separate times is a tile
     * showing something that is nowhere in the game it opens.
     */
    emblem(ctx, w, h) {
      drawTaste(ctx, w, h, performance.now() / 1000)
    },
  },
  {
    id: 'outpost',
    title: 'The Outpost',
    blurb: 'Night, a walled compound, and somebody locked in it.',
    tint: '#111a2c',
    /*
     * Painted rather than played, for the same reason the meadow's is: that
     * game is three.js and a tile is a thumbnail. What is in the picture is
     * what is in the compound — the wall, a lamp, the lit cage with her in it,
     * a machine with its eye up and the number it is carrying, a fuse on the
     * floor and the rifle in the corner of your eye.
     */
    emblem(ctx, w, h) {
      drawCompound(ctx, w, h, performance.now() / 1000)
    },
  },
  {
    id: 'pipes',
    title: 'The Pipes',
    blurb: 'Run, jump, stomp. The flag is a long way off.',
    tint: '#1d3a6e',
    /*
     * The ground, the blocks and the pipe are the game's own tiles now, drawn
     * from the same stretch of level the transition runs along. The hand-made
     * ones were the right colours and the wrong shapes, which is the way this
     * sort of thing is usually wrong.
     */
    emblem(ctx, w, h) {
      /*
       * Nine columns, and the ground pushed to the bottom of the tile.
       *
       * Sized to fit the whole eleven rows the game shows, nearly all of a
       * tile is the sky those rows are mostly made of — true to the game and a
       * waste of a picture. This crops off the top instead.
       */
      const size = w / 9
      const rows = PIPE_RUN.rows.length - VIEW_TOP
      const view = { col: PIPE_WALK.from - 1.5, size, clock: 0 }
      const band = size * rows
      ctx.save()
      ctx.translate(0, h - band)
      ctx.beginPath()
      ctx.rect(0, 0, w, band)
      ctx.clip()
      drawPipeSky(ctx, w, band)
      drawPipes(ctx, newPipeRun(PIPE_RUN, 1), view, w)
      drawHero(
        ctx,
        { ...newBody(PIPE_WALK.from + 1, PIPE_GROUND), facing: 1, onGround: true },
        view,
        0,
        0,
      )
      ctx.restore()
    },
  },
  {
    id: 'road',
    title: 'The Road',
    blurb: 'Four lanes, no brakes worth speaking of. Mind the fuel.',
    tint: '#2f4a2e',
    emblem(ctx, w, h) {
      const lane = w / 5.6
      const view = {
        lane,
        depth: h / 5,
        left: (w - lane * 4) / 2,
        line: h * 0.78,
        distance: 0,
        clock: 0,
      }
      drawRoad(ctx, view, w, h)
      // Two of his and one of yours, drawn by the game's own code so the tile
      // is the game rather than a picture of it.
      drawCar(ctx, { id: 1, y: 3.4, lane: 0, speed: 0, kind: 'patrol', wants: 0, signal: 0, signalFor: 0, roused: 0 }, view)
      drawCar(ctx, { id: 2, y: 2.6, lane: 2, speed: 0, kind: 'swerver', wants: 2, signal: 1, signalFor: 0.5, roused: 0 }, view)
      // And one of the field, so the tile shows there is somebody to race.
      drawRacer(ctx, {
        id: 1000, who: ROSTER[1], y: 2.2, lane: 1, wants: 1,
        speed: 0, signal: 0, signalFor: 0, finished: null, stunned: 0,
      }, view)
      drawCan(ctx, { id: 3, y: 1.6, lane: 3, taken: false }, view)
      drawMine(ctx, 1, view, 0)
    },
  },
  {
    id: 'space',
    title: 'The Long Way Out',
    blurb: 'Eight worlds, and everything in between wants a word.',
    tint: '#0b1024',
    emblem(ctx, w, h) {
      // Saturn, because it is the one everybody recognises with the sound off.
      const view = { w, h, clock: 0 }
      drawSky(ctx, view, 0)
      drawWorld(ctx, worldFor(6), 0.62, view)
      const rock = (id: number, x: number, y: number, kind: 'rock' | 'shard' | 'alien') =>
        drawRubble(ctx, { ...newRubble(kind, x, y), id }, view)
      rock(3, 0.22, 0.52, 'rock')
      // A saucer, because that is what is out there now and the tile should
      // say so before anybody gets as far as Neptune to find out.
      rock(7, 0.74, 0.44, 'alien')
      rock(5, 0.52, 0.66, 'shard')
      drawShip(ctx, 0.4, view, 0, 0)
    },
  },
  {
    id: 'snake',
    title: 'The Garden',
    blurb: 'Grow. Mind the others. Ring one and it is yours.',
    tint: '#0b1410',
    emblem(ctx, w, h) {
      /*
       * The real game's drawing, with a run built by hand: one of yours in the
       * middle of closing a ring round a rival, which is the move the whole
       * game is for and the one thing a still picture can show about it.
       */
      const view = { w, h, clock: 0 }
      const ring: { x: number; y: number }[] = []
      const beads = Math.round((Math.PI * 2 * 1.5) / SNAKE_BEAD)
      // A little short of all the way round, so it reads as a loop being drawn
      // rather than a circle that has always been there.
      for (let i = 0; i <= beads * 0.93; i++) {
        const a = (i / beads) * Math.PI * 2 - 2.1
        ring.push({ x: Math.cos(-a) * 1.5, y: Math.sin(-a) * 1.5 })
      }
      const you = { ...newSnake(1, null, { x: 0, y: 0 }, 0), body: ring, length: ring.length * SNAKE_BEAD }
      const caught = newSnake(2, SNAKE_ROSTER[1], { x: 0.1, y: 0.1 }, 1.2)
      const base = newGarden(1, 7, { rivals: 0, food: 0, charms: 0, hedges: 0 })
      drawGarden(ctx, {
        ...base,
        snakes: [you, caught],
        // One of each, so the tile shows a forest rather than a field of dots.
        prey: [
          { id: 10, x: 2.4, y: -1.6, kind: 'rat' as const, heading: 2.4, scare: 0, hop: 0, spent: 0, big: false },
          { id: 11, x: -2.6, y: 1.9, kind: 'rabbit' as const, heading: -0.7, scare: 1, hop: 0, spent: 0, big: false },
          { id: 12, x: 1.1, y: 2.7, kind: 'frog' as const, heading: 1.1, scare: 0, hop: 0.4, spent: 0, big: false },
          { id: 13, x: -1.9, y: -2.4, kind: 'ant' as const, heading: 0.3, scare: 0, hop: 0, spent: 0, big: false },
        ],
        drops: [{ id: 14, x: 2.8, y: 1.3, kind: 'lure', bob: 0 }],
        ring,
        ringFor: 0.8,
      }, view)
    },
  },
  {
    id: 'bricks',
    title: 'The Wall',
    blurb: 'A bat, a ball, and something in the way. Catch what falls.',
    tint: '#05060a',
    emblem(ctx, w, h) {
      /*
       * The real game, with a wall half down and something on its way to the
       * bat — which is the picture that says what this one is, rather than a
       * full wall nobody has started on.
       */
      const base = newWall(1)
      drawWall(ctx, {
        ...base,
        bricks: readWall([
          '.bbbbbbbbbb..',
          '.bb.bbb.bbb..',
          '.aa..aa..a...',
          '..a...a......',
        ]),
        balls: [{ id: 1, x: 7.4, y: 14, dx: 0.4, dy: -0.92, speed: 9, stuck: false, along: 0 }],
        drops: [{ id: 2, x: 4.2, y: 11, kind: 'gun' }],
        bat: 6.2,
      }, { w, h, clock: 0 })
    },
  },
  {
    id: 'sums',
    title: 'Papa in Trouble!',
    blurb: 'Drag a line that is true. He is in the tank.',
    tint: '#070b14',
    emblem(ctx, w, h) {
      /*
       * The real game again, with the water halfway up — which is the whole
       * picture: a board of sums, and a reason to get on with them.
       */
      const base = newFlood(1, 1050, 3, 0, 4)
      drawFlood(ctx, { ...base, water: 0.45 }, { w, h, clock: 0 })
    },
  },
  {
    id: 'puzzles',
    title: 'The Notebook',
    blurb: 'One line, no lifting. A maze. Dots to join.',
    tint: '#14161f',
    emblem(ctx, w, h) {
      /*
       * A figure half traced, drawn by the game's own code. The one-line
       * puzzle rather than the other two because it is the one that explains
       * itself from a still picture: a shape, and a heavy line part of the way
       * round it.
       */
      let run = newPencil(1, 6)
      const board = run.board
      if (board.kind === 'stroke') {
        const answer = board.figure.answer
        run = touchPencil(run, answer[0])
        for (let i = 1; i < Math.ceil(answer.length * 0.6); i++) {
          run = dragPencil(run, answer[i])
        }
      }
      drawPencil(ctx, run, { w, h, clock: 0 })
    },
  },
]

function Emblem({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      tile.emblem(ctx, canvas.width, canvas.height)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [tile])
  return <canvas ref={ref} className="block h-full w-full" aria-hidden />
}

export function Home() {
  const go = useStore((s) => s.go)
  const save = useStore((s) => s.save)

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-3 p-3 sm:gap-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg font-bold uppercase tracking-widest text-chalk sm:text-2xl">
          Terrible Inventions
        </h1>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => go('settings')}
          className="rounded-full border border-dim/40 px-4 py-2 font-mono text-xs uppercase tracking-widest text-dim"
        >
          Settings
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-sm text-dim">
          {fill('{papa}')} built twelve terrible machines. Swipe and pick one.
        </p>
        {/* The front screen is the one place it is safe to reload, so this is
            the one place the update takes itself. */}
        <UpdatePill auto />
      </div>

      {/*
        * The shelf: every game the same size, scrolled sideways.
        *
        * This was a grid of two columns and three declared rows, which was
        * right for the six games there were when it was written. At eleven it
        * was wrong in a way that is easy to miss in code and impossible to
        * miss on a phone: the rows were declared and the tiles were not, so
        * everything after the sixth fell into rows the grid had never been
        * told about, sized itself from its own contents, and came out shorter
        * than the ones above it. The front screen looked like a list of
        * mistakes.
        *
        * So the rows are the thing that is fixed now — two of them, always —
        * and the games run off to the right for as long as there are games.
        * The column width is a share of the screen rather than a share of the
        * list, which is what makes every tile the same size no matter how many
        * there are, and what means the twelfth game will cost nothing but
        * itself.
        *
        * It snaps, so a swipe lands on a column rather than halfway across
        * one, and the next column is always half in view, because a shelf that
        * ends exactly at the edge of the screen looks like the end of the
        * shelf.
        */}
      <div
        className="shelf grid min-h-0 flex-1 snap-x snap-mandatory grid-flow-col grid-rows-2
                   auto-cols-[44%] gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain
                   scroll-px-1 sm:auto-cols-[31%]"
      >
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => go(tile.id)}
            style={{ backgroundColor: tile.tint }}
            className="block-btn flex min-h-0 snap-start flex-col justify-between overflow-hidden
                       p-0 text-left"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <Emblem tile={tile} />
            </div>
            <div className="w-full bg-ink/70 px-3 py-2">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-chalk sm:text-sm">
                {tile.title}
              </p>
              {/*
                * The blurb needs width to be worth reading and height to be
                * worth the room. A phone on its side has the first and not the
                * second: the caption took two thirds of a tile and left the
                * picture of the game as a strip along the top.
                */}
              <p className="mt-0.5 hidden text-xs leading-snug text-dim sm:block short:hidden">
                {tile.blurb}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/*
        * The workshop.
        *
        * A strip rather than a seventh tile: it is not a game and it should
        * not look like one. It carries the purse, because the purse is the
        * reason to go in.
        */}
      <button
        type="button"
        onClick={() => go('workshop')}
        className="block-btn flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span>
          <span className="block font-mono text-xs font-bold uppercase tracking-wider text-chalk">
            The Workshop
          </span>
          <span className="mt-0.5 block text-xs text-dim">
            Spend what you have earned. Sums pay best.
          </span>
        </span>
        <span className="shrink-0 font-mono text-base font-bold tabular-nums text-bolt">
          ◆ {save.coins}
        </span>
      </button>

      {save.note && !save.note.seen && (
        <button
          type="button"
          onClick={() => go('note')}
          className="block-btn border-bolt/60 px-3 py-3 text-left text-sm"
        >
          A note from {fill('{papa}')} is waiting.
        </button>
      )}
    </div>
  )
}

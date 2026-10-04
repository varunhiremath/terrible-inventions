import { useEffect, useRef } from 'react'
import { drawCan, drawCar, drawMine, drawRacer, drawRoad } from '../road/draw'
import { BEAD as SNAKE_BEAD, ROSTER as SNAKE_ROSTER } from '../snake/level'
import { newRun as newGarden, newSnake } from '../snake/run'
import { drawRun as drawGarden } from '../snake/draw'
import { ROSTER } from '../road/level'
import { drawRubble, drawShip, drawSky, drawWorld } from '../space/draw'
import { newRubble } from '../space/run'
import { worldFor } from '../space/level'
import { useStore } from '../store'
import { UpdatePill } from '../ui/UpdatePill'
import type { Screen } from '../store'
import { drawFigure, type Look } from '../arcade/dungeon/figure'
import { FLOOR_DEPTH, drawRoom, poseFor } from '../arcade/dungeon/draw'
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
  CAVE_FLOOR, CAVE_TUNNEL, KEEP_HALL, KEEP_WALK, MAZE_DOTS, MAZE_LANE, MAZE_STRIP,
  PIPE_GROUND, PIPE_RUN, PIPE_WALK,
} from '../ui/wipeWorlds'
import { fill } from '../config/profile'

/**
 * The front door.
 *
 * Six games, and nothing else on the screen. The app used to open straight
 * into the maze, which quietly made that one the game and the other three
 * things you had to know were hidden in the settings.
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
 * own code wherever there is any — the dungeon's figure and the pipes'
 * apprentice are the same functions the games call. The first version of these
 * was shapes: a rectangle for a person, a triangle for a trophy. It was
 * reported as "I only see some blocks", which was fair.
 *
 * The maze's two are drawn here rather than borrowed, because that game is
 * rendered in three dimensions and has no flat drawing to reuse. They are
 * Papa and one of his machines: our own, like everything else in here.
 */
/** What he wears, matching the figure the dungeon draws. */
const PRINCE_LOOK: Look = {
  body: '#3f7fc4', legs: '#24406b', trim: '#f0c419', skin: '#e0a878',
  hair: '#2b1d14', band: '#f0c419', turban: true, coat: true, loose: true, curved: true,
}

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
      const cols = 11
      const size = Math.min(w / cols, h / CAVE_TUNNEL.rows.length)
      const view = { camera: 14, size, clock: 0 }
      const band = size * CAVE_TUNNEL.rows.length
      ctx.save()
      ctx.translate(0, (h - band) / 2)
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
    id: 'prince',
    title: 'The Dungeon',
    blurb: 'Thirteen floors. One hour. It never stops.',
    tint: '#151a22',
    /*
     * The room is the dungeon's own now as well as the figure. It was a
     * hand-laid pattern of grey rectangles with a torch painted on top, which
     * is not the stone the game is built from — and the torch the game draws
     * throws its light differently.
     */
    emblem(ctx, w, h) {
      // Six columns rather than a whole room of ten: a tile is a glimpse, and
      // at ten the prince is a speck in the middle of a lot of wall.
      const size = w / 6
      const floorHeight = size / 0.78
      const rows = Math.max(1, Math.min(KEEP_HALL.rows.length, Math.round(h / floorHeight)))
      const view = { col: 0, row: 0, rows, size, floorHeight, clock: 0 }
      const band = floorHeight * (rows + FLOOR_DEPTH)
      ctx.save()
      ctx.translate(0, (h - band) / 2)
      ctx.beginPath()
      ctx.rect(0, 0, w, band)
      ctx.clip()
      drawRoom(ctx, KEEP_HALL, view, w, band, true, [])
      drawFigure(
        ctx,
        size * 3.5,
        floorHeight * (KEEP_WALK.row + 1),
        size * 1.5,
        1,
        poseFor('run', 1, 'none'),
        PRINCE_LOOK,
        'warrior',
        false,
      )
      ctx.restore()
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
      const base = newGarden(7, 0, 0, 0)
      drawGarden(ctx, {
        ...base,
        snakes: [you, caught],
        pellets: [
          { id: 10, x: 2.4, y: -1.6, worth: 1, big: false },
          { id: 11, x: -2.6, y: 1.9, worth: 1, big: false },
          { id: 12, x: 1.1, y: 2.7, worth: 2, big: true },
          { id: 13, x: -1.9, y: -2.4, worth: 1, big: false },
        ],
        drops: [{ id: 14, x: 2.8, y: 1.3, kind: 'lure', bob: 0 }],
        ring,
        ringFor: 0.8,
      }, view)
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
          {fill('{papa}')} built seven terrible machines. Pick one.
        </p>
        {/* The front screen is the one place it is safe to reload, so this is
            the one place the update takes itself. */}
        <UpdatePill auto />
      </div>

      {/*
        * Six tiles, all the same size.
        *
        * It was two rows of two with six games in it, so the grid grew a third
        * row that the row heights knew nothing about and the last tiles came
        * out shorter than the rest. Rows are declared now: two across and
        * three down held upright, three across and two down on a screen with
        * no height to spare.
        */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-3 short:grid-cols-3 short:grid-rows-2">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => go(tile.id)}
            style={{ backgroundColor: tile.tint }}
            className="block-btn flex min-h-0 flex-col justify-between overflow-hidden p-0 text-left"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <Emblem tile={tile} />
            </div>
            <div className="w-full bg-ink/70 px-3 py-2">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-chalk sm:text-sm">
                {tile.title}
              </p>
              <p className="mt-0.5 hidden text-xs leading-snug text-dim sm:block">{tile.blurb}</p>
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

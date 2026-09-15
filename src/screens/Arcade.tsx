import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { HEIGHT, MAZE, TILE, WIDTH, edibleCells, key } from '../arcade/maze/maze'
import { GHOSTS, type Dir } from '../arcade/maze/ghosts'
import {
  newGame,
  positionOf,
  respawn,
  step,
  turn,
  useFreeze,
  type Game,
} from '../arcade/maze/game'
import { taunt, type TauntMoment } from '../arcade/taunts'
import { fitBoard } from '../arcade/fit'
import { wallBoxes } from '../render/mazeGeometry'
import { buildFruit, fruitForLevel } from '../render/fruit'
import { buildVoxel, disposeVoxel } from '../render/voxel'
import type { Palette } from '../render/sprites'
import { fill } from '../config/profile'
import { Btn } from '../ui/bits'
import { say, silence } from '../voice'
import { useStore } from '../store'

/**
 * Papa Panic.
 *
 * The whole maze is on screen at once, tilted just enough to read as solid.
 * Pac-Man is a game about seeing the board — a camera that follows the player
 * would hide the very thing the player is reasoning about.
 *
 * The simulation runs in a ref against an animation frame; only the handful of
 * numbers the HUD shows ever reach React.
 */

const PLAYER_PALETTE: Palette = {
  body: 'hsl(48, 95%, 58%)',
  shade: 'hsl(40, 90%, 44%)',
  accent: 'hsl(20, 90%, 55%)',
  outline: 'hsl(35, 60%, 16%)',
}

/** Pale and washed out, so a chaser you can eat reads at a glance. */
const FRIGHTENED_PALETTE: Palette = {
  body: 'hsl(220, 12%, 82%)',
  shade: 'hsl(220, 10%, 58%)',
  accent: 'hsl(0, 0%, 100%)',
  outline: 'hsl(220, 15%, 18%)',
}

function ghostPalette(colour: string): Palette {
  const base = new THREE.Color(colour)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const deg = Math.round(hsl.h * 360)
  return {
    body: `hsl(${deg}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`,
    shade: `hsl(${deg}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 62)}%)`,
    accent: 'hsl(0, 0%, 96%)',
    outline: `hsl(${deg}, 50%, 14%)`,
  }
}

export function Arcade() {
  const save = useStore((s) => s.save)
  const run = useStore((s) => s.run)
  const beginRun = useStore((s) => s.beginRun)
  const advanceLevel = useStore((s) => s.advanceLevel)
  const finishRun = useStore((s) => s.finishRun)
  const openShop = useStore((s) => s.openShop)
  const attemptContinue = useStore((s) => s.attemptContinue)
  const go = useStore((s) => s.go)

  const mountRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const extrasRef = useRef<HTMLDivElement>(null)
  const topRightRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState({ lives: 0, score: 0, status: 'playing' as Game['status'], freezes: 0 })
  /** Lets other effects ask the camera to re-measure when the layout shifts. */
  const refitRef = useRef<(() => void) | null>(null)
  /** Lets the level change the fruit on the board. */
  const fruitRef = useRef<((level: number) => void) | null>(null)
  /**
   * The level, where the scene can reach it. The scene is built once, after
   * the run is set up, so a run picked up again at level five needs to know
   * that before it puts the fruit out.
   */
  const levelRef = useRef(1)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!run) beginRun()
  }, [run, beginRun])

  // A fresh game whenever the run's level or power-ups change.
  useEffect(() => {
    if (!run) return
    gameRef.current = newGame(run.level, run.powerUps)
    levelRef.current = run.level
    fruitRef.current?.(run.level)
    setMessage(null)
    say(fill(taunt('levelStart')), { seed: GHOSTS[0].seed })
  }, [run])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    mount.appendChild(renderer.domElement)

    /**
     * Black and white, apart from what matters.
     *
     * Bright blue walls filled the screen with the one thing on it that the
     * player never needs to look at. Grey walls on black push the maze into
     * the background, which leaves the colour for the four things that are
     * actually worth noticing: the player, the chasers, the fruit, and a
     * chaser gone pale because it can be eaten.
     */
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#05060a')

    scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x181a22, 2.0))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(6, 18, 10)
    scene.add(sun)

    /**
     * Orthographic, not perspective.
     *
     * Pac-Man is a game about reading the board — which row lines up with
     * which, how far the gap is. Perspective makes the far side of the maze
     * smaller than the near side and the grid stops being square, which is
     * exactly the information the player needs. Orthographic keeps every tile
     * the same size, and a modest tilt still shows the walls having height.
     */
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    /** Radians from straight down. Enough for depth, little enough to read. */
    const TILT = 0.52

    // --- maze ---------------------------------------------------------------
    /** How much of a tile a wall takes up. The rest of the tile is corridor. */
    const WALL_THICKNESS = 0.5
    const WALL_HEIGHT = 0.62

    const cube = new THREE.BoxGeometry(1, 1, 1)
    const boxes = wallBoxes(MAZE, TILE.WALL, WALL_THICKNESS)

    const walls = new THREE.InstancedMesh(
      cube,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      boxes.length,
    )
    const matrix = new THREE.Matrix4()
    const colour = new THREE.Color()
    boxes.forEach((box, i) => {
      matrix.compose(
        new THREE.Vector3(box.x, WALL_HEIGHT / 2, box.z),
        new THREE.Quaternion(),
        new THREE.Vector3(box.width, WALL_HEIGHT, box.depth),
      )
      walls.setMatrixAt(i, matrix)
      // A slight drift from light at the top to dark at the bottom, so the maze
      // has some depth to it rather than reading as one flat stencil.
      const shade = 0.72 - (box.z / HEIGHT) * 0.28 + (box.x / WIDTH) * 0.04
      colour.setHSL(0.62, 0.05, shade)
      walls.setColorAt(i, colour)
    })
    walls.instanceMatrix.needsUpdate = true
    if (walls.instanceColor) walls.instanceColor.needsUpdate = true
    scene.add(walls)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH + 2, HEIGHT + 2),
      new THREE.MeshLambertMaterial({ color: 0x0a0b10 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(WIDTH / 2 - 0.5, -0.1, HEIGHT / 2 - 0.5)
    scene.add(floor)

    // --- dots and fruit -----------------------------------------------------
    const { dots, power } = edibleCells()

    const pellets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xf2f4fb, emissive: 0x2a2d38 }),
      dots.length,
    )
    scene.add(pellets)

    /**
     * The four power pellets, as fruit. Rebuilt when the level changes,
     * because the fruit changes with it.
     */
    let fruit: { group: THREE.Group; dispose: () => void }[] = []
    const clearFruit = () => {
      for (const one of fruit) {
        scene.remove(one.group)
        one.dispose()
      }
      fruit = []
    }
    const dressFruit = (level: number) => {
      clearFruit()
      const kind = fruitForLevel(level)
      fruit = power.map((cell) => {
        const built = buildFruit(kind)
        built.group.position.set(cell.x, 0, cell.y)
        scene.add(built.group)
        return built
      })
    }
    dressFruit(levelRef.current)
    fruitRef.current = dressFruit

    // --- characters ---------------------------------------------------------
    const player = buildVoxel(31337, PLAYER_PALETTE, { flat: true })
    scene.add(player.group)

    const ghostBodies = GHOSTS.map((spec) => {
      const normal = buildVoxel(spec.seed, ghostPalette(spec.colour), { flat: true })
      const scared = buildVoxel(spec.seed, FRIGHTENED_PALETTE, { flat: true })
      scene.add(normal.group)
      scene.add(scared.group)
      return { normal, scared }
    })

    /**
     * Fits the maze into the space the interface is not already using. The
     * panels are measured here rather than guessed at, because how big they
     * are depends on the text in them; `fitBoard` does the arithmetic.
     */
    const resize = () => {
      const rect = mount.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      renderer.setSize(w, h, false)

      const box = (el: HTMLElement | null) => {
        const r = el?.getBoundingClientRect()
        return r ? { width: r.width, height: r.height } : null
      }

      // The tilt foreshortens depth, so the maze needs less vertical room on
      // screen than it has tiles.
      const spanX = WIDTH + 1
      const spanY = (HEIGHT + 1) * Math.cos(TILT) + 1.5

      const { frustum } = fitBoard(w, h, spanX, spanY, {
        hud: box(hudRef.current),
        pad: box(padRef.current),
        extras: box(extrasRef.current),
        topRight: box(topRightRef.current),
      }, 12)

      camera.left = frustum.left
      camera.right = frustum.right
      camera.top = frustum.top
      camera.bottom = frustum.bottom
      camera.updateProjectionMatrix()

      const centre = new THREE.Vector3(WIDTH / 2 - 0.5, 0, HEIGHT / 2 - 0.5)
      const distance = 60
      camera.position.set(
        centre.x,
        centre.y + Math.cos(TILT) * distance,
        centre.z + Math.sin(TILT) * distance,
      )
      camera.lookAt(centre)
    }
    resize()
    refitRef.current = resize
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    let frame = 0
    let last = performance.now()
    let carry = 0
    let shown = { lives: -1, score: -1, status: 'playing' as Game['status'], freezes: -1 }

    /**
     * A fixed simulation step, decoupled from the frame rate.
     *
     * Stepping by however long the last frame took ties the game's speed to the
     * hardware: a slow device does not drop frames, it plays the whole game in
     * slow motion. Accumulating real time and spending it in fixed slices keeps
     * the chase running at the same pace everywhere, and makes the simulation
     * reproducible besides.
     */
    const FIXED = 1 / 120
    /** Enough catch-up for a stutter, not enough to teleport after a long pause. */
    const MAX_CATCHUP = 0.25

    const loop = () => {
      const now = performance.now()
      carry = Math.min(MAX_CATCHUP, carry + (now - last) / 1000)
      last = now

      const game = gameRef.current
      if (game) {
        const before = game.status

        let next = game
        while (carry >= FIXED) {
          next = step(next, FIXED)
          carry -= FIXED
        }
        gameRef.current = next

        if (next.status !== before && before === 'playing') {
          const moment: TauntMoment =
            next.status === 'gameOver' ? 'gameOver' : next.status === 'levelComplete' ? 'levelDone' : 'caught'
          const line = fill(taunt(moment))
          setMessage(line)
          say(line, { seed: GHOSTS[0].seed })
        }

        if (
          next.lives !== shown.lives ||
          next.score !== shown.score ||
          next.status !== shown.status ||
          next.powerUps.freezes !== shown.freezes
        ) {
          shown = { lives: next.lives, score: next.score, status: next.status, freezes: next.powerUps.freezes }
          setHud({ ...shown })
        }

        // Pellets: eaten ones shrink to nothing rather than being rebuilt.
        const zero = new THREE.Vector3(0, 0, 0)
        const dotSize = new THREE.Vector3(0.17, 0.17, 0.17)
        dots.forEach((cell, i) => {
          matrix.compose(
            new THREE.Vector3(cell.x, 0.35, cell.y),
            new THREE.Quaternion(),
            next.dots.has(key(cell)) ? dotSize : zero,
          )
          pellets.setMatrixAt(i, matrix)
        })
        pellets.instanceMatrix.needsUpdate = true

        // Fruit turns on the spot and bobs, so it catches the eye from across
        // the board. Eaten fruit is simply gone.
        power.forEach((cell, i) => {
          const one = fruit[i]
          if (!one) return
          const alive = next.power.has(key(cell))
          one.group.visible = alive
          if (!alive) return
          one.group.rotation.y = now / 700
          one.group.position.y = Math.sin(now / 340 + i) * 0.05
        })

        const at = positionOf(next.player)
        player.group.position.set(at.x, 0.42 + Math.abs(Math.sin(now / 120)) * 0.06, at.y)
        player.group.rotation.set(0, facingAngle(next.player.dir), 0)

        next.ghosts.forEach((ghost, i) => {
          const body = ghostBodies[i]
          const pos = positionOf(ghost)
          const hidden = ghost.eatenFor > 0
          const scared = ghost.frightened

          body.normal.group.visible = !hidden && !scared
          body.scared.group.visible = !hidden && scared

          const active = scared ? body.scared : body.normal
          active.group.position.set(pos.x, 0.42 + Math.sin(now / 260 + i) * 0.05, pos.y)
          active.group.rotation.set(0, facingAngle(ghost.dir), 0)
        })
      }

      renderer.render(scene, camera)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      clearFruit()
      fruitRef.current = null
      disposeVoxel(player)
      for (const body of ghostBodies) {
        disposeVoxel(body.normal)
        disposeVoxel(body.scared)
      }
      refitRef.current = null
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  // The panels change size when the freeze button appears or an overlay takes
  // over, and the fit depends on how much room they take.
  useEffect(() => {
    refitRef.current?.()
  }, [hud.freezes, hud.status])

  // --- input ---------------------------------------------------------------
  const push = (dir: Dir) => {
    const game = gameRef.current
    if (game) gameRef.current = turn(game, dir)
  }

  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    }
    const onKey = (e: KeyboardEvent) => {
      const dir = keys[e.key]
      if (dir) { e.preventDefault(); push(dir) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Swipe anywhere, which is how this is played on a tablet.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onUp = (e: React.PointerEvent) => {
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
    push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const again = () => {
    const game = gameRef.current
    if (game) gameRef.current = respawn(game)
    setMessage(null)
    setHud((h) => ({ ...h, status: 'playing' }))
  }

  const nextLevel = () => {
    silence()
    advanceLevel(gameRef.current?.score ?? 0)
  }

  const overlay = hud.status !== 'playing'

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" onPointerDown={onDown} onPointerUp={onUp}>
      <div ref={mountRef} className="absolute inset-0" />

      <header className="relative z-10 flex items-start justify-between gap-2 p-3">
        <div ref={hudRef} className="block-panel px-3 py-2">
          <p className="text-sm font-bold">Level {run?.level ?? 1}</p>
          <p className="text-xs text-dim">
            {'♥'.repeat(Math.max(0, hud.lives))} &middot; {hud.score}
            {save.arcade.highScore > 0 && ` · best ${save.arcade.highScore}`}
          </p>
        </div>
        <div ref={topRightRef} className="flex gap-2">
          <Btn onClick={openShop} className="px-4 py-2 text-sm">Shop</Btn>
          <button type="button" onClick={() => go('settings')} className="block-btn px-3 py-2 text-sm" aria-label="Settings">
            &#9881;
          </button>
        </div>
      </header>

      {!overlay && (
        <div
          // Held upright the controls sit along the bottom; turned sideways they
          // move to the edges, where thumbs already are and where they are not
          // covering the board.
          className="pointer-events-none absolute inset-0 z-10 flex items-end justify-between gap-3 p-4 landscape:items-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Visible controls. Swipe works too, but nobody should have to guess. */}
          <div ref={padRef} className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5">
            {([[null, 'up', null], ['left', null, 'right'], [null, 'down', null]] as const)
              .flat()
              .map((dir, i) =>
                dir ? (
                  <button
                    key={i}
                    type="button"
                    aria-label={dir}
                    onPointerDown={() => push(dir)}
                    // Full size on a tablet, which is what this is really played on, but
// it gives ground on a small phone held sideways rather than crowd
// the board off the screen. The floor stays a comfortable thumb.
                    className="block-btn h-[clamp(48px,15vmin,62px)] w-[clamp(48px,15vmin,62px)] bg-ink-soft/90 p-0 text-xl backdrop-blur"
                  >
                    {{ up: '\u25b2', down: '\u25bc', left: '\u25c0', right: '\u25b6' }[dir]}
                  </button>
                ) : (
                  <span key={i} />
                ),
              )}
          </div>

          <div ref={extrasRef} className="pointer-events-auto flex flex-col items-end gap-2">
            {hud.freezes > 0 && (
              <Btn
                tone="go"
                onClick={() => {
                  const game = gameRef.current
                  if (game) gameRef.current = useFreeze(game)
                }}
                className="px-6 py-4"
              >
                Freeze ({hud.freezes})
              </Btn>
            )}
            <p className="rounded-lg bg-ink/70 px-3 py-1 text-xs text-dim backdrop-blur">
              or swipe anywhere
            </p>
          </div>
        </div>
      )}

      {overlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4">
          <div className="block-panel w-full max-w-md p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-rust">{fill('{papa}')}</p>
            <p className="mt-2 text-xl leading-snug">{message ?? '…'}</p>

            <div className="mt-5 flex flex-col gap-2">
              {hud.status === 'died' && (
                <Btn tone="go" onClick={again} className="py-4 text-lg">Again</Btn>
              )}

              {hud.status === 'levelComplete' && (
                <Btn tone="go" onClick={nextLevel} className="py-4 text-lg">
                  Next level
                </Btn>
              )}

              {hud.status === 'gameOver' && (
                <>
                  <Btn tone="go" onClick={attemptContinue} className="py-4 text-lg">
                    Earn another go
                  </Btn>
                  <Btn onClick={openShop}>Go shopping first</Btn>
                  <Btn onClick={() => finishRun(gameRef.current?.score ?? 0)}>Start again from level 1</Btn>
                </>
              )}

              {hud.status !== 'gameOver' && <Btn onClick={openShop}>Shop</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function facingAngle(dir: Dir): number {
  return { up: Math.PI, down: 0, left: Math.PI / 2, right: -Math.PI / 2 }[dir]
}

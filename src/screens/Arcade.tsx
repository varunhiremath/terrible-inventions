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

const FRIGHTENED_PALETTE: Palette = {
  body: 'hsl(225, 70%, 58%)',
  shade: 'hsl(225, 60%, 38%)',
  accent: 'hsl(0, 0%, 95%)',
  outline: 'hsl(225, 50%, 14%)',
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
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState({ lives: 0, score: 0, status: 'playing' as Game['status'], freezes: 0 })
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!run) beginRun()
  }, [run, beginRun])

  // A fresh game whenever the run's level or power-ups change.
  useEffect(() => {
    if (!run) return
    gameRef.current = newGame(run.level, run.powerUps)
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

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1024')

    scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x25306a, 2.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.3)
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
    const cube = new THREE.BoxGeometry(1, 1, 1)
    const wallCells: { x: number; y: number }[] = []
    MAZE.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        if (tile === TILE.WALL) wallCells.push({ x, y })
      }),
    )

    const walls = new THREE.InstancedMesh(
      cube,
      new THREE.MeshLambertMaterial({ color: 0x3355cc }),
      wallCells.length,
    )
    const matrix = new THREE.Matrix4()
    const colour = new THREE.Color()
    wallCells.forEach((cell, i) => {
      matrix.compose(
        new THREE.Vector3(cell.x, 0.4, cell.y),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 0.8, 1),
      )
      walls.setMatrixAt(i, matrix)
      // A gentle gradient across the maze, so a wall of flat blue does not read
      // as one solid slab.
      colour.setHSL(0.62 + (cell.y / HEIGHT) * 0.06, 0.62, 0.42 + (cell.x / WIDTH) * 0.06)
      walls.setColorAt(i, colour)
    })
    walls.instanceMatrix.needsUpdate = true
    if (walls.instanceColor) walls.instanceColor.needsUpdate = true
    scene.add(walls)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH + 2, HEIGHT + 2),
      new THREE.MeshLambertMaterial({ color: 0x141a38 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(WIDTH / 2 - 0.5, -0.1, HEIGHT / 2 - 0.5)
    scene.add(floor)

    // --- dots ---------------------------------------------------------------
    const { dots, power } = edibleCells()
    const allPellets = [...dots.map((c) => ({ c, big: false })), ...power.map((c) => ({ c, big: true }))]
    const pellets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffd979, emissive: 0x3a2c00 }),
      allPellets.length,
    )
    scene.add(pellets)

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

    const resize = () => {
      const rect = mount.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      const aspect = rect.width / Math.max(1, rect.height)

      // Fit the whole maze on screen with a little air around it. Tilting
      // foreshortens the depth, so the vertical extent shrinks accordingly.
      const spanX = WIDTH + 2
      const spanY = (HEIGHT + 2) * Math.cos(TILT) + 2
      const halfHeight = Math.max(spanY, spanX / aspect) / 2

      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
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
        allPellets.forEach((pellet, i) => {
          const id = key(pellet.c)
          const alive = pellet.big ? next.power.has(id) : next.dots.has(id)
          const pulse = pellet.big ? 0.34 + Math.sin(now / 220) * 0.07 : 0.17
          matrix.compose(
            new THREE.Vector3(pellet.c.x, 0.35, pellet.c.y),
            new THREE.Quaternion(),
            alive ? new THREE.Vector3(pulse, pulse, pulse) : zero,
          )
          pellets.setMatrixAt(i, matrix)
        })
        pellets.instanceMatrix.needsUpdate = true

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
      disposeVoxel(player)
      for (const body of ghostBodies) {
        disposeVoxel(body.normal)
        disposeVoxel(body.scared)
      }
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

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
        <div className="block-panel px-3 py-2">
          <p className="text-sm font-bold">Level {run?.level ?? 1}</p>
          <p className="text-xs text-dim">
            {'♥'.repeat(Math.max(0, hud.lives))} &middot; {hud.score}
            {save.arcade.highScore > 0 && ` · best ${save.arcade.highScore}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={openShop} className="px-4 py-2 text-sm">Shop</Btn>
          <button type="button" onClick={() => go('settings')} className="block-btn px-3 py-2 text-sm" aria-label="Settings">
            &#9881;
          </button>
        </div>
      </header>

      {!overlay && (
        <div
          className="relative z-10 mt-auto flex items-end justify-between gap-3 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Visible controls. Swipe works too, but nobody should have to guess. */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {([[null, 'up', null], ['left', null, 'right'], [null, 'down', null]] as const)
              .flat()
              .map((dir, i) =>
                dir ? (
                  <button
                    key={i}
                    type="button"
                    aria-label={dir}
                    onPointerDown={() => push(dir)}
                    className="block-btn h-[62px] w-[62px] bg-ink-soft/90 p-0 text-xl backdrop-blur"
                  >
                    {{ up: '\u25b2', down: '\u25bc', left: '\u25c0', right: '\u25b6' }[dir]}
                  </button>
                ) : (
                  <span key={i} />
                ),
              )}
          </div>

          <div className="flex flex-col items-end gap-2">
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

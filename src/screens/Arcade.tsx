import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { HEIGHT, MAZE, TILE, WIDTH, edibleCells, key } from '../arcade/maze/maze'
import { GHOSTS, type Dir } from '../arcade/maze/ghosts'
import {
  newGame,
  positionBetween,
  respawn,
  step,
  turn,
  useFreeze,
  type Game,
} from '../arcade/maze/game'
import { taunt, type TauntMoment } from '../arcade/taunts'
import { fitBoard } from '../arcade/fit'
import { directionFromGesture, directionFromSwipe, toScreen } from '../arcade/steer'
import { wallBars } from '../render/mazeGeometry'
import { buildFruit, fruitForLevel } from '../render/fruit'
import { buildGhost, buildPlayer, type Ghost } from '../render/characters'
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

/**
 * How high the characters ride.
 *
 * Low, and this is not a free choice. The camera is tilted, so anything lifted
 * off the floor is drawn further up the screen than the tile it is standing
 * on — lift a character half a tile and he appears a quarter of a tile out of
 * position, which makes the board harder to read, not easier. Raising them
 * above the walls to stop the walls hiding them was worse than the problem.
 *
 * The player rides a hair above the chasers so he is drawn on top when they
 * overlap, which is the moment you most need to see him.
 */
const ACTOR_HEIGHT = 0.02

/** Peach, like the arcade's. */
const DOT_COLOUR = 0xffc9a8
/** The maze's own colour. Thin lines, so it can be bright without shouting. */
const WALL_COLOUR = 0xf24fd6
/** A chaser you can eat. */
const FRIGHTENED_COLOUR = 0x2632d6

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
  const extrasRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState({ lives: 0, score: 0, status: 'playing' as Game['status'], freezes: 0 })
  /** Lets other effects ask the camera to re-measure when the layout shifts. */
  const refitRef = useRef<(() => void) | null>(null)
  /** The player, small, for the lives row. */
function PlayerIcon() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 bg-bolt"
      style={{
        // A disc with a wedge out of it, in one clip path: the lives row is
        // the same character as the one on the board.
        clipPath:
          'polygon(100% 28%, 50% 50%, 100% 72%, 84% 90%, 58% 100%, 25% 92%, 4% 65%, 4% 35%, 25% 8%, 58% 0%, 84% 10%)',
        borderRadius: '50%',
      }}
    />
  )
}

/** Where the player is drawn, in screen pixels, for a tap to be aimed at. */
  const playerOnScreen = useRef<{ x: number; y: number } | null>(null)
  /** Lets the level change the fruit on the board. */
  const fruitRef = useRef<((level: number) => void) | null>(null)
  /**
   * The level, where the scene can reach it. The scene is built once, after
   * the run is set up, so a run picked up again at level five needs to know
   * that before it puts the fruit out.
   */
  const levelRef = useRef(1)
  const [message, setMessage] = useState<string | null>(null)
  /** Shown until the first steer, because a board with no buttons on it needs saying. */
  const [showHint, setShowHint] = useState(true)

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
    say(fill(taunt('levelStart')), { as: 'papa' })
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

    // Only the fruit are lit; everything else draws its own flat colour. The
    // light comes from straight above, because so does the camera.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(2, 20, 4)
    scene.add(sun)

    /**
     * Straight down, and orthographic.
     *
     * The original is a flat picture and every attempt to tilt it has cost
     * more than it bought: a tilted camera draws anything above the floor
     * further up the screen than the tile it stands on, hides characters
     * behind walls, and stops the grid reading as a grid. Looking straight
     * down, a tile is a tile.
     */
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

    // --- maze ---------------------------------------------------------------
    /**
     * The maze is drawn as an outline, not as blocks.
     *
     * Flat planes on the floor, no lighting, no height: the arcade original is
     * a two-dimensional picture and every attempt to give it depth has made it
     * harder to read. `wallBars` produces one thin bar per wall edge that faces
     * open floor, which is what draws a one-tile wall as the two parallel
     * lines everyone pictures when they picture this game.
     */
    const WALL_THICKNESS = 0.16

    const plane = new THREE.PlaneGeometry(1, 1)
    const bars = wallBars(MAZE, TILE.WALL, WALL_THICKNESS)
    const walls = new THREE.InstancedMesh(
      plane,
      new THREE.MeshBasicMaterial({ color: WALL_COLOUR }),
      bars.length,
    )
    const matrix = new THREE.Matrix4()
    const flatDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    bars.forEach((bar, i) => {
      matrix.compose(
        new THREE.Vector3(bar.x, 0, bar.z),
        flatDown,
        new THREE.Vector3(bar.width, bar.depth, 1),
      )
      walls.setMatrixAt(i, matrix)
    })
    walls.instanceMatrix.needsUpdate = true
    scene.add(walls)

    // --- dots and fruit -----------------------------------------------------
    const { dots, power } = edibleCells()

    const pellets = new THREE.InstancedMesh(
      plane,
      new THREE.MeshBasicMaterial({ color: DOT_COLOUR }),
      dots.length,
    )
    pellets.renderOrder = 1
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
        built.group.scale.setScalar(0.95)
        scene.add(built.group)
        return built
      })
    }
    dressFruit(levelRef.current)
    fruitRef.current = dressFruit

    // --- characters ---------------------------------------------------------
    const player = buildPlayer()
    player.group.position.y = ACTOR_HEIGHT
    scene.add(player.group)

    const ghosts: { normal: Ghost; scared: Ghost }[] = GHOSTS.map((spec) => {
      const normal = buildGhost(new THREE.Color(spec.colour).getHex())
      const scared = buildGhost(FRIGHTENED_COLOUR)
      normal.group.position.y = ACTOR_HEIGHT
      scared.group.position.y = ACTOR_HEIGHT
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

      const height = (el: HTMLElement | null) => el?.getBoundingClientRect().height ?? 0

      // Exactly the maze, with no margin left or right: the tunnel mouths sit
      // on the very edge of the screen, so walking out of one side really is
      // walking off the edge of the phone.
      const spanX = WIDTH
      const spanY = HEIGHT

      const { frustum } = fitBoard(w, h, spanX, spanY, {
        top: height(hudRef.current),
        bottom: height(extrasRef.current),
        left: 0,
        right: 0,
      })

      camera.left = frustum.left
      camera.right = frustum.right
      camera.top = frustum.top
      camera.bottom = frustum.bottom
      camera.updateProjectionMatrix()

      const centre = new THREE.Vector3(WIDTH / 2 - 0.5, 0, HEIGHT / 2 - 0.5)
      camera.position.set(centre.x, 60, centre.z)
      camera.lookAt(centre)
      // Looking straight down, "up" on screen has to be named explicitly or
      // the camera has no way to choose one.
      camera.up.set(0, 0, -1)
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
        let previous = game
        while (carry >= FIXED) {
          previous = next
          next = step(next, FIXED)
          carry -= FIXED
        }
        gameRef.current = next

        // How far into the slice that has not been simulated yet this frame
        // falls. Everything below is drawn at that point between the last two
        // states, which is what keeps the motion even at any frame rate.
        const alpha = carry / FIXED

        if (next.status !== before && before === 'playing') {
          const moment: TauntMoment =
            next.status === 'gameOver' ? 'gameOver' : next.status === 'levelComplete' ? 'levelDone' : 'caught'
          const line = fill(taunt(moment))
          setMessage(line)
          say(line, { as: 'papa' })
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
        const dotSize = new THREE.Vector3(0.16, 0.16, 1)
        dots.forEach((cell, i) => {
          matrix.compose(
            new THREE.Vector3(cell.x, 0.01, cell.y),
            flatDown,
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
          one.group.position.y = 0.02
        })

        const at = positionBetween(previous.player, next.player, alpha)
        player.group.position.set(at.x, ACTOR_HEIGHT, at.y)
        player.group.rotation.set(0, facingAngle(next.player.dir), 0)
        // Four chomps a second, and only while there is something to chomp at.
        if (next.status === 'playing') player.animate((now / 250) % 1)

        // Where he is on screen, for a tap to be measured against.
        const projected = new THREE.Vector3(at.x, ACTOR_HEIGHT, at.y).project(camera)
        const rect = renderer.domElement
        playerOnScreen.current = toScreen(
          projected,
          (v) => v,
          { width: rect.clientWidth, height: rect.clientHeight },
        )

        next.ghosts.forEach((ghost, i) => {
          const body = ghosts[i]
          const pos = positionBetween(previous.ghosts[i] ?? ghost, ghost, alpha)
          const hidden = ghost.eatenFor > 0
          const scared = ghost.frightened

          body.normal.group.visible = !hidden && !scared
          body.scared.group.visible = !hidden && scared

          const active = scared ? body.scared : body.normal
          active.group.position.set(pos.x, ACTOR_HEIGHT, pos.y)
          // A chaser never turns to face its way: it always faces the screen
          // and only its eyes move, which is exactly how the original reads.
          active.animate((now / 400 + i * 0.25) % 1)
          active.look(STEP_OF[ghost.dir].x, STEP_OF[ghost.dir].y)
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
      player.dispose()
      for (const body of ghosts) {
        body.normal.dispose()
        body.scared.dispose()
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
    // The hint has done its job the moment he steers once.
    setShowHint(false)
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

  /*
   * Touch anywhere. There are no buttons.
   *
   * Tap to one side of the player and he goes that way; drag and he follows
   * the drag. Both are measured in screen pixels against where he is actually
   * drawn, so the gesture means the same thing wherever he has got to in the
   * maze. A phone already knows how to do this; it does not need a d-pad
   * painted on top of it.
   */
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  /**
   * Whether this touch has already steered by being dragged.
   *
   * Without it, every drag fired a second, unasked-for direction the moment
   * the finger came up: the drag handler had moved the start point along to
   * keep up, so by the time of the release the finger had barely travelled,
   * the release read as a *tap*, and the tap sent him wherever the thumb
   * happened to be resting relative to him. Swipe up, turn up, and then
   * immediately turn somewhere else. It is the worst of the three control
   * faults and the hardest to see, because it only shows up at the end of a
   * gesture that had just worked.
   */
  const dragged = useRef(false)

  const onDown = (e: React.PointerEvent) => {
    touchStart.current = { x: e.clientX, y: e.clientY }
    dragged.current = false
  }

  const onUp = (e: React.PointerEvent) => {
    const from = touchStart.current
    const wasDragged = dragged.current
    touchStart.current = null
    dragged.current = false
    if (!from || wasDragged) return
    const dir = directionFromGesture(
      from,
      { x: e.clientX, y: e.clientY },
      playerOnScreen.current,
      gameRef.current?.player.dir,
    )
    if (dir) push(dir)
  }

  // A drag steers as it happens rather than waiting for the finger to lift, so
  // holding a direction feels like holding a direction.
  const onMove = (e: React.PointerEvent) => {
    const from = touchStart.current
    if (!from) return
    const to = { x: e.clientX, y: e.clientY }
    const dir = directionFromSwipe(from, to)
    if (dir) {
      push(dir)
      touchStart.current = to
      if (!dragged.current) {
        dragged.current = true
        /*
         * Capture only once this is definitely a drag, so the moves keep
         * coming even if the finger slides off the board.
         *
         * Capturing on the way down instead breaks every button on the screen:
         * the release gets retargeted to whatever captured the pointer, so the
         * browser fires the click on that rather than on the button under the
         * finger. It cost the Shop button on the death screen, which is the
         * only way in to the maths, and nothing said a word about it.
         */
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      }
    }
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
    <div
      className="relative flex h-full w-full touch-none select-none flex-col overflow-hidden"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        touchStart.current = null
        dragged.current = false
      }}
    >
      <div ref={mountRef} className="absolute inset-0" />

      {/*
        * The score above, the lives below, and nothing else.
        *
        * There were a Shop button and a settings gear sitting over the board.
        * The arcade puts nothing on screen but the numbers you are playing
        * for, and it was right: a button is an invitation to stop playing.
        * The shop is still there — it is offered when a life is lost, which is
        * where it belongs anyway.
        */}
      <header
        ref={hudRef}
        className="pointer-events-none relative z-10 flex items-start justify-between px-4 pt-2 font-mono text-sm uppercase tracking-widest text-chalk"
      >
        <div>
          <p className="text-[0.65rem] text-dim">1up</p>
          <p className="text-base leading-none">{hud.score}</p>
        </div>
        <div className="text-center">
          <p className="text-[0.65rem] text-dim">high score</p>
          <p className="text-base leading-none">{Math.max(save.arcade.highScore, hud.score)}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] text-dim">level</p>
          <p className="text-base leading-none">{run?.level ?? 1}</p>
        </div>
      </header>

      <div className="flex-1" />

      <footer
        ref={extrasRef}
        className="pointer-events-none relative z-10 flex items-center justify-between px-4 pb-2"
      >
        {/* Lives left, drawn as the player himself, exactly as the arcade does. */}
        <div className="flex items-center gap-1.5" aria-label={`${Math.max(0, hud.lives)} lives left`}>
          {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
            <PlayerIcon key={i} />
          ))}
        </div>

        {showHint && !overlay && (
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-dim">
            tap where you want to go
          </p>
        )}

        <div className="flex items-center gap-3">
          {hud.freezes > 0 && (
            <button
              type="button"
              onClick={() => {
                const game = gameRef.current
                if (game) gameRef.current = useFreeze(game)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="pointer-events-auto rounded-md border border-bolt/60 px-3 py-1 font-mono text-xs uppercase tracking-widest text-bolt"
            >
              freeze {hud.freezes}
            </button>
          )}
          {/*
            * Tucked into the corner where the arcade keeps its collected
            * fruit, and deliberately quiet. A grown-up needs a way in to the
            * voice, the music and the rewards; a child playing does not need
            * to be looking at it.
            */}
          <button
            type="button"
            onClick={() => go('settings')}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            aria-label="Settings"
            className="pointer-events-auto px-2 text-base text-dim/50"
          >
            &#9881;
          </button>
        </div>
      </footer>

      {overlay && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-ink/85 p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
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

/**
 * Which way the player's mouth points.
 *
 * Seen from straight above with z running down the screen, a turn is a
 * rotation about the world's vertical. Right is where the wedge sits when it
 * is built, and the rest follow round from there.
 */
function facingAngle(dir: Dir): number {
  return { right: 0, down: -Math.PI / 2, left: Math.PI, up: Math.PI / 2 }[dir]
}

/** One tile in each direction, for pointing a chaser's eyes. */
const STEP_OF: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

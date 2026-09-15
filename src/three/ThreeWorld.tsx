import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Point } from '../world/map'
import type { Scene as TileScene } from '../world/render'
import { useWalker, STEP } from '../world/useWalker'
import { buildVoxel, disposeVoxel, type Voxel } from './voxel'
import { PLAYER_PALETTE, PLAYER_SEED } from '../world/render'

/**
 * The world, in three dimensions.
 *
 * Same game, same tile grid, same inputs — the flat map is simply extruded.
 * Walls become blocks, characters become the voxel bodies grown from their own
 * sprites, and a camera sits behind and above the player.
 *
 * Everything static is built once into instanced meshes; only characters and
 * the camera move per frame, which keeps a tablet comfortable.
 */

export interface ThreeWorldProps {
  blocked: (point: Point) => boolean
  buildScene: (player: { x: number; y: number }, facing: Point) => TileScene
  actionLabel: (facing: Point, standingOn: Point) => string | null
  onAction: (facing: Point, standingOn: Point) => void
  controlsVisible: boolean
  onMove?: (to: Point) => void
  start: Point
}

// Low enough to see over from the landing. The room numbers are the puzzle, so
// a wall that hides them is a wall that breaks the game.
const WALL_H = 1.05
const FLOOR_H = 0.25

export function ThreeWorld({
  blocked,
  buildScene,
  actionLabel,
  onAction,
  controlsVisible,
  onMove,
  start,
}: ThreeWorldProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const walker = useWalker(start, onAction)

  const latest = useRef({ blocked, buildScene, actionLabel, controlsVisible, onMove })
  latest.current = { blocked, buildScene, actionLabel, controlsVisible, onMove }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#9fd0f5')
    scene.fog = new THREE.Fog('#9fd0f5', 22, 46)

    // Bright and warm. The old flat palette was the main reason it read as a
    // worksheet rather than a game.
    scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b5a45, 1.9))
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.5)
    sun.position.set(6, 14, 8)
    scene.add(sun)

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120)
    camera.position.set(start.x, 10.4, start.y + 10)
    camera.lookAt(start.x, 0.6, start.y - 0.8)

    // --- static geometry, rebuilt only when the map changes -----------------
    const statics = new THREE.Group()
    scene.add(statics)
    let builtRows: readonly string[] | null = null

    const buildStatics = (rows: readonly string[], tint?: TileScene['floorTint']) => {
      statics.clear()
      const cube = new THREE.BoxGeometry(1, 1, 1)

      const floors: { x: number; y: number; colour: THREE.Color }[] = []
      const walls: { x: number; y: number; colour: THREE.Color }[] = []
      const warm = new THREE.Color('#c9a227')

      const nearbyTint = (x: number, y: number): string | undefined =>
        tint?.(x, y - 1) ?? tint?.(x, y + 1) ?? tint?.(x - 1, y) ?? tint?.(x + 1, y)

      rows.forEach((row, y) =>
        [...row].forEach((tile, x) => {
          if (tile === '#') {
            const near = nearbyTint(x, y)
            const colour = near ? new THREE.Color(near) : new THREE.Color('#efe4d2')
            // Walls a shade deeper than their floor, so edges stay readable.
            colour.multiplyScalar(0.88)
            walls.push({ x, y, colour })
          } else if (tile === '=') {
            floors.push({ x, y, colour: new THREE.Color('#8a6a3e') })
          } else if (tile !== ' ') {
            const hint = tint?.(x, y)
            floors.push({ x, y, colour: new THREE.Color(hint ?? '#f0e2c8') })
          }
          if (tile === 'D') floors.push({ x, y, colour: warm })
        }),
      )

      const add = (
        cells: typeof floors,
        height: number,
        y0: number,
        material: THREE.Material,
      ) => {
        const mesh = new THREE.InstancedMesh(cube, material, cells.length)
        const m = new THREE.Matrix4()
        const s = new THREE.Vector3(1, height, 1)
        const q = new THREE.Quaternion()
        cells.forEach((cell, i) => {
          m.compose(new THREE.Vector3(cell.x, y0 + height / 2, cell.y), q, s)
          mesh.setMatrixAt(i, m)
          mesh.setColorAt(i, cell.colour)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        statics.add(mesh)
      }

      add(floors, FLOOR_H, -FLOOR_H, new THREE.MeshLambertMaterial({ color: 0xffffff }))
      add(walls, WALL_H, 0, new THREE.MeshLambertMaterial({ color: 0xffffff }))
    }

    // --- floor numerals ------------------------------------------------------
    const labels = new THREE.Group()
    scene.add(labels)
    let labelKey = ''

    const buildLabels = (items: NonNullable<TileScene['floorLabels']>) => {
      labels.clear()
      for (const item of items) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 128
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = item.dim ? 'rgba(70,55,35,0.55)' : 'rgba(20,70,140,0.95)'
        ctx.font = 'bold 96px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.text, 64, 70)

        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 2.1),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }),
        )
        plane.rotation.x = -Math.PI / 2
        plane.position.set(item.at.x, 0.02, item.at.y)
        labels.add(plane)
      }
    }

    // --- characters ----------------------------------------------------------
    const actors = new Map<string, Voxel>()
    const markers = new Map<string, THREE.Mesh>()
    const markerGeometry = new THREE.OctahedronGeometry(0.17)
    const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xffc84a, emissive: 0x5a4210 })

    const player = buildVoxel(PLAYER_SEED, PLAYER_PALETTE)
    scene.add(player.group)

    // --- loop ----------------------------------------------------------------
    const resize = () => {
      const rect = mount.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      camera.aspect = rect.width / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    let frame = 0
    const loop = () => {
      const now = performance.now()
      const api = latest.current

      walker.tick(now, api.controlsVisible, api.blocked, api.onMove)

      const face = walker.facingPoint()
      const view = api.buildScene(walker.shown.current, face)
      walker.setPrompt(api.actionLabel(face, walker.tile.current))

      if (view.rows !== builtRows) {
        builtRows = view.rows
        buildStatics(view.rows, view.floorTint)
      }

      const key = (view.floorLabels ?? []).map((l) => `${l.at.x},${l.at.y},${l.text},${l.dim}`).join('|')
      if (key !== labelKey) {
        labelKey = key
        buildLabels(view.floorLabels ?? [])
      }

      // Characters, reconciled by key so they persist between frames.
      const seen = new Set<string>()
      for (const actor of view.actors) {
        seen.add(actor.key)
        let voxel = actors.get(actor.key)
        if (!voxel) {
          voxel = buildVoxel(actor.seed, actor.palette)
          actors.set(actor.key, voxel)
          scene.add(voxel.group)
        }

        const bob = Math.sin(now / 420 + actor.at.x) * 0.06
        const shake = actor.agitated ? Math.sin(now / 55) * 0.07 : 0
        voxel.group.position.set(actor.at.x + shake, 0.62 + bob, actor.at.y)
        voxel.group.rotation.set(-0.22, Math.sin(now / 900 + actor.at.y) * 0.12, 0)

        if (actor.marker) {
          let marker = markers.get(actor.key)
          if (!marker) {
            marker = new THREE.Mesh(markerGeometry, markerMaterial)
            markers.set(actor.key, marker)
            scene.add(marker)
          }
          marker.visible = true
          marker.position.set(actor.at.x, 1.5 + Math.sin(now / 300) * 0.12, actor.at.y)
          marker.rotation.y = now / 700
        } else {
          const marker = markers.get(actor.key)
          if (marker) marker.visible = false
        }
      }

      for (const [key, voxel] of actors) {
        if (!seen.has(key)) {
          scene.remove(voxel.group)
          disposeVoxel(voxel)
          actors.delete(key)
          const marker = markers.get(key)
          if (marker) { scene.remove(marker); markers.delete(key) }
        }
      }

      // The player hops as he walks, which sells movement more than any easing.
      const hop = Math.sin(walker.progress.current * Math.PI) * 0.22
      const idle = Math.sin(now / 480) * 0.045
      player.group.position.set(
        view.player.x,
        0.62 + (walker.progress.current > 0 ? hop : idle),
        view.player.y,
      )
      const dir = STEP[walker.facing.current]
      player.group.rotation.set(-0.22, Math.atan2(dir.x, dir.y) + Math.PI, 0)

      // Camera trails behind and above, easing so it never snaps.
      const want = new THREE.Vector3(view.player.x, 10.4, view.player.y + 10)
      camera.position.lerp(want, 0.12)
      camera.lookAt(view.player.x, 0.4, view.player.y - 2.4)

      renderer.render(scene, camera)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const voxel of actors.values()) disposeVoxel(voxel)
      disposeVoxel(player)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [walker])

  return (
    <>
      <div ref={mountRef} className="absolute inset-0" />

      {controlsVisible && (
        <div className="relative z-10 mt-auto flex items-end justify-between p-4">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {([[null, 'up', null], ['left', null, 'right'], [null, 'down', null]] as const)
              .flat()
              .map((dir, i) =>
                dir ? (
                  <button
                    key={i}
                    type="button"
                    aria-label={dir}
                    onPointerDown={walker.hold(dir)}
                    onPointerUp={walker.hold(null)}
                    onPointerLeave={walker.hold(null)}
                    onPointerCancel={walker.hold(null)}
                    className="block-btn h-[58px] w-[58px] bg-ink-soft/85 p-0 text-lg backdrop-blur"
                  >
                    {{ up: '▲', down: '▼', left: '◀', right: '▶' }[dir]}
                  </button>
                ) : (
                  <span key={i} />
                ),
              )}
          </div>

          <button
            type="button"
            onClick={walker.act}
            disabled={!walker.prompt}
            className={`block-btn h-[92px] min-w-[92px] whitespace-pre-line rounded-full px-4 text-sm font-bold leading-tight ${
              walker.prompt ? 'border-bolt bg-bolt text-ink' : 'bg-ink-soft/70 opacity-40 backdrop-blur'
            }`}
          >
            {walker.prompt ?? ''}
          </button>
        </div>
      )}
    </>
  )
}

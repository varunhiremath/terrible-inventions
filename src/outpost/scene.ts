/**
 * The outpost, built.
 *
 * Night, and everything in it made out of three.js primitives and arithmetic —
 * no models, no textures off disk, no image files, same as the rest of this
 * app. What makes it a place rather than a diagram is almost entirely light:
 * a compound at dusk is dark ground, hard pools of floodlight, warm windows,
 * and whatever is glowing at you out of the gaps between.
 *
 * The rules this was built to:
 *
 *  - Dark, but never black. There is a moon, a sky that is bluer overhead than
 *    at the horizon, and bounced light off the ground, so the shape of things
 *    reads even where no lamp reaches. A game that is actually dark is a game
 *    played by walking into walls.
 *  - Everything that matters to the player glows. The machines' eyes, the
 *    numbers they carry, the fuses on the floor, the cage, the pad you have to
 *    get back to. You can always find the next thing to do by looking for the
 *    light.
 *  - Nothing is drawn that does not exist in the simulation. The floodlights
 *    light the yard and do not see you; there are no sweeping searchlights,
 *    because a searchlight that cannot catch you is a mechanic drawn on the
 *    wall. This project has made that mistake with gates and with crates and
 *    is not making it again.
 *  - Cheap. One instanced mesh for every wall in the compound, one for the
 *    crates, no shadows, no post-processing. A beautiful outpost at nine frames
 *    a second is worse than a plain one at sixty.
 */
import * as THREE from 'three'
import { BUILD, CELL, EYE, at, middleOf, type Machine, type Map } from './level'
import type { Run } from './run'

export interface Outpost {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update(run: Run, clock: number): void
  resize(w: number, h: number): void
  dispose(): void
}

const NIGHT_HIGH = new THREE.Color('#0a1430')
const NIGHT_LOW = new THREE.Color('#2a3d63')
const HAZE = new THREE.Color('#1b2a4a')

/** Deterministic noise, so the same compound looks the same every time. */
function wobble(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** The night sky, as a dome with the gradient painted into its vertices. */
function buildSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(420, 24, 16)
  const colours: number[] = []
  const position = geometry.attributes.position
  const up = new THREE.Vector3()
  const colour = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    up.fromBufferAttribute(position, i).normalize()
    colour.copy(NIGHT_LOW).lerp(NIGHT_HIGH, Math.pow(Math.max(0, up.y), 0.5))
    colours.push(colour.r, colour.g, colour.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  )
}

/** Stars, as one set of points. The cheapest thing in the whole scene. */
function buildStars(): THREE.Points {
  const spots: number[] = []
  for (let i = 0; i < 420; i++) {
    const a = wobble(i * 3) * Math.PI * 2
    const up = Math.pow(wobble(i * 5 + 1), 0.6) * 0.9 + 0.05
    const flat = Math.sqrt(1 - up * up)
    spots.push(Math.cos(a) * flat * 390, up * 390, Math.sin(a) * flat * 390)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(spots, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#dfe8ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85,
  }))
}

/** A soft round glow, for the moon, the lamps and anything that has to bloom. */
function glowTexture(ink: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    /*
     * Softened right through. A glow with a solid core reads as a white ball
     * stuck on the front of whatever it belongs to — which is what the cage
     * and every fuse on the floor looked like — rather than as light coming
     * off it.
     */
    const soft = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    soft.addColorStop(0, ink.replace(/[\d.]+\)$/, '0.7)'))
    soft.addColorStop(0.3, ink.replace(/[\d.]+\)$/, '0.3)'))
    soft.addColorStop(1, ink.replace(/[\d.]+\)$/, '0)'))
    ctx.fillStyle = soft
    ctx.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A number, drawn on a little canvas, to hang over something. */
function numberSprite(n: number, ink: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = 'bold 84px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 16
    ctx.strokeStyle = 'rgba(6,10,20,0.9)'
    ctx.strokeText(String(n), 64, 68)
    ctx.fillStyle = ink
    ctx.fillText(String(n), 64, 68)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false,
  }))
}

/** Tarmac: a square of mottled grey, tiled over the whole compound. */
function groundTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#2b2f36'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 700; i++) {
      const x = wobble(i * 3 + 1) * 256
      const y = wobble(i * 5 + 2) * 256
      const r = 2 + wobble(i * 7 + 3) * 14
      const light = wobble(i * 11 + 4)
      ctx.fillStyle = light > 0.5
        ? `rgba(76,82,92,${0.1 + light * 0.22})`
        : `rgba(22,25,30,${0.1 + light * 0.3})`
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.5 + light * 0.8), light * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    // A few cracks, because a flat surface at this size needs a line on it.
    ctx.strokeStyle = 'rgba(18,20,24,0.5)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      ctx.moveTo(wobble(i * 13) * 256, wobble(i * 17) * 256)
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(wobble(i * 19 + j) * 256, wobble(i * 23 + j) * 256)
      }
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

interface Shown {
  group: THREE.Group
  eye: THREE.Mesh
  label: THREE.Sprite
  glow: THREE.Sprite
  body: THREE.Group
}

export function buildOutpost(run: Run, width: number, height: number): Outpost {
  const map: Map = run.map
  const across = map.wide * CELL
  const down = map.tall * CELL

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(HAZE, 18, 115)

  const camera = new THREE.PerspectiveCamera(74, width / height, 0.08, 700)
  camera.position.set(0, EYE, 0)

  scene.add(buildSky())
  scene.add(buildStars())

  // --- light ----------------------------------------------------------------
  /*
   * Moonlight and a bounce, and that is all the light there is in the compound
   * that is not a lamp on a pole. Cool from above, slightly warm from the
   * ground, which is what stops the unlit side of everything going flat black.
   */
  const moon = new THREE.DirectionalLight('#cfddff', 1.2)
  moon.position.set(-60, 80, 40)
  scene.add(moon)
  /*
   * And a strong bounce. The first go at this was lit the way a night really
   * is and the compound came out as black boxes with lamps between them: you
   * could not tell a building from a gap, which in a game about walking round
   * corners is the whole of it. Night in a game is dark *blue*, never black.
   */
  scene.add(new THREE.HemisphereLight('#6c86bd', '#3a3630', 1.15))

  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(234,242,255,1)'), transparent: true, depthWrite: false, fog: false,
  }))
  moonDisc.position.set(-230, 240, 160)
  moonDisc.scale.setScalar(90)
  scene.add(moonDisc)

  // --- the ground -----------------------------------------------------------
  const tarmac = groundTexture()
  tarmac.repeat.set(map.wide, map.tall)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(across, down),
    new THREE.MeshLambertMaterial({ color: '#c9ced8', map: tarmac }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(across / 2, 0, down / 2)
  scene.add(ground)

  // Scrub outside the wall, so the compound sits in somewhere rather than on
  // nothing. Dark, and only ever seen over the top of the wall.
  const outside = new THREE.Mesh(
    new THREE.CircleGeometry(340, 40),
    new THREE.MeshLambertMaterial({ color: '#1d2a1c' }),
  )
  outside.rotation.x = -Math.PI / 2
  outside.position.set(across / 2, -0.06, down / 2)
  scene.add(outside)

  // --- the walls ------------------------------------------------------------
  /*
   * Every wall cell in the compound in one instanced mesh, and every crate in
   * another. A compound is six or seven hundred blocks; drawn one at a time
   * that is six or seven hundred draw calls before anything else happens.
   */
  const wallCells: { x: number; y: number; outer: boolean }[] = []
  const crateCells: { x: number; y: number }[] = []
  for (let y = 0; y < map.tall; y++) {
    for (let x = 0; x < map.wide; x++) {
      const cell = at(map, x, y)
      if (cell === 'wall') {
        wallCells.push({
          x, y, outer: x === 0 || y === 0 || x === map.wide - 1 || y === map.tall - 1,
        })
      } else if (cell === 'crate') crateCells.push({ x, y })
    }
  }

  const WALL_H = 4.6
  const block = new THREE.BoxGeometry(CELL, WALL_H, CELL)
  /*
   * No `vertexColors` here, however much it looks like it wants one.
   *
   * Per-instance colour on an instanced mesh comes from `instanceColor` and
   * three.js wires that up by itself; asking for vertex colours as well sends
   * the shader looking for an attribute the geometry has not got, and every
   * block in the compound renders black. Which it did — a whole outpost of
   * silhouettes, lit lamps hanging in front of nothing. It is written down in
   * CLAUDE.md from the last time, too.
   */
  const walls = new THREE.InstancedMesh(
    block,
    new THREE.MeshLambertMaterial({ color: '#616877' }),
    wallCells.length,
  )
  const place = new THREE.Matrix4()
  const tint = new THREE.Color()
  for (const [i, cell] of wallCells.entries()) {
    const where = middleOf({ x: cell.x, y: cell.y })
    const tall = cell.outer ? WALL_H * 1.25 : WALL_H * (0.8 + wobble(i * 7) * 0.45)
    place.makeTranslation(where.x, tall / 2 - 0.2, where.z)
    place.scale(new THREE.Vector3(1, tall / WALL_H, 1))
    walls.setMatrixAt(i, place)
    // Concrete, in two or three shades. One shade over a whole compound is a
    // wall of fog; this is what gives the buildings edges at night.
    // Concrete, in a narrow spread of shades. Wide and it is a patchwork;
    // none at all and a compound is one flat wall with corners drawn on it.
    const shade = 0.82 + wobble(i * 13 + 2) * 0.18
    tint.setRGB(shade * 0.92, shade * 0.95, shade)
    walls.setColorAt(i, tint)
  }
  walls.instanceMatrix.needsUpdate = true
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true
  scene.add(walls)

  /*
   * A pale coping along the top of every wall.
   *
   * One more instanced mesh, and it is what turns a flat slab into a thing
   * with a top: at night the line where a wall stops is the only way to tell
   * how tall it is, and therefore how far away.
   */
  const coping = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 1.04, 0.28, CELL * 1.04),
    new THREE.MeshLambertMaterial({ color: '#aeb7c6' }),
    wallCells.length,
  )
  for (const [i, cell] of wallCells.entries()) {
    const where = middleOf({ x: cell.x, y: cell.y })
    const tall = cell.outer ? WALL_H * 1.25 : WALL_H * (0.8 + wobble(i * 7) * 0.45)
    place.makeTranslation(where.x, tall - 0.2, where.z)
    coping.setMatrixAt(i, place)
  }
  coping.instanceMatrix.needsUpdate = true
  scene.add(coping)

  if (crateCells.length > 0) {
    const crate = new THREE.BoxGeometry(CELL * 0.78, 1.5, CELL * 0.78)
    const crates = new THREE.InstancedMesh(
      crate,
      new THREE.MeshLambertMaterial({ color: '#7a5a34' }),
      crateCells.length,
    )
    for (const [i, cell] of crateCells.entries()) {
      const where = middleOf({ x: cell.x, y: cell.y })
      place.makeRotationY(wobble(i * 3) * 0.5 - 0.25)
      place.setPosition(where.x, 0.74, where.z)
      crates.setMatrixAt(i, place)
    }
    crates.instanceMatrix.needsUpdate = true
    scene.add(crates)
  }

  /*
   * Windows: a lit panel on the side of some of the inner blocks, facing
   * whichever way is open. They are the one thing in the compound that says
   * somebody built it rather than that it was generated, and they cost a
   * quad each.
   */
  const paneGeometry = new THREE.PlaneGeometry(CELL * 0.4, 0.75)
  const paneInk = new THREE.MeshBasicMaterial({ color: '#ffc46a', fog: true })
  for (const [i, cell] of wallCells.entries()) {
    if (cell.outer || wobble(i * 29) > 0.3) continue
    const sides: [number, number, number][] = [
      [0, -1, 0], [0, 1, Math.PI], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2],
    ]
    for (const [dx, dy, turn] of sides) {
      if (at(map, cell.x + dx, cell.y + dy) === 'wall') continue
      const where = middleOf({ x: cell.x, y: cell.y })
      const pane = new THREE.Mesh(paneGeometry, paneInk)
      pane.position.set(where.x + dx * (CELL / 2 + 0.02), 2.3, where.z + dy * (CELL / 2 + 0.02))
      pane.rotation.y = turn
      scene.add(pane)
      break
    }
  }

  // --- lamps ----------------------------------------------------------------
  /*
   * Floodlights on poles. They are the reason the yard is readable at all, and
   * the pools they throw are the map: you learn a compound by which lamp is
   * where. They do not see you — nothing in this game sees you except a
   * machine that is looking at you — so they are placed where the light is
   * useful rather than where a guard would want it.
   */
  const lampGlow = glowTexture('rgba(255,214,150,0.95)')
  const poles = new THREE.Group()
  const lampAt = (x: number, z: number) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 6, 6),
      new THREE.MeshLambertMaterial({ color: '#3a3f4a' }),
    )
    pole.position.set(x, 3, z)
    poles.add(pole)
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: '#ffd089' }),
    )
    head.position.set(x, 5.9, z)
    poles.add(head)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lampGlow, transparent: true, depthWrite: false,
    }))
    halo.position.set(x, 5.9, z)
    halo.scale.setScalar(3.2)
    poles.add(halo)
    // The pool on the ground, which is a flat disc and fools everybody.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 20),
      new THREE.MeshBasicMaterial({
        map: lampGlow, transparent: true, opacity: 0.26, depthWrite: false,
      }),
    )
    pool.rotation.x = -Math.PI / 2
    pool.position.set(x, 0.04, z)
    poles.add(pool)
    const light = new THREE.PointLight('#ffce8a', 26, 22, 2)
    light.position.set(x, 5.4, z)
    poles.add(light)
  }
  for (let i = 0; i < 6; i++) {
    const spot = {
      x: 3 + Math.floor(wobble(i * 31) * (map.wide - 6)),
      y: 3 + Math.floor(wobble(i * 37 + 1) * (map.tall - 6)),
    }
    if (at(map, spot.x, spot.y) !== 'floor') continue
    const where = middleOf(spot)
    lampAt(where.x, where.z)
  }
  scene.add(poles)

  // --- the landing pad ------------------------------------------------------
  const pad = middleOf(map.pad)
  const padMark = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.6, 28),
    new THREE.MeshBasicMaterial({ color: '#7ef0c0', transparent: true, opacity: 0.8 }),
  )
  padMark.rotation.x = -Math.PI / 2
  padMark.position.set(pad.x, 0.06, pad.z)
  scene.add(padMark)
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(126,240,192,1)'), transparent: true, depthWrite: false,
  }))
  beacon.position.set(pad.x, 2.2, pad.z)
  beacon.scale.setScalar(1.8)
  scene.add(beacon)

  // --- the cage -------------------------------------------------------------
  const cage = middleOf(map.cage)
  const cageGroup = new THREE.Group()
  /*
   * A cage, barred on all four sides.
   *
   * It started as a box with a row of bars across the front, which is fine
   * from the one angle it was drawn for and is a shed from every other — and
   * you come at this thing from wherever the yard lets you. Four sides of bars
   * and a solid roof: unmistakable from any direction, and lit from inside so
   * that it is the brightest thing in the compound.
   */
  const barInk = new THREE.MeshLambertMaterial({ color: '#aab3c5' })
  const bars = new THREE.Group()
  const SPAN = 2.6
  for (const side of [0, 1, 2, 3]) {
    const turn = (side * Math.PI) / 2
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.5, 5), barInk)
      const along = -SPAN / 2 + 0.26 + i * ((SPAN - 0.52) / 5)
      bar.position.set(
        Math.cos(turn) * along + Math.sin(turn) * (SPAN / 2),
        1.25,
        -Math.sin(turn) * along + Math.cos(turn) * (SPAN / 2),
      )
      bars.add(bar)
    }
  }
  // Corner posts and a rail at top and bottom, so it holds together.
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), barInk)
    post.position.set((cx * SPAN) / 2, 1.3, (cz * SPAN) / 2)
    bars.add(post)
  }
  cageGroup.add(bars)

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(SPAN + 0.5, 0.28, SPAN + 0.5),
    new THREE.MeshLambertMaterial({ color: '#4a5260' }),
  )
  roof.position.y = 2.7
  cageGroup.add(roof)
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(SPAN + 0.4, 0.16, SPAN + 0.4),
    new THREE.MeshLambertMaterial({ color: '#555d6b' }),
  )
  slab.position.y = 0.08
  cageGroup.add(slab)

  // Lit from inside, which is the only reason you can find it across a dark
  // compound, and the thing the whole mission is pointed at.
  const cageLight = new THREE.PointLight('#ffd89a', 9, 13, 2)
  cageLight.position.set(0, 1.8, 0)
  cageGroup.add(cageLight)
  const cageGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,216,154,1)'),
    transparent: true, depthWrite: false, opacity: 0.8,
  }))
  cageGlow.position.set(0, 1.5, 0)
  cageGlow.scale.setScalar(3.4)
  cageGroup.add(cageGlow)
  // What the door is asking for, written over it.
  const wantsLabel = numberSprite(run.wants, '#ffe9b0')
  wantsLabel.position.set(0, 3.6, 0)
  wantsLabel.scale.setScalar(1.3)
  cageGroup.add(wantsLabel)
  cageGroup.position.set(cage.x, 0, cage.z)
  scene.add(cageGroup)

  // --- her ------------------------------------------------------------------
  /*
   * The only person in the compound. A coat, a head and a scarf, kept simple
   * on purpose: this is somebody's nan, not a character study, and the one
   * thing she has to do is be unmistakably a person among machines.
   */
  const person = new THREE.Group()
  const coat = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.33, 0.7, 4, 10),
    new THREE.MeshLambertMaterial({ color: '#b65a7a' }),
  )
  coat.position.y = 0.85
  person.add(coat)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshLambertMaterial({ color: '#e8c9a8' }),
  )
  head.position.y = 1.5
  person.add(head)
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.07, 6, 12),
    new THREE.MeshLambertMaterial({ color: '#f0e6d2' }),
  )
  scarf.position.y = 1.3
  scarf.rotation.x = Math.PI / 2
  person.add(scarf)
  const herGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,196,214,1)'), transparent: true, depthWrite: false,
  }))
  herGlow.position.y = 1.1
  herGlow.scale.setScalar(1.8)
  person.add(herGlow)
  person.position.set(cage.x, 0, cage.z)
  scene.add(person)

  // --- the machines ---------------------------------------------------------
  const eyeGlow = glowTexture('rgba(255,120,90,1)')
  const shown = new globalThis.Map<number, Shown>()

  const makeMachine = (machine: Machine): Shown => {
    const build = BUILD[machine.breed]
    const size = build.size
    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(size * 1.1, size * 1.0, size * 0.9),
      // Matt rather than polished: a shiny box two metres from a torch is a
      // white rectangle, and these are meant to be found by their eyes.
      new THREE.MeshPhongMaterial({ color: '#58606e', shininess: 14, specular: '#5c6472' }),
    )
    shell.position.y = size * 1.15
    body.add(shell)

    // The head, which is mostly the eye.
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.16, size * 0.2, size * 0.4, 6),
      new THREE.MeshLambertMaterial({ color: '#3d4450' }),
    )
    neck.position.y = size * 1.8
    body.add(neck)
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.26, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffb061' }),
    )
    eye.position.set(0, size * 2.05, -size * 0.2)
    body.add(eye)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: eyeGlow, transparent: true, depthWrite: false,
    }))
    glow.position.copy(eye.position)
    glow.scale.setScalar(size * 2.4)
    body.add(glow)

    // Legs, or a skirt of them for the big one. Straight sticks: they do not
    // animate, and at the ranges this game is played at nobody has ever
    // noticed. Bending them would cost more than it would buy.
    const legInk = new THREE.MeshLambertMaterial({ color: '#39404c' })
    const legs = machine.breed === 'sentry' ? 4 : 2
    for (let i = 0; i < legs; i++) {
      const a = (i / legs) * Math.PI * 2 + Math.PI / 4
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.1, size * 0.07, size * 1.2, 5), legInk,
      )
      leg.position.set(Math.cos(a) * size * 0.4, size * 0.55, Math.sin(a) * size * 0.4)
      leg.rotation.z = Math.cos(a) * 0.18
      leg.rotation.x = -Math.sin(a) * 0.18
      body.add(leg)
    }

    // And the fuse it is carrying, with its number over it, which is how you
    // know which one to go after.
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.14, size * 0.14, size * 0.4, 6),
      new THREE.MeshBasicMaterial({ color: '#7ef0c0' }),
    )
    fuse.position.set(0, size * 1.2, size * 0.5)
    fuse.rotation.x = Math.PI / 2
    body.add(fuse)

    const label = numberSprite(machine.fuse, '#9af5c0')
    label.position.y = size * 2.9
    label.scale.setScalar(0.85)
    group.add(label)

    scene.add(group)
    return { group, eye, label, glow, body }
  }

  // --- fuses on the ground --------------------------------------------------
  const fuseGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8)
  const fuseInk = new THREE.MeshBasicMaterial({ color: '#9af5c0' })
  const lying = new globalThis.Map<number, { group: THREE.Group; label: THREE.Sprite }>()

  // --- their bolts ----------------------------------------------------------
  const boltGeometry = new THREE.SphereGeometry(0.17, 8, 6)
  const boltInk = new THREE.MeshBasicMaterial({ color: '#ffb061' })
  const boltGlow = glowTexture('rgba(255,150,80,1)')
  const flying = new globalThis.Map<number, THREE.Group>()

  // --- your tracers ---------------------------------------------------------
  const tracerInk = new THREE.MeshBasicMaterial({
    color: '#fff0c0', transparent: true, opacity: 0.9, fog: false,
  })
  const streaks = new globalThis.Map<number, THREE.Mesh>()

  // --- the rifle, in your hands ---------------------------------------------
  /*
   * Held low and to the right, out of the middle of a portrait screen. The
   * meadow learned this the hard way: a phone held upright is about forty
   * degrees across and seventy down, so anything carried in shot has to be
   * placed against the narrow axis or it covers the thing you are aiming at.
   */
  const hands = new THREE.Group()
  camera.add(hands)
  scene.add(camera)

  const gunInk = new THREE.MeshPhongMaterial({ color: '#2f343d', shininess: 30, specular: '#8d97a8' })
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), gunInk)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0.17, -0.2, -0.62)
  hands.add(barrel)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), gunInk)
  receiver.position.set(0.17, -0.235, -0.26)
  hands.add(receiver)
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, 0.3),
    new THREE.MeshLambertMaterial({ color: '#4a3524' }),
  )
  stock.position.set(0.17, -0.27, 0.02)
  hands.add(stock)
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.04), gunInk)
  sight.position.set(0.17, -0.14, -0.4)
  hands.add(sight)

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,228,150,1)'), transparent: true, depthWrite: false, fog: false,
  }))
  flash.position.set(0.17, -0.2, -1.02)
  flash.scale.setScalar(0.9)
  flash.visible = false
  hands.add(flash)
  const flashLight = new THREE.PointLight('#ffd98a', 0, 14, 2)
  flashLight.position.set(0.2, 0, -1)
  camera.add(flashLight)

  /*
   * And a lamp clipped to the rifle. It is a small one and it does not reach
   * far, but the few metres in front of your boots are the difference between
   * walking round a compound and groping round one — and it means the thing
   * that has just come round the corner is lit before it is on top of you.
   */
  const torch = new THREE.PointLight('#cfe0ff', 5.5, 15, 2)
  // Well out in front of the muzzle: sat on the gun it lit the barrel to
  // white and the compound not at all.
  torch.position.set(0.1, -0.1, -1.6)
  camera.add(torch)

  // --- putting the run on the screen ----------------------------------------
  const look = new THREE.Vector3()
  const hurtInk = new THREE.Color('#ff5a4a')

  const update = (now: Run, clock: number) => {
    camera.position.set(now.x, EYE + Math.sin(clock * 7) * 0.012, now.z)
    const flat = Math.cos(now.pitch)
    look.set(
      now.x + Math.sin(now.yaw) * flat,
      EYE + Math.sin(now.pitch),
      now.z - Math.cos(now.yaw) * flat,
    )
    camera.lookAt(look)

    // The gun kicks, and the muzzle lights the wall in front of you.
    const firing = now.flash > 0
    flash.visible = firing
    flashLight.intensity = firing ? 30 : 0
    hands.position.z = firing ? 0.03 : 0
    hands.rotation.x = firing ? -0.035 : 0

    // --- machines ---
    const alive = new Set<number>()
    for (const machine of now.machines) {
      alive.add(machine.id)
      let it = shown.get(machine.id)
      if (!it) {
        it = makeMachine(machine)
        shown.set(machine.id, it)
      }
      it.group.position.set(machine.x, 0, machine.z)
      it.body.rotation.y = machine.facing
      if (machine.down) {
        // Over on its side, with the light going out of it.
        const falling = Math.min(1, machine.since * 3)
        it.body.rotation.z = falling * 1.5
        it.body.position.y = -falling * 0.35
        const fade = Math.max(0, 1 - machine.since * 1.5)
        ;(it.eye.material as THREE.MeshBasicMaterial).color.setRGB(fade * 0.6, fade * 0.2, fade * 0.1)
        it.glow.scale.setScalar(BUILD[machine.breed].size * 1.7 * fade)
        it.label.visible = false
      } else {
        // Amber on its beat, red when it has seen you — and the eye pulses
        // when it is hunting, which is the only warning you get from behind.
        const hunting = machine.alert > 0.3
        const beat = hunting ? 0.75 + Math.sin(clock * 9) * 0.25 : 1
        const ink = it.eye.material as THREE.MeshBasicMaterial
        if (hunting) ink.color.setRGB(1 * beat, 0.28 * beat, 0.2 * beat)
        else ink.color.setRGB(1, 0.69, 0.38)
        it.glow.scale.setScalar(BUILD[machine.breed].size * (hunting ? 2.4 : 1.6) * beat)
        it.label.visible = true
      }
    }
    for (const [id, it] of shown) {
      if (alive.has(id)) continue
      scene.remove(it.group)
      shown.delete(id)
    }

    // --- fuses on the floor ---
    const there = new Set<number>()
    for (const fuse of now.fuses) {
      there.add(fuse.id)
      let it = lying.get(fuse.id)
      if (!it) {
        const group = new THREE.Group()
        const pip = new THREE.Mesh(fuseGeometry, fuseInk)
        pip.rotation.x = Math.PI / 2
        group.add(pip)
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture('rgba(154,245,192,1)'),
          transparent: true, depthWrite: false, opacity: 0.5,
        }))
        halo.scale.setScalar(0.9)
        group.add(halo)
        const label = numberSprite(fuse.number, '#d6ffe8')
        label.position.y = 1
        label.scale.setScalar(0.9)
        group.add(label)
        scene.add(group)
        it = { group, label }
        lying.set(fuse.id, it)
      }
      it.group.position.set(fuse.x, 0.8 + Math.sin(clock * 2.2 + fuse.id) * 0.12, fuse.z)
      it.group.rotation.y = clock * 1.2
    }
    for (const [id, it] of lying) {
      if (there.has(id)) continue
      scene.remove(it.group)
      lying.delete(id)
    }

    // --- bolts ---
    const inAir = new Set<number>()
    for (const bolt of now.bolts) {
      inAir.add(bolt.id)
      let it = flying.get(bolt.id)
      if (!it) {
        it = new THREE.Group()
        it.add(new THREE.Mesh(boltGeometry, boltInk))
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: boltGlow, transparent: true, depthWrite: false, fog: false,
        }))
        halo.scale.setScalar(1.6)
        it.add(halo)
        scene.add(it)
        flying.set(bolt.id, it)
      }
      it.position.set(bolt.x, bolt.y, bolt.z)
    }
    for (const [id, it] of flying) {
      if (inAir.has(id)) continue
      scene.remove(it)
      flying.delete(id)
    }

    // --- tracers ---
    const live = new Set<number>()
    for (const tracer of now.tracers) {
      live.add(tracer.id)
      let line = streaks.get(tracer.id)
      if (!line) {
        line = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.03, 1, 5), tracerInk)
        scene.add(line)
        streaks.set(tracer.id, line)
      }
      const from = new THREE.Vector3(tracer.fromX, tracer.fromY, tracer.fromZ)
      const to = new THREE.Vector3(tracer.toX, tracer.toY, tracer.toZ)
      const along = to.clone().sub(from)
      line.position.copy(from).add(along.clone().multiplyScalar(0.5))
      line.scale.set(1, along.length(), 1)
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.clone().normalize())
    }
    for (const [id, line] of streaks) {
      if (live.has(id)) continue
      scene.remove(line)
      streaks.delete(id)
    }

    // --- her ---
    if (now.friend) {
      person.position.set(now.friend.x, 0, now.friend.z)
      person.rotation.y = Math.atan2(now.x - now.friend.x, -(now.z - now.friend.z))
      // A bob, so she is walking rather than sliding.
      person.position.y = Math.abs(Math.sin(clock * 6)) * 0.06
      bars.visible = false
    } else {
      person.position.set(cage.x, Math.abs(Math.sin(clock * 2)) * 0.03, cage.z)
      person.rotation.y = Math.PI
      bars.visible = true
    }
    wantsLabel.visible = !now.open

    // The pad beacon, which breathes, and goes green-bright once she is out.
    const want = now.open ? 1 : 0.55
    beacon.scale.setScalar((1.6 + Math.sin(clock * 3) * 0.35) * want + 0.9)

    // And a wash of red across everything when you have just been hit.
    const hurt = now.winded > 0 ? Math.min(1, now.winded / 0.9) : 0
    if (hurt > 0) scene.fog = new THREE.Fog(HAZE.clone().lerp(hurtInk, hurt * 0.45), 8, 95)
    else scene.fog = new THREE.Fog(HAZE, 18, 115)
  }

  const resize = (w: number, h: number) => {
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }

  const dispose = () => {
    scene.traverse((thing) => {
      const mesh = thing as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material?.dispose()
    })
  }

  return { scene, camera, update, resize, dispose }
}

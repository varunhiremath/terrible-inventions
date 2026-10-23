/**
 * The meadow, built.
 *
 * Everything on the screen is made here out of three.js primitives and a bit of
 * arithmetic — no models, no textures, no image files, same as the rest of this
 * app. What makes it look like somewhere rather than like a diagram is almost
 * entirely light and distance:
 *
 *  - a sky that is a real gradient dome rather than a flat clear colour, with
 *    the sun actually in it where the light is coming from;
 *  - haze that thickens with distance, so the far hills sit behind the near
 *    ones instead of beside them;
 *  - two lights only, a warm sun and a cool bounce off the grass, which is what
 *    stops the shaded side of a balloon going black;
 *  - a horizon with hills, trees and a lake, all of it lower than your eye, so
 *    the ground reads as ground.
 *
 * It is kept deliberately cheap: a few hundred triangles of scenery, no
 * shadows, no post-processing, low-poly spheres. This runs on a phone, and a
 * beautiful meadow at nine frames a second is worse than a plain one at sixty.
 */
import * as THREE from 'three'
import { BALLOON_R, EYE, ESCAPE_Y, type Balloon } from './level'
import { facing, type Burst, type Run } from './run'

export interface Meadow {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Put the state of a run onto the scene. */
  update(run: Run, alpha: number, clock: number): void
  resize(w: number, h: number): void
  dispose(): void
}

const SKY_TOP = new THREE.Color('#2a5ea8')
const SKY_LOW = new THREE.Color('#bcd8ef')
const HAZE = new THREE.Color('#9fc0dd')

/** Deterministic noise, so the meadow is the same meadow every time. */
function wobble(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * The sky, as a dome with the gradient painted into its vertices.
 *
 * A flat background colour is the single biggest giveaway that a 3D scene is a
 * toy: the real sky is darker overhead than at the horizon, and the eye knows
 * it even when nobody is looking up.
 */
function buildSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(400, 24, 16)
  const colours: number[] = []
  const position = geometry.attributes.position
  const up = new THREE.Vector3()
  const colour = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    up.fromBufferAttribute(position, i).normalize()
    // Flat near the horizon, deep overhead, with the band in between widened
    // so the gradient is felt rather than seen as a line.
    const high = Math.max(0, up.y)
    colour.copy(SKY_LOW).lerp(SKY_TOP, Math.pow(high, 0.55))
    colours.push(colour.r, colour.g, colour.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  )
}

/**
 * Rings of hills around the edge of the world.
 *
 * Three of them, and the important thing is that they are fogged like
 * everything else rather than painted a flat colour: that is what aerial
 * perspective is, and it does more for the feeling of distance than any amount
 * of detail would. The far ridge comes out nearly the colour of the sky, which
 * is exactly what a real one does.
 */
function buildHills(): THREE.Group {
  const hills = new THREE.Group()
  const rings: { at: number; high: number; ink: string }[] = [
    { at: 95, high: 16, ink: '#5f8a52' },
    { at: 150, high: 30, ink: '#6a9279' },
    { at: 215, high: 48, ink: '#7c9fb4' },
  ]
  for (const [layer, ring] of rings.entries()) {
    const shape = new THREE.BufferGeometry()
    const points: number[] = []
    const steps = 140
    /* Two waves of different lengths added together, which is the cheapest
     * thing that reads as a landscape rather than as a row of teeth. */
    const heightAt = (i: number) => {
      const a = (i / steps) * Math.PI * 2
      return ring.high * (
        0.35 +
        0.4 * (0.5 + 0.5 * Math.sin(a * 2.7 + layer * 2.1)) +
        0.25 * (0.5 + 0.5 * Math.sin(a * 7.3 + layer * 5.7)) +
        0.18 * wobble(i + layer * 97)
      )
    }
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const b = ((i + 1) / steps) * Math.PI * 2
      const h1 = heightAt(i)
      const h2 = heightAt(i + 1)
      const x1 = Math.cos(a) * ring.at
      const z1 = Math.sin(a) * ring.at
      const x2 = Math.cos(b) * ring.at
      const z2 = Math.sin(b) * ring.at
      points.push(x1, -3, z1, x2, -3, z2, x2, h2, z2)
      points.push(x1, -3, z1, x2, h2, z2, x1, h1, z1)
    }
    shape.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    shape.computeVertexNormals()
    hills.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({
      color: ring.ink, side: THREE.DoubleSide,
    })))
  }
  return hills
}

/**
 * Clouds: soft blobs painted on a canvas once and hung about the sky.
 *
 * A clear empty sky is the other half of why a 3D scene looks like a diagram.
 * These cost one texture and a handful of transparent quads, they never move
 * fast enough to be caught out, and they give the eye something to measure the
 * height of a balloon against.
 */
function buildClouds(): THREE.Group {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const soft = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
    soft.addColorStop(0, 'rgba(255,255,255,0.95)')
    soft.addColorStop(0.45, 'rgba(255,255,255,0.5)')
    soft.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = soft
    ctx.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false, opacity: 0.85,
  })

  const sky = new THREE.Group()
  for (let i = 0; i < 16; i++) {
    const angle = wobble(i * 17) * Math.PI * 2
    const away = 160 + wobble(i * 19 + 2) * 120
    const high = 55 + wobble(i * 23 + 5) * 70
    // Each cloud is four or five blobs in a clump, which is what stops them
    // all being the same circle.
    for (let puff = 0; puff < 4 + Math.round(wobble(i * 29) * 2); puff++) {
      const bit = new THREE.Sprite(material)
      const wide = 26 + wobble(i * 31 + puff) * 34
      bit.scale.set(wide, wide * (0.42 + wobble(i + puff) * 0.2), 1)
      bit.position.set(
        Math.cos(angle) * away + (wobble(i * 37 + puff) - 0.5) * wide * 1.6,
        high + (wobble(i * 41 + puff) - 0.5) * wide * 0.3,
        Math.sin(angle) * away + (wobble(i * 43 + puff) - 0.5) * wide * 1.6,
      )
      sky.add(bit)
    }
  }
  return sky
}

/** A pine, as two cones and a trunk. Forty of them make a wood. */
function buildTree(scale: number, tone: number): THREE.Group {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 1.6 * scale, 6),
    new THREE.MeshLambertMaterial({ color: '#4a3524' }),
  )
  trunk.position.y = 0.8 * scale
  tree.add(trunk)
  /*
   * Three tiers rather than two, and every tree a slightly different green.
   * A wood where every tree is the same colour reads as wallpaper; the
   * variation costs nothing and is most of what makes it a wood.
   */
  const dark = new THREE.Color('#33663a').lerp(new THREE.Color('#5d9150'), tone)
  for (const [i, at] of [1.5, 2.5, 3.3].entries()) {
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry((1.55 - i * 0.38) * scale, (2.3 - i * 0.45) * scale, 8),
      new THREE.MeshLambertMaterial({
        color: dark.clone().multiplyScalar(0.84 + i * 0.12),
      }),
    )
    leaves.position.y = at * scale
    tree.add(leaves)
  }
  return tree
}

/**
 * The ground, as a small square of mottled green tiled over the field.
 *
 * Built out of soft blotches rather than per-pixel noise: noise at this scale
 * comes out as television static once it is stretched over a meadow, and
 * blotches read as ground.
 */
function grassTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#4a7a3c'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 900; i++) {
      const x = wobble(i * 3 + 1) * 256
      const y = wobble(i * 5 + 2) * 256
      const r = 2 + wobble(i * 7 + 3) * 11
      const light = wobble(i * 11 + 4)
      ctx.fillStyle = light > 0.5
        ? `rgba(126,170,88,${0.1 + light * 0.25})`
        : `rgba(44,84,38,${0.1 + light * 0.3})`
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.5 + light * 0.7), light * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(46, 46)
  texture.anisotropy = 8
  return texture
}

/**
 * The number written on a balloon, as a sprite.
 *
 * Drawn on a little canvas rather than built out of geometry: a digit is a
 * shape that canvas is extremely good at and three.js is extremely bad at, and
 * a sprite always faces the player, which is exactly what a label wants to do.
 */
function numberSprite(n: number, tint: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = 'bold 86px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 14
    ctx.strokeStyle = 'rgba(12,16,26,0.85)'
    ctx.strokeText(String(n), 64, 70)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(n), 64, 70)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }))
  sprite.scale.setScalar(BALLOON_R * 1.5)
  void tint
  return sprite
}

interface Hung {
  group: THREE.Group
  skin: THREE.Mesh
  label: THREE.Sprite
  number: number
  tint: string
}

export function buildMeadow(width: number, height: number): Meadow {
  const scene = new THREE.Scene()
  /*
   * Haze, starting well out. Begun at forty-five metres it washed the far half
   * of the field into a pale band across the horizon — the fog was doing to
   * the ground what it is meant to do to hills.
   */
  scene.fog = new THREE.Fog(HAZE, 90, 290)

  const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 600)
  camera.position.set(0, EYE, 0)

  scene.add(buildSky())
  scene.add(buildHills())
  scene.add(buildClouds())

  // --- light ---------------------------------------------------------------
  /*
   * Two lights and no more. The sun is warm and comes from over your left
   * shoulder so that balloons catch it on the side you can see; the hemisphere
   * is cool from above and green from below, which is the light bouncing off
   * the grass and the reason nothing on the shaded side goes black.
   */
  const sun = new THREE.DirectionalLight('#fff3d6', 2.1)
  sun.position.set(-40, 55, -30)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight('#cfe3f5', '#486b36', 2.0))

  /*
   * The sun itself, so the light has somewhere to come from.
   *
   * A soft blob rather than a disc with an edge. Drawn as a flat circle it
   * came out as a big grey plate hanging in the sky — tone mapping flattens a
   * pale yellow to very nearly the colour of the sky around it, and all that
   * was left was the outline.
   */
  const sunFace = document.createElement('canvas')
  sunFace.width = 128
  sunFace.height = 128
  const sunCtx = sunFace.getContext('2d')
  if (sunCtx) {
    const glow = sunCtx.createRadialGradient(64, 64, 0, 64, 64, 64)
    glow.addColorStop(0, 'rgba(255,255,245,1)')
    glow.addColorStop(0.12, 'rgba(255,248,214,0.95)')
    glow.addColorStop(0.3, 'rgba(255,238,180,0.35)')
    glow.addColorStop(1, 'rgba(255,236,176,0)')
    sunCtx.fillStyle = glow
    sunCtx.fillRect(0, 0, 128, 128)
  }
  const sunMap = new THREE.CanvasTexture(sunFace)
  sunMap.colorSpace = THREE.SRGBColorSpace
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunMap, transparent: true, depthWrite: false, fog: false,
  }))
  disc.position.set(-150, 190, -120)
  disc.scale.setScalar(70)
  scene.add(disc)

  // --- the ground ----------------------------------------------------------
  /*
   * The field, with a speckle painted onto it.
   *
   * A single flat green disc is the thing that most gives away a 3D scene made
   * of primitives: there is nothing on it for the eye to measure distance
   * against, so it reads as a sheet of paper. A tiling canvas of mottled green
   * costs one small texture and does more than any number of blades of grass.
   */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(280, 64),
    new THREE.MeshLambertMaterial({ color: '#ffffff', map: grassTexture() }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // A lake out to one side, which gives the eye somewhere to rest and catches
  // the sky.
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshLambertMaterial({ color: '#2f5f86' }),
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(70, 0.04, -55)
  lake.scale.set(1.6, 1, 1)
  scene.add(lake)

  // --- trees ---------------------------------------------------------------
  const wood = new THREE.Group()
  for (let i = 0; i < 56; i++) {
    const angle = wobble(i * 3) * Math.PI * 2
    /*
     * Mostly out at the edge of the field, but every fifth one brought in
     * close. Scenery that all sits at one distance flattens into a backdrop;
     * a few near trees give the eye something to measure the far ones by.
     */
    const away = i % 6 === 0 ? 30 + wobble(i * 5 + 1) * 18 : 52 + wobble(i * 5 + 1) * 80
    const scale = 1.6 + wobble(i * 7 + 2) * 1.9
    const tree = buildTree(scale, wobble(i * 9 + 3))
    tree.position.set(Math.cos(angle) * away, 0, Math.sin(angle) * away)
    tree.rotation.y = wobble(i) * Math.PI
    wood.add(tree)
  }
  scene.add(wood)

  /*
   * Grass near the archer: crossed blades, not little cones.
   *
   * The cones this started with read as a field of tiny Christmas trees, which
   * is the sort of thing you only see once it is in front of you. Two thin
   * quads crossed at right angles catch the light from any direction and cost
   * two triangles each, and the per-blade turn and height is what stops a
   * thousand of them looking like one of them stamped out.
   */
  const blade = new THREE.BufferGeometry()
  {
    const w = 0.022
    const h = 1
    const quad = (ax: number, az: number) => [
      -ax * w, 0, -az * w, ax * w, 0, az * w, ax * w * 0.3, h, az * w * 0.3,
      -ax * w, 0, -az * w, ax * w * 0.3, h, az * w * 0.3, -ax * w * 0.3, h, -az * w * 0.3,
    ]
    blade.setAttribute('position', new THREE.Float32BufferAttribute(
      [...quad(1, 0), ...quad(0, 1)], 3,
    ))
    /*
     * Dark at the root and sunlit at the tip, painted into the geometry rather
     * than set per blade. Per-blade colours were the obvious way to do it and
     * came out solid black: an instanced colour needs the material asking for
     * vertex colours, and a material asking for vertex colours over geometry
     * that has none reads them as nothing at all. This way the gradient is in
     * the only place it is really wanted — up the blade — and it cannot be
     * wrong.
     */
    const root = new THREE.Color('#406f33')
    const tip = new THREE.Color('#8fbe63')
    const paint: number[] = []
    const pos = blade.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const high = pos.getY(i)
      const c = root.clone().lerp(tip, high)
      paint.push(c.r, c.g, c.b)
    }
    blade.setAttribute('color', new THREE.Float32BufferAttribute(paint, 3))
    blade.computeVertexNormals()
  }
  const BLADES = 1100
  /*
   * Unlit, and that is deliberate. A blade of grass is a vertical sheet with
   * its face turned away from an overhead sun, so a lit one comes out almost
   * black and a field of them reads as a scatter of dark weeds. Painting the
   * light into the blade instead — dark at the root, sunlit at the tip — is
   * both cheaper and closer to what grass looks like.
   */
  const tufts = new THREE.InstancedMesh(
    blade,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true }),
    BLADES,
  )
  const spot = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const where = new THREE.Vector3()
  const size = new THREE.Vector3()
  for (let i = 0; i < BLADES; i++) {
    const angle = wobble(i * 11) * Math.PI * 2
    // Densest right around your feet and thinning out, which is how grass
    // actually looks from standing height.
    const away = 0.9 + Math.pow(wobble(i * 13 + 4), 0.7) * 7
    where.set(Math.cos(angle) * away, 0, Math.sin(angle) * away)
    /*
     * Turned, and leaning. Blades standing perfectly upright read as a field
     * of little cone trees, which is what the first go at this looked like
     * from standing height.
     */
    turn.setFromEuler(new THREE.Euler(
      (wobble(i * 71) - 0.5) * 0.5, wobble(i * 17 + 7) * Math.PI, (wobble(i * 73) - 0.5) * 0.5,
    ))
    const tall = 0.08 + wobble(i * 19 + 9) * 0.14
    size.set(0.8 + wobble(i * 23) * 0.6, tall, 0.8 + wobble(i * 29) * 0.6)
    spot.compose(where, turn, size)
    tufts.setMatrixAt(i, spot)
  }
  tufts.instanceMatrix.needsUpdate = true
  scene.add(tufts)

  // --- the balloons ---------------------------------------------------------
  const skin = new THREE.SphereGeometry(BALLOON_R, 18, 14)
  const knotGeometry = new THREE.ConeGeometry(BALLOON_R * 0.3, BALLOON_R * 0.45, 7)
  const stringGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4)
  const hung = new Map<number, Hung>()

  const makeBalloon = (balloon: Balloon): Hung => {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      skin,
      /*
       * Rubber, not plastic: a little shine, a lot of roughness, and lit from
       * inside by `emissive` at a tenth strength so a balloon against a dark
       * hill still reads as its own colour. This one material is most of why
       * the things look blown up rather than drawn on.
       */
      new THREE.MeshPhongMaterial({
        color: balloon.tint,
        shininess: 55,
        specular: '#ffffff',
        /*
         * Lit from inside at a third strength, which is how a balloon with the
         * sun behind it actually looks — and the fix for the one that came out
         * nearly black against a bright sky because the only side we could see
         * was its shaded one.
         */
        emissive: new THREE.Color(balloon.tint).multiplyScalar(0.34),
      }),
    )
    body.scale.set(1, 1.18, 1)
    group.add(body)

    const knot = new THREE.Mesh(knotGeometry, new THREE.MeshLambertMaterial({ color: balloon.tint }))
    knot.position.y = -BALLOON_R * 1.18
    knot.rotation.x = Math.PI
    group.add(knot)

    const string = new THREE.Mesh(
      stringGeometry, new THREE.MeshBasicMaterial({ color: '#e8e8e8' }),
    )
    string.position.y = -BALLOON_R * 1.18 - 0.8
    group.add(string)

    const label = numberSprite(balloon.number, balloon.tint)
    label.position.set(0, 0, BALLOON_R * 0.95)
    group.add(label)

    scene.add(group)
    return { group, skin: body, label, number: balloon.number, tint: balloon.tint }
  }

  // --- arrows ---------------------------------------------------------------
  /*
   * An arrow, in two sizes, and the reason there are two.
   *
   * A real arrow is eight millimetres across. On the string that is right in
   * front of your eye and looks like an arrow; twenty metres out it is two
   * thirds of one pixel, which is not something anybody can follow. The whole
   * game is watching where a shot went and aiming the next one higher, so an
   * arrow you lose sight of the moment it leaves is a game that cannot be
   * learned.
   *
   * So the one on the string is the real thing and the ones in the air are
   * about four times as thick, with a bright head, bright flights, and enough
   * polish to catch the sun. Nobody sees the two side by side: a loosed arrow
   * is ten metres away before the next frame is drawn.
   */
  const arrowBits = (thick: number, long: number) => {
    const shaft = new THREE.CylinderGeometry(0.012 * thick, 0.012 * thick, long, 8)
    shaft.rotateX(Math.PI / 2)
    const head = new THREE.ConeGeometry(0.024 * thick, 0.11 * Math.sqrt(thick), 8)
    head.rotateX(Math.PI / 2)
    head.translate(0, 0, long * 0.55)
    /*
     * Flights, at the size flights are — on the string, anyway. These began as
     * a hand's-breadth square and the nocked arrow put a maroon flag across a
     * third of the screen, the sort of thing that is obvious the moment you
     * look and invisible until you do.
     */
    const fletch = new THREE.PlaneGeometry(0.045 * thick, 0.14 * Math.sqrt(thick))
    fletch.rotateX(Math.PI / 2)
    fletch.translate(0, 0, -long * 0.4)
    return { shaft, head, fletch }
  }

  const NOCKED = arrowBits(1, 1)
  const FLYING = arrowBits(4.2, 1.1)

  /*
   * The streak behind a flying one.
   *
   * Thickness alone is not enough: a bright speck crossing a bright sky is
   * still a speck, and what the eye actually follows is a line. Two crossed
   * ribbons a metre and a half long, fading out behind, give it one from any
   * angle — at twenty metres that is a finger's width of warm colour against
   * the blue instead of a dot. It is the arrow's own amber rather than white,
   * because white disappears into the sky it is meant to show up against.
   */
  const streakFace = document.createElement('canvas')
  streakFace.width = 8
  streakFace.height = 64
  const streakCtx = streakFace.getContext('2d')
  if (streakCtx) {
    /*
     * Brightest at the arrow and fading away behind it — which means brightest
     * at the *top* of this canvas, because a texture's first row is the far
     * end of the ribbon once it has been turned to lie along the flight. Drawn
     * the way round it reads on the page, the streak comes out glowing at the
     * tail and vanishing at the arrowhead, like something being sucked
     * backwards.
     */
    const fade = streakCtx.createLinearGradient(0, 0, 0, 64)
    fade.addColorStop(0, 'rgba(255,224,164,0.85)')
    fade.addColorStop(0.25, 'rgba(255,190,96,0.55)')
    fade.addColorStop(1, 'rgba(255,176,72,0)')
    streakCtx.fillStyle = fade
    streakCtx.fillRect(0, 0, 8, 64)
  }
  const streakMap = new THREE.CanvasTexture(streakFace)
  streakMap.colorSpace = THREE.SRGBColorSpace
  const STREAK = 1.6
  const streakGeometry = new THREE.PlaneGeometry(0.1, STREAK)
  streakGeometry.rotateX(Math.PI / 2)
  streakGeometry.translate(0, 0, -STREAK / 2)

  const arrowShapes = new Map<number, { group: THREE.Group; streak: THREE.Group }>()

  const makeArrow = (flying: boolean): { group: THREE.Group; streak: THREE.Group } => {
    const bits = flying ? FLYING : NOCKED
    const group = new THREE.Group()
    group.add(new THREE.Mesh(bits.shaft, new THREE.MeshPhongMaterial({
      // Polished rather than matt, so it turns over in the light on the way
      // out and is not one flat stick against one flat sky.
      color: flying ? '#e8b35c' : '#c8a269',
      shininess: flying ? 70 : 20,
      specular: '#fff3d0',
      emissive: flying ? new THREE.Color('#e8b35c').multiplyScalar(0.22) : new THREE.Color(0x000000),
    })))
    group.add(new THREE.Mesh(bits.head, new THREE.MeshPhongMaterial({
      color: flying ? '#e6edf6' : '#9aa3ad',
      shininess: 120,
      specular: '#ffffff',
      emissive: flying ? new THREE.Color('#aebccf').multiplyScalar(0.3) : new THREE.Color(0x000000),
    })))
    // Three vanes on a flying one, two on the nocked: a third costs two
    // triangles and means there is always one turned towards you.
    for (const turn of flying ? [0, Math.PI / 3, (Math.PI * 2) / 3] : [0, Math.PI / 2]) {
      const vane = new THREE.Mesh(bits.fletch, new THREE.MeshPhongMaterial({
        color: flying ? '#ff6b3d' : '#e05c5c',
        side: THREE.DoubleSide,
        shininess: 40,
        emissive: flying ? new THREE.Color('#ff6b3d').multiplyScalar(0.3) : new THREE.Color(0x000000),
      }))
      vane.rotation.z = turn
      group.add(vane)
    }

    const streak = new THREE.Group()
    if (flying) {
      for (const turn of [0, Math.PI / 2]) {
        const ribbon = new THREE.Mesh(streakGeometry, new THREE.MeshBasicMaterial({
          map: streakMap, transparent: true, depthWrite: false, fog: false,
          side: THREE.DoubleSide,
        }))
        ribbon.rotation.z = turn
        streak.add(ribbon)
      }
      group.add(streak)
    }

    scene.add(group)
    return { group, streak }
  }

  // --- the bow, in your hands ----------------------------------------------
  /*
   * Parented to the camera, so it is always exactly where your hands are.
   *
   * Composing this for a phone held upright is the whole job. A portrait screen
   * has a tall view and a very narrow one — about forty degrees across and
   * seventy down — so a bow placed where it would sit in a wide window ends up
   * filling the picture and covering the thing you are aiming at. The first
   * attempt did exactly that: a brown hoop across the middle of the meadow.
   *
   * So it is arranged the way you would actually see it: the riser off at the
   * right edge, the limbs running up and down out of the top and bottom of the
   * screen, and the string a hand's width right of the sight. You look past it,
   * not through it.
   */
  const hands = new THREE.Group()
  camera.add(hands)
  scene.add(camera)

  const BOW_R = 0.46
  const BOW_AT = new THREE.Vector3(0.17, -0.28, -0.78)
  /*
   * The arc runs from 0 to 207 degrees, so its opening is centred on 283.5.
   * Turning it back to 180 points the opening — and therefore the string —
   * towards the middle of the screen, with the belly of the bow out to the
   * right.
   */
  const BOW_ARC = Math.PI * 1.15
  const BOW_TURN = -Math.PI * 0.575
  const limb = new THREE.TorusGeometry(BOW_R, 0.022, 8, 28, BOW_ARC)
  const bow = new THREE.Mesh(limb, new THREE.MeshPhongMaterial({
    color: '#6b4420', shininess: 40, specular: '#c89a63',
  }))
  /*
   * Turned in its own plane to put the string across the middle, then canted
   * away from you about its own grip — the way an archer actually holds one.
   * Square on, a bow in first person is a flat hoop with a line down it;
   * tipped, you can see it is a thing with a front and a back.
   *
   * The cant used to be a turn of the whole hands group, which rotates it
   * about your eye rather than about the bow, and swung the entire thing off
   * the side of the screen.
   */
  bow.rotation.set(0, -0.18, BOW_TURN)
  bow.position.copy(BOW_AT)
  bow.updateMatrix()
  hands.add(bow)

  // Where the string is tied: the two ends of the arc, worked out from the
  // same numbers rather than guessed, so moving the bow moves the string.
  const tips = [0, BOW_ARC].map((a) => new THREE.Vector3(
    Math.cos(a) * BOW_R, Math.sin(a) * BOW_R, 0,
  ).applyMatrix4(bow.matrix))

  // The grip, out at the belly where a hand would be.
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.034, 0.26, 8),
    new THREE.MeshLambertMaterial({ color: '#35200f' }),
  )
  /*
   * Out at the belly of the bow, which is the middle of the arc rather than
   * the end of it: measuring from the end put the hand on the lower limb tip,
   * and a dark lump appeared at the bottom of the screen with nothing holding
   * it up.
   */
  grip.position.copy(new THREE.Vector3(
    Math.cos(BOW_ARC / 2) * BOW_R, Math.sin(BOW_ARC / 2) * BOW_R, 0,
  ).applyMatrix4(bow.matrix))
  grip.rotation.copy(bow.rotation)
  hands.add(grip)

  /*
   * The string, as two thin rods from the tips to wherever the nock is. Drawn
   * this way rather than as one straight bar because the V a drawn string
   * makes is the clearest picture of effort in the whole game: it is how you
   * can see at a glance how far back you have pulled.
   */
  const stringGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5)
  stringGeo.translate(0, 0.5, 0)
  const strings = tips.map(() => {
    const rod = new THREE.Mesh(stringGeo, new THREE.MeshBasicMaterial({ color: '#d9d2bb' }))
    hands.add(rod)
    return rod
  })

  const nocked = makeArrow(false).group
  scene.remove(nocked)
  hands.add(nocked)
  nocked.scale.setScalar(0.85)
  // Turned to face the way you are looking. Left as built, the arrow points
  // back out of the screen and all you see is the point of it, enormous.
  nocked.rotation.y = Math.PI

  /*
   * Where the string sits when nothing is pulling it: straight between the two
   * tips. Taken from the middle of the bow instead, which is where it started,
   * the undrawn string bowed forwards out of the belly — a bow strung inside
   * out.
   */
  const REST = tips[0].clone().add(tips[1]).multiplyScalar(0.5)

  /** Lays one of the string rods between two points. */
  const stretch = (rod: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
    rod.position.copy(from)
    const along = to.clone().sub(from)
    rod.scale.set(1, Math.max(0.001, along.length()), 1)
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize())
  }

  // --- bursts ---------------------------------------------------------------
  const shard = new THREE.TetrahedronGeometry(0.17)
  const bursting = new Map<number, THREE.Group>()

  const makeBurst = (burst: Burst): THREE.Group => {
    const group = new THREE.Group()
    for (let i = 0; i < 9; i++) {
      const bit = new THREE.Mesh(shard, new THREE.MeshLambertMaterial({ color: burst.tint }))
      const a = (i / 9) * Math.PI * 2
      bit.userData.fly = new THREE.Vector3(
        Math.cos(a) * (1 + wobble(i)), 0.6 + wobble(i + 9) * 1.6, Math.sin(a) * (1 + wobble(i + 3)),
      )
      group.add(bit)
    }
    scene.add(group)
    return group
  }

  // --- putting the run on the screen ----------------------------------------
  const spin = new THREE.Vector3()
  const nock = new THREE.Vector3()

  const update = (run: Run, alpha: number, clock: number) => {
    void alpha
    /*
     * Pointed by the same function the arrow is pointed by, which is the whole
     * reason it is a function and not two copies of the same trigonometry.
     *
     * It was two copies, and they disagreed: an Euler of (pitch, yaw) turns a
     * three.js camera the opposite way round from `facing`, so everything
     * looked right and every arrow loosed while facing anywhere but due north
     * flew off mirrored. Nothing could be hit and nothing said why — the
     * balloons were where you saw them and the arrows were honest, they just
     * did not agree about which way you were looking.
     */
    const look = facing(run.yaw, run.pitch)
    camera.lookAt(
      camera.position.x + look.x, camera.position.y + look.y, camera.position.z + look.z,
    )

    /*
     * The draw. The nock comes back towards you, the string follows it into a
     * V, the arrow rides on it, and the whole bow lifts and tips a little as
     * it is pulled — which is the difference between a bow and a picture of a
     * bow hanging in the air.
     */
    const pull = run.draw
    nock.set(REST.x, REST.y, REST.z + pull * 0.26)
    for (const [i, rod] of strings.entries()) stretch(rod, tips[i], nock)
    // Its back end on the string, not floating in front of it.
    nocked.position.set(nock.x, nock.y + 0.012, nock.z - 0.43)
    hands.rotation.x = pull * 0.05
    hands.position.y = -pull * 0.015

    // Balloons.
    const seen = new Set<number>()
    for (const balloon of run.balloons) {
      seen.add(balloon.id)
      let one = hung.get(balloon.id)
      if (!one) {
        one = makeBalloon(balloon)
        hung.set(balloon.id, one)
      }
      const bob = Math.sin(clock * 1.4 + balloon.sway) * 0.09
      one.group.position.set(balloon.x, balloon.y + bob, balloon.z)
      one.group.rotation.z = Math.sin(clock * 0.9 + balloon.sway) * 0.12
      // Turn the number towards the player so it can always be read.
      one.label.position.set(0, 0, 0)
      spin.set(camera.position.x - balloon.x, 0, camera.position.z - balloon.z).normalize()
      one.label.position.set(spin.x * BALLOON_R * 0.92, 0.05, spin.z * BALLOON_R * 0.92)
      // Fading out as it nears the top, so "about to get away" is visible.
      const leaving = Math.max(0, (balloon.y - (ESCAPE_Y - 5)) / 5)
      const material = one.skin.material as THREE.MeshPhongMaterial
      material.opacity = 1 - leaving * 0.55
      material.transparent = leaving > 0
    }
    for (const [id, one] of hung) {
      if (seen.has(id)) continue
      scene.remove(one.group)
      hung.delete(id)
    }

    // Arrows in flight.
    const flying = new Set<number>()
    for (const arrow of run.arrows) {
      flying.add(arrow.id)
      let shape = arrowShapes.get(arrow.id)
      if (!shape) {
        shape = makeArrow(true)
        arrowShapes.set(arrow.id, shape)
      }
      shape.group.position.set(arrow.x, arrow.y, arrow.z)
      // Pointing the way it is going, which for a falling arrow means nose
      // down by the end — the clearest sign in the game that gravity is real.
      spin.set(arrow.vx, arrow.vy, arrow.vz)
      if (spin.lengthSq() > 0.001) {
        shape.group.lookAt(arrow.x + spin.x, arrow.y + spin.y, arrow.z + spin.z)
      }
      /*
       * The streak grows over the first few hundredths of a second and goes
       * out the moment the arrow stops. Without the first, every shot starts
       * with a metre and a half of smear across your own bow; without the
       * second, an arrow stuck in the grass trails one behind it for ever.
       */
      shape.streak.visible = !arrow.stuck
      const out = Math.min(1, arrow.age / 0.05)
      shape.streak.scale.set(1, 1, out)
      /*
       * And it comes up to its full thickness over the first few metres. A
       * flying arrow is four times life size so that it can still be seen at
       * twenty-five metres; at arm's length that same arrow is a plank across
       * the screen, and the frame or two just after a shot is at arm's length.
       * It is slim where it would be huge and fat where it would be a speck,
       * which is the whole trick and is invisible at forty-two metres a
       * second.
       */
      const fat = 0.3 + 0.7 * Math.min(1, arrow.age / 0.07)
      shape.group.scale.set(fat, fat, 1)
    }
    for (const [id, shape] of arrowShapes) {
      if (flying.has(id)) continue
      scene.remove(shape.group)
      arrowShapes.delete(id)
    }

    // Bursts.
    const popping = new Set<number>()
    for (const burst of run.bursts) {
      popping.add(burst.id)
      let group = bursting.get(burst.id)
      if (!group) {
        group = makeBurst(burst)
        bursting.set(burst.id, group)
      }
      const gone = 1 - burst.life / 0.9
      group.position.set(burst.x, burst.y, burst.z)
      for (const bit of group.children) {
        const fly = bit.userData.fly as THREE.Vector3
        bit.position.set(fly.x * gone * 1.4, fly.y * gone * 1.2 - gone * gone * 2.4, fly.z * gone * 1.4)
        bit.rotation.set(gone * 6, gone * 4, gone * 5)
        bit.scale.setScalar(Math.max(0.01, 1 - gone))
      }
    }
    for (const [id, group] of bursting) {
      if (popping.has(id)) continue
      scene.remove(group)
      bursting.delete(id)
    }
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

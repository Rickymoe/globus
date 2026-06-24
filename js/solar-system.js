import * as THREE from 'three'

export const AU    = 2000   // world units per astronomical unit
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0)

const PLANETS = [
  { name: 'Merkur',  a:  0.387, period:    87.97, L0: 252.25, color: 0xaaaaaa, r:  8 },
  { name: 'Venus',   a:  0.723, period:   224.70, L0: 181.98, color: 0xe8d08c, r: 15 },
  { name: 'Mars',    a:  1.524, period:   686.97, L0: 355.45, color: 0xc1440e, r: 11 },
  { name: 'Jupiter', a:  5.203, period:  4332.59, L0:  34.40, color: 0xc88b3a, r: 48 },
  { name: 'Saturn',  a:  9.537, period: 10759.22, L0:  49.94, color: 0xe8d87c, r: 40, rings: true },
  { name: 'Uranus',  a: 19.191, period: 30688.50, L0: 313.23, color: 0x7de8e8, r: 26 },
  { name: 'Neptune', a: 30.069, period: 60182.00, L0: 304.88, color: 0x4060ff, r: 25 },
]

function planetPos(d) {
  const days = (Date.now() - J2000) / 86400000
  const M = (d.L0 + (360 / d.period) * days) * Math.PI / 180
  return new THREE.Vector3(Math.cos(M) * d.a * AU, 0, Math.sin(M) * d.a * AU)
}

function makeOrbitLine(a, color) {
  const pts = []
  for (let i = 0; i <= 128; i++) {
    const t = i / 128 * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(t) * a * AU, 0, Math.sin(t) * a * AU))
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
  )
}

function makeLabel(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 32px system-ui'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 32)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
  }))
  sprite.scale.set(120, 30, 1)
  return sprite
}

// Minimum apparent half-angle (radians) — planet is scaled up to maintain this
const MIN_ANGLE = 0.005

let _group = null
const _planetMeshes = []  // { mesh, label, baseR }

export function initSolarSystem(scene) {
  _group = new THREE.Group()
  _group.visible = false

  for (const d of PLANETS) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(d.r, 24, 24),
      new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.8 })
    )
    mesh.position.copy(planetPos(d))
    _group.add(mesh)
    _group.add(makeOrbitLine(d.a, d.color))

    if (d.rings) {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(d.r * 1.5, d.r * 2.6, 64),
        new THREE.MeshBasicMaterial({
          color: 0xd4c57a, side: THREE.DoubleSide,
          transparent: true, opacity: 0.65,
        })
      )
      rings.rotation.x = Math.PI * 0.42
      mesh.add(rings)
    }

    const label = makeLabel(d.name)
    label.position.copy(planetPos(d))
    label.position.y += d.r + 20
    _group.add(label)

    _planetMeshes.push({ mesh, label, baseR: d.r })
  }

  // Earth orbit line (around origin)
  _group.add(makeOrbitLine(1.0, 0x4fc3f7))

  scene.add(_group)
}

export function updatePlanetScales(camera) {
  if (!_group?.visible) return
  for (const { mesh, label, baseR } of _planetMeshes) {
    const dist  = camera.position.distanceTo(mesh.position)
    const minR  = dist * Math.tan(MIN_ANGLE)
    const scale = Math.max(1, minR / baseR)
    mesh.scale.setScalar(scale)
    // Keep label just above the scaled planet
    label.position.copy(mesh.position)
    label.position.y += baseR * scale + 20 * scale
    // Scale label too so it stays readable
    const ls = Math.max(1, scale * 0.6)
    label.scale.set(120 * ls, 30 * ls, 1)
  }
}

export function setSolarSystemVisible(visible) {
  if (_group) _group.visible = visible
}

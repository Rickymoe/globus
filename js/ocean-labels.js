import * as THREE from 'three'

const R = 101.5

// size: sprite scale — larger = bigger label, matches ocean importance
const OCEANS = [
  { name: 'Pacific Ocean',    lat:   5, lon: -155, size: 3.2 },
  { name: 'Atlantic Ocean',   lat:   0, lon:  -30, size: 2.4 },
  { name: 'Indian Ocean',     lat: -25, lon:   80, size: 2.2 },
  { name: 'Southern Ocean',   lat: -60, lon:    0, size: 1.8 },
  { name: 'Arctic Ocean',     lat:  85, lon:    0, size: 1.4 },
  { name: 'Caribbean Sea',    lat:  15, lon:  -75, size: 1.0 },
  { name: 'Mediterranean Sea',lat:  35, lon:   18, size: 1.0 },
  { name: 'South China Sea',  lat:  13, lon:  114, size: 1.0 },
  { name: 'Gulf of Mexico',   lat:  25, lon:  -90, size: 0.9 },
  { name: 'Bering Sea',       lat:  58, lon: -175, size: 1.0 },
  { name: 'North Sea',        lat:  57, lon:    3, size: 0.75 },
  { name: 'Red Sea',          lat:  22, lon:   37, size: 0.75 },
  { name: 'Norwegian Sea',    lat:  68, lon:   -5, size: 0.85 },
  { name: 'Arabian Sea',      lat:  15, lon:   62, size: 1.1 },
  { name: 'Bay of Bengal',    lat:  13, lon:   88, size: 1.0 },
  { name: 'Coral Sea',        lat: -18, lon:  155, size: 0.9 },
]

const FADE_START = 500   // fully visible above this cam distance
const FADE_END   = 200   // fully hidden below this

let _group   = null
let _sprites = []
let _visible = false

function toVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(theta),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(theta),
  )
}

function makeLabel(name, size) {
  const fontSize   = Math.round(14 * size)
  const spacing    = 2.5 * size          // letter-spacing in px
  const font       = `italic ${fontSize}px Georgia, serif`

  // Measure total width with spacing
  const tmp = document.createElement('canvas').getContext('2d')
  tmp.font = font
  const chars = [...name]
  const charW = chars.map(c => tmp.measureText(c).width)
  const totalW = charW.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1)

  const pad = 6
  const W   = Math.ceil(totalW) + pad * 2
  const H   = Math.ceil(fontSize * 1.4) + pad

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.font         = font
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = 'rgba(190, 220, 255, 0.88)'

  // Optional subtle shadow for legibility over land edges
  ctx.shadowColor  = 'rgba(0,0,20,0.6)'
  ctx.shadowBlur   = 3

  let x = pad
  chars.forEach((c, i) => {
    ctx.fillText(c, x, H / 2)
    x += charW[i] + spacing
  })

  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const spr = new THREE.Sprite(mat)

  // Scale sprite so it looks right on the globe
  const aspect = W / H
  spr.scale.set(aspect * size * 5, size * 5, 1)
  return spr
}

export function initOceanLabels(scene) {
  _group = new THREE.Group()
  scene.add(_group)

  for (const o of OCEANS) {
    const spr = makeLabel(o.name, o.size)
    spr.position.copy(toVec3(o.lat, o.lon))
    spr.renderOrder = 5
    spr.userData = { lat: o.lat, lon: o.lon }
    _sprites.push(spr)
    _group.add(spr)
  }
}

export function setOceanLabelsVisible(v) {
  _visible = v
  if (!v) _sprites.forEach(s => { s.material.opacity = 0 })
}

export function updateOceanLabels(camera) {
  if (!_group || !_visible) return
  const camDist = camera.position.length()
  const t       = Math.max(0, Math.min(1, (camDist - FADE_END) / (FADE_START - FADE_END)))
  const camDir  = camera.position.clone().normalize()

  for (const spr of _sprites) {
    const dot = spr.position.clone().normalize().dot(camDir)
    spr.material.opacity = dot > 0.05 ? t : 0
  }
}

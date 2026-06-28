import * as THREE from 'three'

const R = 101.2
const PER = 55
const SPEED_SCALE = 0.022

// [lat, lon] waypoints · type: warm|cold · speed 0–1
// wander: max perpendicular oscillation in degrees (default 0.25)
//         set lower for coast-hugging currents to avoid land intrusion
const CURRENTS = [
  { name: 'Gulf Stream', type: 'warm', speed: 1.0,
    path: [[25,-80],[30,-79],[35,-75],[40,-68],[45,-58],[50,-45],[55,-35],[60,-20],[62,-8]] },
  { name: 'North Atlantic Drift', type: 'warm', speed: 0.5,
    path: [[60,-20],[62,-10],[65,0],[68,10],[70,20]] },
  { name: 'Labrador Current', type: 'cold', speed: 0.45, wander: 0.1,
    path: [[65,-52],[60,-50],[55,-48],[50,-45],[43,-43]] },
  { name: 'Kuroshio', type: 'warm', speed: 0.88, wander: 0.1,
    path: [[20,127],[25,130],[30,134],[35,138],[40,145],[45,155]] },
  { name: 'North Pacific Current', type: 'warm', speed: 0.45,
    // Eastward — extend past +180 to avoid Catmull-Rom cutting over Asia
    path: [[45,158],[45,172],[45,182],[45,198],[44,212],[43,225]] },
  { name: 'California Current', type: 'cold', speed: 0.42, wander: 0.1,
    path: [[55,-128],[50,-126],[45,-124],[38,-122],[30,-116],[22,-108]] },
  { name: 'North Equatorial (Pacific)', type: 'warm', speed: 0.55,
    // Westward — extend past -180 to avoid Catmull-Rom cutting over Africa
    path: [[15,-118],[15,-140],[15,-165],[15,-182],[15,-205],[15,-230]] },
  { name: 'Humboldt Current', type: 'cold', speed: 0.5, wander: 0.1,
    path: [[-40,-74],[-30,-76],[-20,-78],[-10,-80],[0,-82]] },
  // Brazil Current — 3–4° offshore to clear coastline + low wander
  { name: 'Brazil Current', type: 'warm', speed: 0.52, wander: 0.08,
    path: [[-5,-32],[-13,-36],[-22,-40],[-27,-46],[-31,-48],[-34,-50]] },
  // South Equatorial Atlantic — flows W, ends at Brazilian bulge
  { name: 'South Equatorial (Atlantic)', type: 'warm', speed: 0.6,
    path: [[2,-5],[-1,-15],[-3,-27],[-4,-34]] },
  { name: 'Agulhas Current', type: 'warm', speed: 0.68, wander: 0.1,
    path: [[-15,40],[-22,37],[-28,34],[-33,28],[-38,25]] },
  { name: 'East Australian Current', type: 'warm', speed: 0.62, wander: 0.1,
    path: [[-15,158],[-22,157],[-28,156],[-33,155],[-38,153],[-42,151]] },
  { name: 'Antarctic Circumpolar', type: 'cold', speed: 0.38,
    // Monotonically increasing longitude (300 = -60°W) — no antimeridian jump
    path: [[-55,-60],[-55,-30],[-55,0],[-55,30],[-55,60],
           [-55,90],[-55,120],[-55,150],[-55,178],[-55,210],[-55,240],[-55,270],[-55,300]] },
  { name: 'Somali Current', type: 'warm', speed: 0.62,
    path: [[-2,42],[5,46],[10,51],[14,54]] },
  { name: 'Indian South Equatorial', type: 'warm', speed: 0.5,
    path: [[-10,90],[-10,75],[-10,60],[-10,47]] },
]

const WARM_COL = new THREE.Color(1.0, 0.42, 0.08)
const COLD_COL = new THREE.Color(0.08, 0.65, 1.0)

let _group   = null
let _points  = null
let _tooltip = null
let _camera  = null
let _canvas  = null
let _particles  = []
let _hoverPts   = []   // [{x,y,name,type}] — one per current, screen-space
let _time = 0

// ── Geometry helpers ──────────────────────────────────────────────────────────

function toVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(theta),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(theta),
  )
}

function samplePath(path, t, loop) {
  const pts = loop ? [...path, path[0]] : path
  const n   = pts.length - 1
  const s   = Math.min(t * n, n - 0.0001)
  const i   = Math.floor(s)
  const f   = s - i
  const p0  = pts[Math.max(0, i - 1)]
  const p1  = pts[i]
  const p2  = pts[Math.min(n, i + 1)]
  const p3  = pts[Math.min(n, i + 2)]
  const f2  = f * f, f3 = f2 * f
  const cr  = (a, b, c, d) =>
    0.5 * ((2*b) + (-a+c)*f + (2*a-5*b+4*c-d)*f2 + (-a+3*b-3*c+d)*f3)
  return [cr(p0[0],p1[0],p2[0],p3[0]), cr(p0[1],p1[1],p2[1],p3[1])]
}

function perpAt(path, t) {
  const a   = samplePath(path, Math.max(0, t - 0.01), false)
  const b   = samplePath(path, Math.min(1, t + 0.01), false)
  const dlat = b[0]-a[0], dlon = b[1]-a[1]
  const len  = Math.sqrt(dlat*dlat + dlon*dlon) || 1
  return [-dlon/len, dlat/len]
}

function makeGlowTex() {
  const c   = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')
  const g   = ctx.createRadialGradient(16,16,0,16,16,14)
  g.addColorStop(0,   'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.3)')
  g.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0,0,32,32)
  return new THREE.CanvasTexture(c)
}

// ── Hover / tooltip ───────────────────────────────────────────────────────────

function _projectCenters() {
  if (!_camera || !_canvas) return
  _hoverPts = []
  const rect   = _canvas.getBoundingClientRect()
  const camDir = _camera.position.clone().normalize()
  for (let c = 0; c < CURRENTS.length; c++) {
    const cur  = CURRENTS[c]
    // use midpoint of path as label anchor
    const [lat, lon] = samplePath(cur.path, 0.5, cur.name === 'Antarctic Circumpolar')
    const v = toVec3(lat, lon)
    if (v.clone().normalize().dot(camDir) < 0.15) continue   // behind globe
    const sc = v.clone().project(_camera)
    _hoverPts.push({
      x:    ( sc.x + 1) / 2 * rect.width,
      y:    (-sc.y + 1) / 2 * rect.height,
      name: cur.name,
      type: cur.type,
    })
  }
}

function onMouseMove(e) {
  if (!_group?.visible) return
  const rect = _canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let nearest = null, minD = 40
  for (const h of _hoverPts) {
    const d = Math.hypot(h.x - mx, h.y - my)
    if (d < minD) { minD = d; nearest = h }
  }
  if (nearest) {
    const dot   = nearest.type === 'warm' ? '🟠' : '🔵'
    const label = nearest.type === 'warm' ? 'Varmstrøm' : 'Kaldstrøm'
    _tooltip.innerHTML  = `${dot} <b>${nearest.name}</b><br><span style="color:#aaa;font-size:11px">${label}</span>`
    _tooltip.style.left = (nearest.x + 14) + 'px'
    _tooltip.style.top  = (nearest.y - 10) + 'px'
    _tooltip.style.display = 'block'
  } else {
    _tooltip.style.display = 'none'
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initCurrents(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas

  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  _tooltip = document.createElement('div')
  _tooltip.style.cssText = [
    'position:absolute','background:rgba(8,8,8,0.85)','color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.15)','border-radius:8px',
    'padding:6px 10px','font-size:12px','font-family:system-ui,sans-serif',
    'pointer-events:none','display:none','z-index:50',
    'white-space:nowrap','backdrop-filter:blur(4px)',
  ].join(';')
  document.getElementById('canvas-container').appendChild(_tooltip)
  canvas.addEventListener('mousemove', onMouseMove)

  const total = CURRENTS.length * PER
  const pos   = new Float32Array(total * 3)
  const col   = new Float32Array(total * 3)

  for (let c = 0; c < CURRENTS.length; c++) {
    const cur  = CURRENTS[c]
    const loop = false   // all paths use extended longitudes — no antimeridian jumps
    const base = cur.type === 'warm' ? WARM_COL : COLD_COL
    for (let p = 0; p < PER; p++) {
      const idx = c * PER + p
      _particles.push({
        c,
        t:     p / PER,
        speed: cur.speed * (0.82 + Math.random() * 0.36),
        phase: Math.random() * Math.PI * 2,
      })
      col[idx*3] = base.r; col[idx*3+1] = base.g; col[idx*3+2] = base.b
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))

  _points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.2, map: makeGlowTex(),
    alphaTest: 0.02, sizeAttenuation: true,
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  _points.renderOrder = 3
  _group.add(_points)

  _tick(0)
}

function _tick(delta) {
  _time += delta
  const pos = _points.geometry.attributes.position
  const col = _points.geometry.attributes.color

  for (let i = 0; i < _particles.length; i++) {
    const p   = _particles[i]
    p.t = (p.t + p.speed * SPEED_SCALE * delta) % 1

    const cur = CURRENTS[p.c]
    const [lat, lon] = samplePath(cur.path, p.t, false)

    const wander       = Math.sin(_time * 0.25 + p.phase) * (cur.wander ?? 0.25)
    const [dlat, dlon] = perpAt(cur.path, p.t)

    const v = toVec3(lat + dlat * wander, lon + dlon * wander)
    pos.setXYZ(i, v.x, v.y, v.z)

    const pulse = 0.75 + 0.25 * Math.sin(_time * 1.2 + p.phase)
    const base  = cur.type === 'warm' ? WARM_COL : COLD_COL
    col.setXYZ(i, base.r * pulse, base.g * pulse, base.b * pulse)
  }

  pos.needsUpdate = true
  col.needsUpdate = true
  _projectCenters()
}

export function updateCurrents(delta) {
  if (_group?.visible) _tick(delta)
}

export function setCurrentsVisible(v) {
  if (_group) _group.visible = v
  if (!v && _tooltip) _tooltip.style.display = 'none'
}

// Real satellite positions via CelesTrak TLE data (visual satellites)
// Simplified SGP4 propagation — accurate within a few km for LEO

import * as THREE from 'three'

// CelesTrak blocks browser requests (403); use Ivan Stanojević TLE API (CORS, free, JSON)
const TLE_URL   = 'https://tle.ivanstanojevic.me/api/tle/?page-size=100'
const R_EARTH   = 6371   // km
const R_GLOBE   = 100    // Three.js units
const UPDATE_S  = 30     // recompute positions every 30 s

let _group    = null
let _points   = null
let _satData  = []
let _hover    = []       // [{x,y,name,alt}] in screen space
let _tooltip  = null
let _camera   = null
let _canvas   = null
let _timer    = 0

// ── TLE parsing (from JSON API or raw text) ──────────────────────────────────

function parseTLELines(name, l1, l2) {
  const yr  = parseInt(l1.substring(18, 20), 10)
  const day = parseFloat(l1.substring(20, 32))
  const year = yr < 57 ? 2000 + yr : 1900 + yr
  const epoch = new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000)
  const toRad = d => d * Math.PI / 180
  return {
    name,
    epoch,
    incRad:  toRad(parseFloat(l2.substring(8,  16))),
    raanRad: toRad(parseFloat(l2.substring(17, 25))),
    eccen:   parseFloat('0.' + l2.substring(26, 33).trim()),
    argPRad: toRad(parseFloat(l2.substring(34, 42))),
    M0Rad:   toRad(parseFloat(l2.substring(43, 51))),
    nRad:    parseFloat(l2.substring(52, 63)) * 2 * Math.PI / 86400,
    nRevDay: parseFloat(l2.substring(52, 63)),
    lastAlt: 400,
  }
}

function parseTLE(json) {
  return (json.member ?? []).map(s => parseTLELines(s.name, s.line1, s.line2))
}

// ── Propagation (simplified SGP4 — good for near-circular LEO) ───────────────

function gmst(date) {
  const JD = date.getTime() / 86400000 + 2440587.5
  const T  = (JD - 2451545.0) / 36525
  const g  = (280.46061837 + 360.98564736629 * (JD - 2451545.0)
              + 0.000387933 * T * T) * Math.PI / 180
  return ((g % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
}

function solveKepler(M, e) {
  let E = M
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  return E
}

function propagate(sat, date) {
  const dt = (date - sat.epoch) / 1000
  const M  = ((sat.M0Rad + sat.nRad * dt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const E  = solveKepler(M, sat.eccen)

  const nu = 2 * Math.atan2(
    Math.sqrt(1 + sat.eccen) * Math.sin(E / 2),
    Math.sqrt(1 - sat.eccen) * Math.cos(E / 2),
  )

  const mu = 398600.4418
  const a  = Math.cbrt(mu / (sat.nRad * sat.nRad))
  const r  = a * (1 - sat.eccen * Math.cos(E))

  const u    = sat.argPRad + nu
  const xOrb = r * Math.cos(u)
  const yOrb = r * Math.sin(u)

  const ci = Math.cos(sat.incRad), si = Math.sin(sat.incRad)
  const cR = Math.cos(sat.raanRad), sR = Math.sin(sat.raanRad)

  // ECI
  const xECI =  cR * xOrb - sR * yOrb * ci
  const yECI =  sR * xOrb + cR * yOrb * ci
  const zECI =  yOrb * si

  // ECEF (rotate by GMST)
  const th = gmst(date)
  const xE =  xECI * Math.cos(th) + yECI * Math.sin(th)
  const yE = -xECI * Math.sin(th) + yECI * Math.cos(th)
  const zE =  zECI

  const rKm = Math.sqrt(xE*xE + yE*yE + zE*zE)
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, zE / rKm))) * 180 / Math.PI,
    lon: Math.atan2(yE, xE) * 180 / Math.PI,
    alt: rKm - R_EARTH,
  }
}

function toVec3(lat, lon, alt) {
  const rr  = R_GLOBE * (1 + alt / R_EARTH)
  const phi = (90 - lat) * Math.PI / 180
  const th  = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -rr * Math.cos(th) * Math.sin(phi),
     rr * Math.cos(phi),
     rr * Math.sin(th) * Math.sin(phi),
  )
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function altColor(nRevDay) {
  const n   = nRevDay * 2 * Math.PI / 86400
  const alt = Math.cbrt(398600.4418 / (n * n)) - R_EARTH
  if (alt < 2000)  return [0.0, 0.8, 1.0]   // LEO — cyan
  if (alt < 35786) return [0.3, 1.0, 0.5]   // MEO — green
  return [1.0, 0.85, 0.0]                    // GEO — gold
}

function recompute() {
  if (!_satData.length || !_points) return
  const now = new Date()
  const pos = _points.geometry.attributes.position
  for (let i = 0; i < _satData.length; i++) {
    try {
      const { lat, lon, alt } = propagate(_satData[i], now)
      _satData[i].lastAlt = alt
      const v = toVec3(lat, lon, alt)
      pos.setXYZ(i, v.x, v.y, v.z)
    } catch {}
  }
  pos.needsUpdate = true
  _projectToScreen()
}

function _projectToScreen() {
  if (!_camera || !_canvas) return
  _hover = []
  const rect   = _canvas.getBoundingClientRect()
  const camDir = _camera.position.clone().normalize()
  const pos    = _points.geometry.attributes.position
  for (let i = 0; i < _satData.length; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (v.clone().normalize().dot(camDir) < 0.1) continue  // behind globe
    const sc = v.clone().project(_camera)
    _hover.push({
      x: ( sc.x + 1) / 2 * rect.width,
      y: (-sc.y + 1) / 2 * rect.height,
      name: _satData[i].name,
      alt:  _satData[i].lastAlt,
    })
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function onMouseMove(e) {
  if (!_group?.visible) return
  const rect = _canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let nearest = null, minD = 20
  for (const s of _hover) {
    const d = Math.hypot(s.x - mx, s.y - my)
    if (d < minD) { minD = d; nearest = s }
  }
  if (nearest) {
    _tooltip.style.left = (nearest.x + 12) + 'px'
    _tooltip.style.top  = (nearest.y - 10) + 'px'
    _tooltip.innerHTML  =
      `🛰️ <b>${nearest.name}</b><br>` +
      `<span style="color:#888;font-size:11px">${nearest.alt.toFixed(0)} km altitude</span>`
    _tooltip.style.display = 'block'
  } else {
    _tooltip.style.display = 'none'
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initSatellites(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas

  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  _tooltip = document.createElement('div')
  _tooltip.style.cssText = [
    'position:absolute', 'background:rgba(8,8,8,0.85)', 'color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.15)', 'border-radius:8px',
    'padding:6px 10px', 'font-size:12px', 'font-family:system-ui,sans-serif',
    'pointer-events:none', 'display:none', 'z-index:50',
    'white-space:nowrap', 'backdrop-filter:blur(4px)',
  ].join(';')
  document.getElementById('canvas-container').appendChild(_tooltip)
  canvas.addEventListener('mousemove', onMouseMove)

  let json
  try {
    json = await fetch(TLE_URL).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
  } catch (err) {
    console.warn('[satellites] TLE fetch failed:', err)
    return
  }

  _satData = parseTLE(json)
  if (!_satData.length) return

  const n    = _satData.length
  const pos  = new Float32Array(n * 3)
  const col  = new Float32Array(n * 3)

  for (let i = 0; i < n; i++) {
    const [r, g, b] = altColor(_satData[i].nRevDay)
    col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b
    pos[i*3+1] = R_GLOBE + 6
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3))

  _points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.9, depthTest: false,
  }))
  _group.add(_points)

  recompute()
}

export function setSatellitesVisible(v) {
  if (_group) _group.visible = v
  if (!v && _tooltip) _tooltip.style.display = 'none'
}

export function updateSatellites(delta) {
  if (!_group?.visible) return
  _timer += delta
  if (_timer >= UPDATE_S) { _timer = 0; recompute() }
}

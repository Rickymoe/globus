import * as THREE from 'three'
import { feature } from 'topojson-client'

const R = 102
const CLICK_PX = 6

let _scene, _camera, _controls, _canvas
let _features = []
let _selectedGroup = null
let _selectedCentroid = null
let _isDragging = false
let _isRotating = false
let _prevPt = null
let _prevRotAngle = null
let _mousedownPos = null
let _dragModeEnabled = false

let _selectedGeomOffsets = null
let _centroidLatLon = null
let _originalLat = 0
let _rotation = 0          // radians, accumulated rotation around centroid
let _cachedRings = null

// ── geometry helpers ─────────────────────────────────────────────────────────

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

function vec3ToLatLon(v) {
  const n = v.clone().normalize()
  const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI
  let lon = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180
  if (lon < -180) lon += 360
  if (lon >  180) lon -= 360
  return [lat, lon]
}

function mercatorScale(currentLat, origLat) {
  const cosOrig = Math.cos(origLat * Math.PI / 180)
  const cosCurr = Math.cos(currentLat * Math.PI / 180)
  return cosOrig / Math.max(cosCurr, 0.05)
}

function sphericalOffset(centLatR, centLonR, laR, loR) {
  const dLon = loR - centLonR
  const sinCL = Math.sin(centLatR), cosCL = Math.cos(centLatR)
  const sinL  = Math.sin(laR),      cosL  = Math.cos(laR)
  const bearing = Math.atan2(
    Math.sin(dLon) * cosL,
    cosCL * sinL - sinCL * cosL * Math.cos(dLon)
  )
  const cosTheta = sinCL * sinL + cosCL * cosL * Math.cos(dLon)
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)))
  return [bearing, theta]
}

function destinationPoint(centLatR, centLonR, bearing, theta, scale) {
  const d    = theta * scale
  const lat2 = Math.asin(
    Math.sin(centLatR) * Math.cos(d) +
    Math.cos(centLatR) * Math.sin(d) * Math.cos(bearing)
  )
  const lon2 = centLonR + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(centLatR),
    Math.cos(d) - Math.sin(centLatR) * Math.sin(lat2)
  )
  return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI]
}

function computeSphericalOffsets(geom, centLat, centLon) {
  const clr = centLat * Math.PI / 180
  const clnr = centLon * Math.PI / 180
  const vtx = (lo, la) => sphericalOffset(clr, clnr, la * Math.PI / 180, lo * Math.PI / 180)
  return geom.type === 'Polygon'
    ? { type: 'Polygon',      offsets: geom.coordinates.map(r => r.map(([lo, la]) => vtx(lo, la))) }
    : { type: 'MultiPolygon', offsets: geom.coordinates.map(p => p.map(r => r.map(([lo, la]) => vtx(lo, la)))) }
}

function buildScaledLines(offsets, centLat, centLon, scale, rotation) {
  const clr  = centLat * Math.PI / 180
  const clnr = centLon * Math.PI / 180
  const pos  = []
  function addRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [b1, t1] = ring[i];  const [b2, t2] = ring[i + 1]
      const [la1, lo1] = destinationPoint(clr, clnr, b1 + rotation, t1, scale)
      const [la2, lo2] = destinationPoint(clr, clnr, b2 + rotation, t2, scale)
      const a = latLonToVec3(la1, lo1);  const b = latLonToVec3(la2, lo2)
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  if (offsets.type === 'Polygon') { offsets.offsets.forEach(r => addRing(r)) }
  else { offsets.offsets.forEach(p => p.forEach(r => addRing(r))) }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.95 }))
}

function computeRings(offsets, centLat, centLon, scale, rotation) {
  const clr  = centLat * Math.PI / 180
  const clnr = centLon * Math.PI / 180
  const rings = []
  function addRing(ring) {
    rings.push(ring.map(([b, t]) => destinationPoint(clr, clnr, b + rotation, t, scale)))
  }
  if (offsets.type === 'Polygon') { offsets.offsets.forEach(r => addRing(r)) }
  else { offsets.offsets.forEach(p => p.forEach(r => addRing(r))) }
  return rings
}

function pointInRings(lat, lon, rings) {
  let crossings = 0
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [lati, loni] = ring[i];  const [latj, lonj] = ring[j]
      if ((lati > lat) !== (latj > lat)) {
        const lonCross = (lonj - loni) * (lat - lati) / (latj - lati) + loni
        if (lon < lonCross) crossings++
      }
    }
  }
  return (crossings % 2) === 1
}

function isInsideCountry(pt) {
  if (!_cachedRings || !pt) return false
  const [lat, lon] = vec3ToLatLon(pt)
  return pointInRings(lat, lon, _cachedRings)
}

function spherePoint(e) {
  const rect = _canvas.getBoundingClientRect()
  const ndc  = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    ((e.clientY - rect.top)  / rect.height) * -2 + 1,
  )
  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, _camera)
  const target = new THREE.Vector3()
  return ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 101), target)
    ? target : null
}

function centroidScreenPos() {
  const p = _selectedCentroid.clone().project(_camera)
  const rect = _canvas.getBoundingClientRect()
  return {
    x: (p.x + 1) / 2 * rect.width  + rect.left,
    y: (1 - (p.y + 1) / 2) * rect.height + rect.top,
  }
}

function rebuildGroup(lat, lon, scale, rotation) {
  while (_selectedGroup.children.length) {
    const c = _selectedGroup.children[0];  c.geometry.dispose();  _selectedGroup.remove(c)
  }
  _selectedGroup.quaternion.identity()
  _selectedGroup.add(buildScaledLines(_selectedGeomOffsets, lat, lon, scale, rotation))
  _cachedRings = computeRings(_selectedGeomOffsets, lat, lon, scale, rotation)
}

// ── selection ────────────────────────────────────────────────────────────────

function select(f) {
  if (_selectedGroup) { _scene.remove(_selectedGroup); _selectedGroup = null }
  _selectedGeomOffsets = null
  _centroidLatLon = null
  _cachedRings = null
  _rotation = 0
  if (!f) { _selectedCentroid = null; _canvas.style.cursor = ''; return }

  const [centLat, centLon] = vec3ToLatLon(f.centroid3d)
  _centroidLatLon = [centLat, centLon]
  _originalLat = centLat
  _selectedCentroid = f.centroid3d.clone().normalize().multiplyScalar(R)
  _selectedGeomOffsets = computeSphericalOffsets(f.geom, centLat, centLon)
  _cachedRings = computeRings(_selectedGeomOffsets, centLat, centLon, 1, 0)

  _selectedGroup = new THREE.Group()
  _selectedGroup.add(buildScaledLines(_selectedGeomOffsets, centLat, centLon, 1, 0))
  _scene.add(_selectedGroup)
}

function nearestFeature(pt) {
  let best = null, bestD = Infinity
  for (const f of _features) {
    const d = f.centroid3d.distanceTo(pt)
    if (d < bestD) { bestD = d; best = f }
  }
  return best
}

// ── pointer events ───────────────────────────────────────────────────────────

function onPointerDown(e) {
  if (!_dragModeEnabled) return
  _mousedownPos = { x: e.clientX, y: e.clientY }

  if (!_selectedCentroid) return

  if (e.button === 2) {
    // Right-click: start rotation if inside country
    const pt = spherePoint(e)
    if (!pt || !isInsideCountry(pt)) return
    _isRotating = true
    const sc = centroidScreenPos()
    _prevRotAngle = Math.atan2(e.clientY - sc.y, e.clientX - sc.x)
    _controls.enabled = false
    _canvas.style.cursor = 'crosshair'
    _canvas.setPointerCapture(e.pointerId)
    e.stopImmediatePropagation()
    return
  }

  if (e.button === 0) {
    // Left-click: start move if inside country
    const pt = spherePoint(e)
    if (!pt || !isInsideCountry(pt)) return
    _isDragging = true
    _prevPt = pt
    _controls.enabled = false
    _canvas.style.cursor = 'grabbing'
    _canvas.setPointerCapture(e.pointerId)
    e.stopImmediatePropagation()
  }
}

function onPointerMove(e) {
  if (_isRotating) {
    e.stopImmediatePropagation()
    const sc = centroidScreenPos()
    const angle = Math.atan2(e.clientY - sc.y, e.clientX - sc.x)
    _rotation += angle - _prevRotAngle
    _prevRotAngle = angle

    const [lat, lon] = _centroidLatLon
    const scale = mercatorScale(lat, _originalLat)
    rebuildGroup(lat, lon, scale, _rotation)
    return
  }

  if (_isDragging) {
    e.stopImmediatePropagation()
    const pt = spherePoint(e)
    if (!pt) return
    const from = _prevPt.clone().normalize()
    const to   = pt.clone().normalize()
    const axis  = new THREE.Vector3().crossVectors(from, to)
    if (axis.lengthSq() < 1e-12) { _prevPt = pt; return }
    axis.normalize()
    const angle = Math.acos(Math.min(1, Math.max(-1, from.dot(to))))
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)

    _selectedCentroid.applyQuaternion(q)
    const [lat, lon] = vec3ToLatLon(_selectedCentroid)
    _centroidLatLon = [lat, lon]

    const scale = mercatorScale(lat, _originalLat)
    rebuildGroup(lat, lon, scale, _rotation)
    _prevPt = pt
    return
  }

  if (_dragModeEnabled) {
    const pt = spherePoint(e)
    _canvas.style.cursor = isInsideCountry(pt) ? 'grab' : ''
  }
}

function onPointerUp(e) {
  if (_isRotating) {
    _isRotating = false
    _prevRotAngle = null
    _controls.enabled = true
    const pt = spherePoint(e)
    _canvas.style.cursor = isInsideCountry(pt) ? 'grab' : ''
    e.stopImmediatePropagation()
    return
  }

  if (_isDragging) {
    _isDragging = false
    _prevPt = null
    _controls.enabled = true
    const pt = spherePoint(e)
    _canvas.style.cursor = isInsideCountry(pt) ? 'grab' : ''
    e.stopImmediatePropagation()
    return
  }

  if (!_mousedownPos || !_dragModeEnabled) { _mousedownPos = null; return }
  const dx = e.clientX - _mousedownPos.x
  const dy = e.clientY - _mousedownPos.y
  _mousedownPos = null
  if (Math.hypot(dx, dy) > CLICK_PX) return

  // Left-click without drag = select country
  if (e.button === 0) {
    const pt = spherePoint(e)
    if (pt) select(nearestFeature(pt))
  }
}

// ── init ─────────────────────────────────────────────────────────────────────

export async function initDragger(scene, camera, controls, canvas) {
  _scene    = scene
  _camera   = camera
  _controls = controls
  _canvas   = canvas

  const world = await fetch(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  ).then(r => r.json())

  for (const f of feature(world, world.objects.countries).features) {
    const geom = f.geometry
    let ring = geom.type === 'Polygon'
      ? geom.coordinates[0]
      : geom.coordinates.map(p => p[0]).reduce((a, b) => b.length > a.length ? b : a)
    let lo = 0, la = 0
    for (const [x, y] of ring) { lo += x; la += y }
    lo /= ring.length; la /= ring.length

    _features.push({ id: f.id, geom, centroid3d: latLonToVec3(la, lo) })
  }

  _canvas.addEventListener('pointerdown',  onPointerDown, { capture: true })
  _canvas.addEventListener('pointermove',  onPointerMove, { capture: true })
  _canvas.addEventListener('pointerup',    onPointerUp,   { capture: true })
  _canvas.addEventListener('contextmenu',  e => e.preventDefault())

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') select(null)
  })
}

export function setDragMode(enabled) {
  _dragModeEnabled = enabled
  if (!enabled) { select(null); _controls.enabled = true; _canvas.style.cursor = '' }
}

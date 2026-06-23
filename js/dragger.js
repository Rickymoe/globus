import * as THREE from 'three'
import { feature } from 'topojson-client'

const R = 102  // slightly above borders (101.5)
const CLICK_PX = 6      // px movement threshold below which mouseup = click
const GRAB_PX  = 100    // screen-pixel radius to detect grab on selected country

let _scene, _camera, _controls, _canvas
let _features = []          // { id, geom, centroid3d }
let _selectedGroup = null   // THREE.Group with highlighted lines
let _selectedCentroid = null // THREE.Vector3, updated as country moves
let _isDragging = false
let _prevPt = null          // last sphere intersection point
let _mousedownPos = null
let _dragModeEnabled = false

// ── geometry helpers ────────────────────────────────────────────────────────

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
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

function buildLines(geom) {
  const pos = []
  function addRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lo1, la1] = ring[i]; const [lo2, la2] = ring[i + 1]
      const a = latLonToVec3(la1, lo1); const b = latLonToVec3(la2, lo2)
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  if (geom.type === 'Polygon') {
    geom.coordinates.forEach(r => addRing(r))
  } else {
    geom.coordinates.forEach(p => p.forEach(r => addRing(r)))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: 0xff6600, transparent: true, opacity: 0.95,
  }))
}

// ── selection ────────────────────────────────────────────────────────────────

function select(f) {
  if (_selectedGroup) { _scene.remove(_selectedGroup); _selectedGroup = null }
  if (!f) { _selectedCentroid = null; _canvas.style.cursor = ''; return }

  _selectedCentroid = f.centroid3d.clone().normalize().multiplyScalar(R)
  _selectedGroup = new THREE.Group()
  _selectedGroup.add(buildLines(f.geom))
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

function centroidScreenPos() {
  const p = _selectedCentroid.clone().project(_camera)
  const rect = _canvas.getBoundingClientRect()
  return {
    x: (p.x + 1) / 2 * rect.width  + rect.left,
    y: (1 - (p.y + 1) / 2) * rect.height + rect.top,
  }
}

function onPointerDown(e) {
  if (e.button !== 0 || !_dragModeEnabled) return
  _mousedownPos = { x: e.clientX, y: e.clientY }

  if (!_selectedCentroid) return

  const sc = centroidScreenPos()
  const dx = e.clientX - sc.x
  const dy = e.clientY - sc.y
  if (Math.hypot(dx, dy) > GRAB_PX) return

  const pt = spherePoint(e) ?? _selectedCentroid.clone().normalize().multiplyScalar(101)
  _isDragging = true
  _prevPt = pt
  _controls.enabled = false
  _canvas.style.cursor = 'grabbing'
  _canvas.setPointerCapture(e.pointerId)
  e.stopImmediatePropagation()
}

function isNearCentroid(e) {
  if (!_selectedCentroid) return false
  const sc = centroidScreenPos()
  return Math.hypot(e.clientX - sc.x, e.clientY - sc.y) < GRAB_PX
}

function onPointerMove(e) {
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
    _selectedGroup.quaternion.premultiply(q)
    _selectedCentroid.applyQuaternion(q)
    _prevPt = pt
    return
  }

  // Cursor feedback: show grab hand when hovering over selected country
  if (_dragModeEnabled) {
    _canvas.style.cursor = isNearCentroid(e) ? 'grab' : ''
  }
}

function onPointerUp(e) {
  if (_isDragging) {
    _isDragging = false
    _prevPt = null
    _controls.enabled = true
    _canvas.style.cursor = isNearCentroid(e) ? 'grab' : ''
    e.stopImmediatePropagation()
    return
  }
  if (!_mousedownPos || !_dragModeEnabled) { _mousedownPos = null; return }
  const dx = e.clientX - _mousedownPos.x
  const dy = e.clientY - _mousedownPos.y
  _mousedownPos = null
  if (Math.hypot(dx, dy) > CLICK_PX) return

  const pt = spherePoint(e)
  if (pt) select(nearestFeature(pt))
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

  // Use capture phase so we fire before OrbitControls
  _canvas.addEventListener('pointerdown', onPointerDown, { capture: true })
  _canvas.addEventListener('pointermove', onPointerMove, { capture: true })
  _canvas.addEventListener('pointerup',   onPointerUp,   { capture: true })

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') select(null)
  })
}

export function setDragMode(enabled) {
  _dragModeEnabled = enabled
  if (!enabled) { select(null); _controls.enabled = true; _canvas.style.cursor = '' }
}

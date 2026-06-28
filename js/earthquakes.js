import * as THREE from 'three'

const R = 101.5
const PERIOD = 2.5

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

function magColor(mag) {
  if (mag >= 6.0) return 0xff1a1a
  if (mag >= 4.0) return 0xff7700
  return 0xffee00
}

function magScale(mag) {
  if (mag >= 6.0) return 4.0
  if (mag >= 4.0) return 2.5
  return 1.5
}

function magIcon(mag) {
  if (mag >= 6.0) return '🔴'
  if (mag >= 4.0) return '🟠'
  return '🟡'
}

let _group = null
let _rings = []
let _elapsed = 0
let _eventData = []
let _tooltip = null
let _camera = null
let _canvas = null

function createTooltip() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:absolute',
    'background:rgba(0,0,0,0.78)',
    'color:#fff',
    'padding:6px 12px',
    'border-radius:8px',
    'font-size:13px',
    'pointer-events:none',
    'white-space:nowrap',
    'display:none',
    'font-family:system-ui,sans-serif',
    'border:1px solid rgba(255,255,255,0.2)',
    'line-height:1.5',
  ].join(';')
  document.getElementById('canvas-container').appendChild(el)
  return el
}

function onPointerMove(e) {
  if (!_group?.visible || !_camera) { _tooltip.style.display = 'none'; return }

  const rect = _canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const camDir = _camera.position.clone().normalize()
  const proj = new THREE.Vector3()
  let bestDist = 22
  let bestEv = null

  for (const ev of _eventData) {
    const norm = ev.pos.clone().normalize()
    if (norm.dot(camDir) < 0.1) continue
    proj.copy(ev.pos).project(_camera)
    const sx = (proj.x * 0.5 + 0.5) * rect.width
    const sy = (-proj.y * 0.5 + 0.5) * rect.height
    const d = Math.hypot(sx - mx, sy - my)
    if (d < bestDist) { bestDist = d; bestEv = ev }
  }

  if (bestEv) {
    _tooltip.innerHTML =
      `<strong>${bestEv.icon} M ${bestEv.mag.toFixed(1)} – Jordskalv</strong><br>` +
      `<span style="opacity:0.75;font-size:11px">${bestEv.place} · ${bestEv.date}</span>`
    _tooltip.style.display = 'block'
    const tipW = _tooltip.offsetWidth
    const tipH = _tooltip.offsetHeight
    _tooltip.style.left = Math.min(mx + 16, rect.width - tipW - 8) + 'px'
    _tooltip.style.top  = Math.max(my - tipH - 8, 4) + 'px'
  } else {
    _tooltip.style.display = 'none'
  }
}

export async function initEarthquakes(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas
  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  _tooltip = createTooltip()
  canvas.addEventListener('pointermove', onPointerMove)

  let data
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson')
    data = await res.json()
  } catch {
    return
  }

  for (const feature of data.features) {
    const [lon, lat] = feature.geometry.coordinates
    const mag = feature.properties.mag ?? 2.5
    const place = feature.properties.place ?? 'Ukjent'
    const date = feature.properties.time
      ? new Date(feature.properties.time).toISOString().slice(0, 10)
      : ''

    const pos = latLonToVec3(lat, lon)
    const normal = pos.clone().normalize()

    const geo = new THREE.RingGeometry(0.8, 1.2, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: magColor(mag),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

    _group.add(mesh)
    _rings.push({ mesh, maxScale: magScale(mag), phase: Math.random() })
    _eventData.push({ pos, mag, place, date, icon: magIcon(mag) })
  }
}

export function setEarthquakesVisible(visible) {
  if (_group) _group.visible = visible
  if (!visible && _tooltip) _tooltip.style.display = 'none'
}

export function updateEarthquakes(delta) {
  if (!_group?.visible) return
  _elapsed += delta
  for (const { mesh, maxScale, phase } of _rings) {
    const t = ((_elapsed / PERIOD) + phase) % 1
    mesh.scale.setScalar(t * maxScale)
    mesh.material.opacity = 1 - t
  }
}

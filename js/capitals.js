import * as THREE from 'three'

const R = 103

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

function makeCircleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.arc(16, 16, 11, 0, Math.PI * 2)
  ctx.fillStyle = '#e53935'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 2
  ctx.stroke()
  return new THREE.CanvasTexture(canvas)
}

let _points = null
let _capitalsData = []
let _tooltip = null
let _camera = null
let _canvas = null

function createTooltip() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:absolute',
    'background:rgba(0,0,0,0.72)',
    'color:#fff',
    'padding:4px 10px',
    'border-radius:999px',
    'font-size:13px',
    'pointer-events:none',
    'white-space:nowrap',
    'display:none',
    'font-family:system-ui,sans-serif',
    'border:1px solid rgba(255,255,255,0.2)',
  ].join(';')
  document.getElementById('canvas-container').appendChild(el)
  return el
}

function onPointerMove(e) {
  if (!_points?.visible) { _tooltip.style.display = 'none'; return }

  const rect = _canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    ((e.clientY - rect.top)  / rect.height) * -2 + 1,
  )
  const ray = new THREE.Raycaster()
  ray.params.Points.threshold = 3
  ray.setFromCamera(ndc, _camera)

  const hits = ray.intersectObject(_points)
  if (hits.length > 0) {
    const { name } = _capitalsData[hits[0].index]
    _tooltip.textContent = name
    _tooltip.style.display = 'block'
    // Keep tooltip inside canvas
    const x = e.clientX - rect.left + 14
    const y = e.clientY - rect.top - 28
    _tooltip.style.left = Math.min(x, rect.width - _tooltip.offsetWidth - 8) + 'px'
    _tooltip.style.top  = Math.max(y, 4) + 'px'
  } else {
    _tooltip.style.display = 'none'
  }
}

export async function initCapitals(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas
  _tooltip = createTooltip()

  const data = await fetch('data/capitals.json').then(r => r.json())
  _capitalsData = data

  const positions = []
  for (const { lat, lon } of data) {
    const v = latLonToVec3(lat, lon)
    positions.push(v.x, v.y, v.z)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

  _points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 5,
    map: makeCircleTexture(),
    transparent: true,
    alphaTest: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
  }))
  _points.visible = false
  scene.add(_points)

  canvas.addEventListener('pointermove', onPointerMove)
}

export function setCapitalsVisible(visible) {
  if (_points) _points.visible = visible
  if (_tooltip && !visible) _tooltip.style.display = 'none'
}

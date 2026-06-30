import * as THREE from 'three'

let _renderer = null, _camera = null
let _baseRefSpace = null
let _camDist = 280
let _azimuth = 0

const _yAxis      = new THREE.Vector3(0, 1, 0)
const DEAD_ZONE   = 0.12
const ORBIT_SPEED = 1.0   // rad/sec at full stick deflection
const MIN_DIST    = 105
const MAX_DIST    = 2000

export function initVRControls(renderer, camera) {
  _renderer = renderer
  _camera   = camera

  renderer.xr.addEventListener('sessionstart', () => {
    const raw = renderer.xr.getReferenceSpace()
    if (!raw?.getOffsetReferenceSpace) return
    _camDist     = Math.hypot(_camera.position.x, _camera.position.z) || 280
    _azimuth     = 0
    _baseRefSpace = raw
    _applyOffset()
    document.body.classList.add('vr-active')
  })

  renderer.xr.addEventListener('sessionend', () => {
    _baseRefSpace = null
    document.body.classList.remove('vr-active')
  })
}

function _applyOffset() {
  if (!_baseRefSpace) return
  const camX = Math.sin(_azimuth) * _camDist
  const camZ = Math.cos(_azimuth) * _camDist
  _renderer.xr.setReferenceSpace(
    _baseRefSpace.getOffsetReferenceSpace(
      new XRRigidTransform({ x: -camX, y: -1.6, z: -camZ })
    )
  )
}

function _readAxis(axes, i1, i2) {
  const v1 = axes[i1] ?? 0
  const v2 = axes[i2] ?? 0
  const v  = Math.abs(v1) >= Math.abs(v2) ? v1 : v2
  return Math.abs(v) > DEAD_ZONE ? v : 0
}

export function updateVRControls(delta) {
  if (!_renderer?.xr.isPresenting || !_baseRefSpace) return
  const session = _renderer.xr.getSession()
  if (!session) return

  let ax = 0, ay = 0
  for (const src of session.inputSources) {
    if (src.handedness === 'right' && src.gamepad) {
      const a = src.gamepad.axes
      ax = _readAxis(a, 0, 2)
      ay = _readAxis(a, 1, 3)
      break
    }
  }
  if (ax === 0 && ay === 0) return

  // Stick Y: zoom radially (scaled by distance for consistent feel)
  _camDist = THREE.MathUtils.clamp(
    _camDist + ay * _camDist * 0.3 * delta,
    MIN_DIST, MAX_DIST
  )
  // Stick X: orbit horizontally around globe
  _azimuth -= ax * ORBIT_SPEED * delta
  _applyOffset()
}

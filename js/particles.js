import * as THREE from 'three'

const COUNT = 500
const SURFACE_R = 103    // just above the weather overlay sphere

let _points, _pos, _vel
let _gravity = 5         // units/s² toward surface
let _windAngle = 90      // degrees: 0=east 90=south 180=west 270=north

export function initParticles(scene) {
  _pos = new Float32Array(COUNT * 3)
  _vel = new Float32Array(COUNT * 3)

  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = SURFACE_R + Math.random() * 8
    _pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
    _pos[i*3+1] = r * Math.cos(phi)
    _pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(_pos, 3))

  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.6 })
  _points = new THREE.Points(geo, mat)
  scene.add(_points)
}

export function setGravity(value) {
  // slider 0–100 → 0.5–15 units/s²
  _gravity = 0.5 + (value / 100) * 14.5
}

export function setWindDirection(degrees) {
  _windAngle = degrees
}

export function updateParticles(delta) {
  if (!_points) return

  const windRad = (_windAngle * Math.PI) / 180
  const windX = Math.cos(windRad) * 8
  const windZ = Math.sin(windRad) * 8

  for (let i = 0; i < COUNT; i++) {
    const ix = i*3, iy = i*3+1, iz = i*3+2
    let x = _pos[ix], y = _pos[iy], z = _pos[iz]

    const dist = Math.sqrt(x*x + y*y + z*z)
    if (dist < 1e-6) continue
    const nx = x/dist, ny = y/dist, nz = z/dist

    // dampen velocity to prevent unbounded accumulation
    _vel[ix] *= 0.97; _vel[iy] *= 0.97; _vel[iz] *= 0.97

    // pull toward surface
    _vel[ix] -= nx * _gravity * delta
    _vel[iy] -= ny * _gravity * delta
    _vel[iz] -= nz * _gravity * delta

    // lateral wind push
    _vel[ix] += windX * delta
    _vel[iz] += windZ * delta

    x += _vel[ix] * delta
    y += _vel[iy] * delta
    z += _vel[iz] * delta

    // reset particle if it leaves the near-surface band
    const newDist = Math.sqrt(x*x + y*y + z*z)
    if (newDist < SURFACE_R - 2 || newDist > SURFACE_R + 20) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = SURFACE_R + Math.random() * 5
      x = r * Math.sin(phi) * Math.cos(theta)
      y = r * Math.cos(phi)
      z = r * Math.sin(phi) * Math.sin(theta)
      _vel[ix] = 0; _vel[iy] = 0; _vel[iz] = 0
    }

    _pos[ix] = x; _pos[iy] = y; _pos[iz] = z
  }

  _points.geometry.attributes.position.needsUpdate = true
}

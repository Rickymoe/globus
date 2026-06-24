import * as THREE from 'three'

const R = 101.5
const SEGMENTS = 360

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

function makeLatLine(lat, color, opacity) {
  const pos = []
  for (let i = 0; i < SEGMENTS; i++) {
    const lon1 = -180 + (360 / SEGMENTS) * i
    const lon2 = -180 + (360 / SEGMENTS) * (i + 1)
    const a = latLonToVec3(lat, lon1)
    const b = latLonToVec3(lat, lon2)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
}

const _lines = {}

export function initLatLines(scene) {
  _lines.equator = makeLatLine(0, 0x4fc3f7, 0.7)
  _lines.equator.visible = false
  scene.add(_lines.equator)
}

export function setEquatorVisible(visible) {
  if (_lines.equator) _lines.equator.visible = visible
}

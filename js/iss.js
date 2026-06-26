import * as THREE from 'three'

const R_ISS = 106.4

let _group = null
let _coreDot = null
let _glowDot = null

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R_ISS * Math.cos(theta) * Math.sin(phi),
     R_ISS * Math.cos(phi),
     R_ISS * Math.sin(theta) * Math.sin(phi),
  )
}

function updateIssPosition(lat, lon) {
  const v = latLonToVec3(lat, lon)
  const pos = new Float32Array([v.x, v.y, v.z])
  if (_coreDot) _coreDot.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (_glowDot) _glowDot.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
}

async function fetchAndUpdate() {
  try {
    const res  = await fetch('https://api.open-notify.org/iss-now.json')
    const data = await res.json()
    const lat  = parseFloat(data.iss_position.latitude)
    const lon  = parseFloat(data.iss_position.longitude)
    updateIssPosition(lat, lon)
  } catch {
    // silently ignore fetch errors
  }
}

export async function initIss(scene) {
  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  const geo1 = new THREE.BufferGeometry()
  geo1.setAttribute('position', new THREE.Float32BufferAttribute([0, R_ISS, 0], 3))
  _coreDot = new THREE.Points(geo1, new THREE.PointsMaterial({
    color: 0xffffff,
    size: 8,
    sizeAttenuation: true,
    depthTest: false,
  }))
  _group.add(_coreDot)

  const geo2 = new THREE.BufferGeometry()
  geo2.setAttribute('position', new THREE.Float32BufferAttribute([0, R_ISS, 0], 3))
  _glowDot = new THREE.Points(geo2, new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthTest: false,
  }))
  _group.add(_glowDot)

  await fetchAndUpdate()
  setInterval(fetchAndUpdate, 10000)
}

export function setIssVisible(visible) {
  if (_group) _group.visible = visible
}

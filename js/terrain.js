import * as THREE from 'three'

const BASE = 'https://threejs.org/examples/textures/planets/'

let _terrainMesh, _backMesh, _waterMesh, _wireMesh

export function initTerrain(scene) {
  const loader = new THREE.TextureLoader()

  const colorMap  = loader.load(BASE + 'earth_atmos_2048.jpg')
  const normalMap = loader.load(BASE + 'earth_normal_2048.jpg')

  const geo = new THREE.SphereGeometry(100, 64, 64)

  // Back faces rendered first — shows far side of Earth through transparent front
  _backMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: colorMap,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    roughness: 0.8,
    metalness: 0.1,
  }))
  scene.add(_backMesh)

  // Front faces — normal view
  _terrainMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  }))
  scene.add(_terrainMesh)

  // Lat/lon grid lines — visible in transparent mode
  _wireMesh = new THREE.Mesh(
    new THREE.SphereGeometry(100.5, 36, 18),
    new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    })
  )
  _wireMesh.visible = false
  scene.add(_wireMesh)

  // Water sphere
  _waterMesh = new THREE.Mesh(
    new THREE.SphereGeometry(101, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x1a6eb5,
      transparent: true,
      opacity: 0.15,
      shininess: 120,
    })
  )
  scene.add(_waterMesh)
}

export function setSeaLevel(value) {
  if (!_waterMesh) return
  const scale = 0.985 + (value / 100) * 0.03
  _waterMesh.scale.setScalar(scale)
}

export function setOpacity(transparent) {
  if (!_terrainMesh) return
  if (transparent) {
    _terrainMesh.material.opacity = 0.55
    _backMesh.material.opacity = 0.22
    _wireMesh.visible = true
  } else {
    _terrainMesh.material.opacity = 1.0
    _backMesh.material.opacity = 0
    _wireMesh.visible = false
  }
}

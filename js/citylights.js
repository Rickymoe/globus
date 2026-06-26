import * as THREE from 'three'

const BASE = 'https://threejs.org/examples/textures/planets/'
let _mesh = null

export function initCityLights(scene) {
  const texture = new THREE.TextureLoader().load(BASE + 'earth_lights_2048.png')
  const geo = new THREE.SphereGeometry(100.2, 64, 64)
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  _mesh = new THREE.Mesh(geo, mat)
  _mesh.visible = false
  _mesh.renderOrder = 1
  scene.add(_mesh)
}

export function setCityLightsVisible(visible) {
  if (_mesh) _mesh.visible = visible
}

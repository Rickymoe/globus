import * as THREE from 'three'

const BASE = 'https://threejs.org/examples/textures/planets/'

let _terrainMesh, _backMesh, _waterMesh

export function initTerrain(scene) {
  const loader = new THREE.TextureLoader()

  const colorMap  = loader.load(BASE + 'earth_atmos_2048.jpg')
  const normalMap = loader.load(BASE + 'earth_normal_2048.jpg')

  const geo = new THREE.SphereGeometry(100, 64, 64)

  // Back faces rendered first — cool blue tint signals "far side" depth cue
  _backMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: colorMap,
    color: 0x7799cc,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
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

  // Atmosphere glow — canvas ring gradient on billboard sprite:
  // bright blue at earth's rim, smooth fade to transparent into space.
  // Sprite always faces camera, depth-tested so center is hidden behind earth.
  {
    const R_ATM = 130          // outer glow radius in world units
    const size  = 512
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const c      = size / 2                    // texture centre (256 px)
    const rEarth = c * (100 / R_ATM)           // earth rim in texture px ≈ 197
    const rAtm   = c                           // outer glow in texture px = 256

    // Build radial gradient: transparent → peak blue at earth edge → transparent at space
    const grad = ctx.createRadialGradient(c, c, rEarth * 0.9, c, c, rAtm)
    grad.addColorStop(0,    'rgba(30, 100, 255, 0.0)')
    grad.addColorStop(0.15, 'rgba(30, 100, 255, 0.85)')
    grad.addColorStop(1,    'rgba(30, 100, 255, 0.0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }))
    sprite.scale.set(R_ATM * 2, R_ATM * 2, 1)
    scene.add(sprite)
  }

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
    _terrainMesh.material.opacity = 0.45
    _backMesh.material.opacity = 0.55
  } else {
    _terrainMesh.material.opacity = 1.0
    _backMesh.material.opacity = 0
  }
}

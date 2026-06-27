import * as THREE from 'three'

let _terrainMesh, _backMesh, _waterMesh, _atmSprite

export function initTerrain(scene) {
  const loader = new THREE.TextureLoader()

  const colorMap  = loader.load('textures/earth/daymap_5400.jpg')
  const normalMap = loader.load('textures/earth/normal_2048.jpg')

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

    _atmSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }))
    _atmSprite.scale.set(R_ATM * 2, R_ATM * 2, 1)
    scene.add(_atmSprite)
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

let _savedTerrainMat = null

export function setCenterEyeMode(active) {
  if (!_terrainMesh) return
  if (active) {
    _savedTerrainMat = _terrainMesh.material
    _terrainMesh.material = new THREE.MeshStandardMaterial({
      map: _savedTerrainMat.map,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.BackSide,
    })
    if (_waterMesh) _waterMesh.visible = false
  } else {
    if (_savedTerrainMat) {
      _terrainMesh.material.dispose()
      _terrainMesh.material = _savedTerrainMat
      _savedTerrainMat = null
    }
    if (_waterMesh) _waterMesh.visible = true
  }
}

export function updateAtmGlow(camDist) {
  if (!_atmSprite) return
  const fade = Math.max(0, 1 - (camDist - 120) / 80)
  _atmSprite.material.opacity = fade
  _atmSprite.visible = fade > 0
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

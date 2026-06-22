import * as THREE from 'three'

const ZOOM = 2
const TILE_PX = 256
const GRID = Math.pow(2, ZOOM)          // 4 tiles per row/col
const CANVAS_PX = TILE_PX * GRID        // 1024×1024 canvas

let _overlayMesh, _texture, _ctx

export function initWeather(scene) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_PX
  canvas.height = CANVAS_PX
  _ctx = canvas.getContext('2d')

  _texture = new THREE.CanvasTexture(canvas)

  const geo = new THREE.SphereGeometry(102, 64, 64)
  const mat = new THREE.MeshBasicMaterial({
    map: _texture,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  _overlayMesh = new THREE.Mesh(geo, mat)
  scene.add(_overlayMesh)
}

export function setWeatherVisible(visible) {
  if (_overlayMesh) _overlayMesh.visible = visible
}

export async function fetchCloudTiles(apiKey) {
  if (!_ctx || !_texture) return
  _ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX)
  const loads = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const url = `https://tile.openweathermap.org/map/clouds_new/${ZOOM}/${x}/${y}.png?appid=${apiKey}`
      loads.push(_loadTile(url, x, y))
    }
  }
  await Promise.all(loads)
  _texture.needsUpdate = true
}

function _loadTile(url, x, y) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      _ctx.drawImage(img, x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })
}

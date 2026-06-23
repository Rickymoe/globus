import * as THREE from 'three'
import { mesh } from 'topojson-client'

const R = 101.5  // above water sphere (r=101) so depth test passes correctly
let _lines = null

export function setBordersVisible(visible) {
  if (_lines) _lines.visible = visible
}

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

export async function initBorders(scene) {
  const world = await fetch(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  ).then(r => r.json())

  const borders = mesh(world, world.objects.countries)

  const positions = []
  for (const line of borders.coordinates) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon1, lat1] = line[i]
      const [lon2, lat2] = line[i + 1]
      const a = latLonToVec3(lat1, lon1)
      const b = latLonToVec3(lat2, lon2)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

  _lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: 0xffee44,
    transparent: true,
    opacity: 0.8,
  }))
  scene.add(_lines)
}

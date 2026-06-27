import * as THREE from 'three'

let _mesh = null
let _group = null
let _visible = false

const vertexShader = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
varying vec3 vWorldPos;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float h6 = h * 6.0;
  float x = c * (1.0 - abs(mod(h6, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if (h6 < 1.0)      rgb = vec3(c, x, 0.0);
  else if (h6 < 2.0) rgb = vec3(x, c, 0.0);
  else if (h6 < 3.0) rgb = vec3(0.0, c, x);
  else if (h6 < 4.0) rgb = vec3(0.0, x, c);
  else if (h6 < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);
  return rgb + m;
}

void main() {
  vec3 n = normalize(vWorldPos);
  float lon = atan(n.z, n.x);
  float zone = floor(lon / (3.14159265 / 12.0) + 0.5);
  zone = clamp(zone, -12.0, 11.0);
  float t = (zone + 12.0) / 24.0;
  vec3 col = hsl2rgb(t, 0.75, 0.5);
  gl_FragColor = vec4(col, 0.3);
}
`

function buildBands(scene) {
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
  })
  _mesh = new THREE.Mesh(new THREE.SphereGeometry(100.5, 72, 36), mat)
  _mesh.renderOrder = 1
  _mesh.visible = _visible
  scene.add(_mesh)
}

function makeSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 40
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, 128, 40)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 20)
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false,
  })
  return new THREE.Sprite(mat)
}

function buildLabels(scene) {
  _group = new THREE.Group()
  const lat = 20 * Math.PI / 180
  const r = 104

  for (let n = -12; n <= 11; n++) {
    const lon = n * 15 * Math.PI / 180
    const sprite = makeSprite(n >= 0 ? `UTC+${n}` : `UTC${n}`)
    sprite.position.set(
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.sin(lon)
    )
    sprite.scale.set(9, 2.8, 1)
    _group.add(sprite)
  }

  _group.visible = _visible
  scene.add(_group)
}

export function initTimezones(scene) {
  buildBands(scene)
  buildLabels(scene)
}

export function setTimezonesVisible(v) {
  _visible = v
  if (_mesh) _mesh.visible = v
  if (_group) _group.visible = v
}

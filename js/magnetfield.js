import * as THREE from 'three'

let _lines = null
let _points = null
let _visible = false
let _elapsed = 0

const TILT = 11 * Math.PI / 180
const L_SHELLS = [1.1, 1.5, 2.0, 2.5]
const MERIDIANS = 12
const STEPS = 80
const PARTICLE_COUNT = 2000

function dipolePt(L, lam, lon) {
  const r = L * Math.cos(lam) ** 2 * 100
  const x = r * Math.cos(lam) * Math.cos(lon)
  const y = r * Math.sin(lam)
  const z = r * Math.cos(lam) * Math.sin(lon)
  // 11° tilt rundt Z-aksen
  return [
    x * Math.cos(TILT) - y * Math.sin(TILT),
    x * Math.sin(TILT) + y * Math.cos(TILT),
    z,
  ]
}

function buildLines(scene) {
  const positions = []
  for (const L of L_SHELLS) {
    for (let m = 0; m < MERIDIANS; m++) {
      const lon = (m / MERIDIANS) * 2 * Math.PI
      for (let i = 0; i < STEPS; i++) {
        const lam0 = ((i / STEPS) - 0.5) * Math.PI * (160 / 180)
        const lam1 = (((i + 1) / STEPS) - 0.5) * Math.PI * (160 / 180)
        positions.push(...dipolePt(L, lam0, lon))
        positions.push(...dipolePt(L, lam1, lon))
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const mat = new THREE.LineBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: false,
  })
  _lines = new THREE.LineSegments(geo, mat)
  _lines.renderOrder = 3
  _lines.visible = _visible
  scene.add(_lines)
}

const vertexShader = `
attribute float aL;
attribute float aMagLon;
attribute float aPhase;
attribute float aSpeed;
uniform float uTime;

void main() {
  float t = mod(aPhase + uTime * aSpeed, 1.0);
  float lam = (t - 0.5) * 3.14159265 * (160.0 / 180.0);
  float cosLam = cos(lam);
  float r = aL * cosLam * cosLam * 100.0;

  float x = r * cosLam * cos(aMagLon);
  float y = r * sin(lam);
  float z = r * cosLam * sin(aMagLon);

  // 11 graders tilt rundt Z
  float tilt = 0.19199111;
  float xr = x * cos(tilt) - y * sin(tilt);
  float yr = x * sin(tilt) + y * cos(tilt);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(xr, yr, z, 1.0);
  gl_PointSize = 3.0;
}
`

const fragmentShader = `
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  if (length(uv) > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, length(uv)) * 0.85;
  gl_FragColor = vec4(0.45, 0.75, 1.0, alpha);
}
`

function buildParticles(scene) {
  const aL      = new Float32Array(PARTICLE_COUNT)
  const aMagLon = new Float32Array(PARTICLE_COUNT)
  const aPhase  = new Float32Array(PARTICLE_COUNT)
  const aSpeed  = new Float32Array(PARTICLE_COUNT)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    aL[i]      = L_SHELLS[Math.floor(Math.random() * L_SHELLS.length)]
    aMagLon[i] = Math.random() * 2 * Math.PI
    aPhase[i]  = Math.random()
    aSpeed[i]  = 0.08 + Math.random() * 0.10
  }

  const geo = new THREE.BufferGeometry()
  // Dummy positions — vertex shader bestemmer faktisk posisjon
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3))
  geo.setAttribute('aL',       new THREE.Float32BufferAttribute(aL,      1))
  geo.setAttribute('aMagLon',  new THREE.Float32BufferAttribute(aMagLon, 1))
  geo.setAttribute('aPhase',   new THREE.Float32BufferAttribute(aPhase,  1))
  geo.setAttribute('aSpeed',   new THREE.Float32BufferAttribute(aSpeed,  1))

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })

  _points = new THREE.Points(geo, mat)
  _points.renderOrder = 4
  _points.frustumCulled = false
  _points.visible = _visible
  scene.add(_points)
}

export function initMagnetField(scene) {
  buildLines(scene)
  buildParticles(scene)
}

export function setMagnetFieldVisible(v) {
  _visible = v
  if (_lines)  _lines.visible  = v
  if (_points) _points.visible = v
}

export function updateMagnetField(delta) {
  if (!_points || !_visible) return
  _elapsed += delta
  _points.material.uniforms.uTime.value = _elapsed
}

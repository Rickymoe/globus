import * as THREE from 'three'

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal  = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim  = 1.0 - abs(dot(vNormal, vViewDir));
    float glow = pow(rim, 3.5);
    gl_FragColor = vec4(0.25, 0.55, 1.0, glow * 0.7);
  }
`

const haloFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim  = 1.0 - abs(dot(vNormal, vViewDir));
    float halo = pow(rim, 6.0);
    gl_FragColor = vec4(0.2, 0.5, 1.0, halo * 0.25);
  }
`

let _mesh = null
let _halo = null

export function initAtmosphere(scene) {
  const geo = new THREE.SphereGeometry(115, 64, 64)
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  _mesh = new THREE.Mesh(geo, mat)
  scene.add(_mesh)

  // Ytre halo for myk fade mot verdensrommet
  const haloGeo = new THREE.SphereGeometry(135, 64, 64)
  const haloMat = new THREE.ShaderMaterial({
    vertexShader,
    haloFragmentShader,
    fragmentShader: haloFragmentShader,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  _halo = new THREE.Mesh(haloGeo, haloMat)
  scene.add(_halo)
}

export function setAtmosphereVisible(v) {
  if (_mesh) _mesh.visible = v
  if (_halo) _halo.visible = v
}

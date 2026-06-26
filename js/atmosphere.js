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
  scene.add(new THREE.Mesh(geo, mat))
}

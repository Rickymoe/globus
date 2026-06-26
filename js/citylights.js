import * as THREE from 'three'

const BASE = 'https://threejs.org/examples/textures/planets/'
let _mesh = null

const vertexShader = `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uLightsMap;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vec4 lights = texture2D(uLightsMap, vUv);
  float sunDot = dot(vWorldNormal, normalize(uSunDir));
  float nightFactor = smoothstep(0.1, -0.2, sunDot);
  gl_FragColor = lights * nightFactor;
}
`

export function initCityLights(scene) {
  const texture = new THREE.TextureLoader().load(BASE + 'earth_lights_2048.png')
  const geo = new THREE.SphereGeometry(100.2, 64, 64)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightsMap: { value: texture },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
  _mesh = new THREE.Mesh(geo, mat)
  _mesh.visible = false
  _mesh.renderOrder = 1
  scene.add(_mesh)
}

export function updateCityLights(sunDir) {
  if (_mesh && _mesh.visible) {
    _mesh.material.uniforms.uSunDir.value.copy(sunDir)
  }
}

export function setCityLightsVisible(visible) {
  if (_mesh) _mesh.visible = visible
}

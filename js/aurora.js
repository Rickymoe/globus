import * as THREE from 'three'

let _mesh = null
let _elapsed = 0

const vertexShader = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float uTime;
uniform float uActivity;   // 0.0 (quiet) → 1.0 (extreme storm)
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldPos);
  float lat    = asin(clamp(n.y, -1.0, 1.0));
  float lon    = atan(n.z, n.x);
  float absLat = abs(lat);

  // Auroral oval: expands to lower latitudes as activity rises
  // Quiet (Kp≈0): 62–78°  |  Extreme (Kp=9): ~45–63°
  float expand = uActivity * 0.30;
  float aMin = 1.082 - expand;
  float aMax = 1.361 - expand;
  float inZone = smoothstep(aMin, aMin + 0.12, absLat) *
                 smoothstep(aMax + 0.12, aMax, absLat);

  if (inZone < 0.001) discard;

  // Layered wave animation — speed scales with activity
  float spd = 1.0 + uActivity * 0.6;
  float w1 = sin(lon * 7.0  + uTime * 0.7  * spd + lat * 14.0);
  float w2 = sin(lon * 4.0  - uTime * 0.4  * spd + lat *  9.0 + 1.8);
  float w3 = sin(lon * 11.0 + uTime * 1.1  * spd - lat *  6.0 + 3.5);
  float intensity = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.5 + 0.5;
  intensity = pow(intensity, 1.2) * (0.45 + uActivity * 0.55);

  // Color: green↔cyan at low activity, adds red/pink at high activity (Kp > 6)
  float colorPhase = sin(uTime * 0.25 + lon * 2.5) * 0.5 + 0.5;
  vec3 green  = vec3(0.0,  1.0,  0.35);
  vec3 cyan   = vec3(0.15, 0.85, 1.0);
  vec3 purple = vec3(0.7,  0.2,  1.0);
  vec3 red    = vec3(1.0,  0.15, 0.3);
  vec3 col = mix(green, cyan, colorPhase);
  col = mix(col, purple, smoothstep(0.7, 1.0, colorPhase));
  // Blend in red/pink at storm-level activity
  col = mix(col, red, smoothstep(0.55, 1.0, uActivity) * 0.5);

  float alpha = inZone * intensity * (0.65 + uActivity * 0.35);
  gl_FragColor = vec4(col, alpha);
}
`

export function initAurora(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:     { value: 0 },
      uActivity: { value: 0.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  })
  _mesh = new THREE.Mesh(new THREE.SphereGeometry(101, 64, 64), mat)
  _mesh.visible = false
  _mesh.renderOrder = 2
  scene.add(_mesh)
}

export function setAuroraActivity(level) {
  if (_mesh) _mesh.material.uniforms.uActivity.value = level
}

export function updateAurora(delta) {
  if (_mesh?.visible) {
    _elapsed += delta
    _mesh.material.uniforms.uTime.value = _elapsed
  }
}

export function setAuroraVisible(visible) {
  if (_mesh) _mesh.visible = visible
}

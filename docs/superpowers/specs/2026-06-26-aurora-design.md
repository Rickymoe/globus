# Aurora Borealis — Design

**Dato:** 2026-06-26
**Repo:** Rickymoe/globus

## Oversikt

Animerte polarlys (aurora borealis/australis) som grønne/lilla bølger rundt 65-75°N og S. Implementert som custom ShaderMaterial med `uTime`-uniform for animasjon.

## Filer som påvirkes

- **Ny:** `js/aurora.js` — ShaderMaterial sphere, uTime, toggle
- **Modifiser:** `index.html` — 🌌-toggle
- **Modifiser:** `js/controls.js` — onAurora callback
- **Modifiser:** `js/app.js` — import, init, loop-update

## Teknisk tilnærming

### Geometri og plassering

- SphereGeometry(101, 64, 64) — over terreng (100), under borders (101.5)
- BackSide: false (FrontSide standard)
- renderOrder = 2 (over city lights)

### Vertex shader

```glsl
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Fragment shader

```glsl
uniform float uTime;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldPos);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  float absLat = abs(lat);

  // Auroral oval: 62-78 degrees
  float aMin = 1.082;  // 62 deg
  float aMax = 1.361;  // 78 deg
  float inZone = smoothstep(aMin, aMin + 0.12, absLat) *
                 smoothstep(aMax + 0.12, aMax, absLat);

  if (inZone < 0.001) discard;

  // Layered wave animation
  float w1 = sin(lon * 7.0 + uTime * 0.7 + lat * 14.0);
  float w2 = sin(lon * 4.0 - uTime * 0.4 + lat * 9.0 + 1.8);
  float w3 = sin(lon * 11.0 + uTime * 1.1 - lat * 6.0 + 3.5);
  float intensity = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.5 + 0.5;
  intensity = pow(intensity, 1.5);

  // Color: green <-> cyan, with purple hints
  float colorPhase = sin(uTime * 0.25 + lon * 2.5) * 0.5 + 0.5;
  vec3 green  = vec3(0.0, 1.0, 0.35);
  vec3 cyan   = vec3(0.15, 0.85, 1.0);
  vec3 purple = vec3(0.7, 0.2, 1.0);
  vec3 col = mix(green, cyan, colorPhase);
  col = mix(col, purple, smoothstep(0.7, 1.0, colorPhase));

  float alpha = inZone * intensity * 0.55;
  gl_FragColor = vec4(col, alpha);
}
```

### aurora.js

```js
import * as THREE from 'three'

let _mesh = null
let _elapsed = 0

const vertexShader = `...` // see above
const fragmentShader = `...` // see above

export function initAurora(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader, fragmentShader,
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

export function updateAurora(delta) {
  if (_mesh && _mesh.visible) {
    _elapsed += delta
    _mesh.material.uniforms.uTime.value = _elapsed
  }
}

export function setAuroraVisible(visible) {
  if (_mesh) _mesh.visible = visible
}
```

### index.html

```html
<div id="aurora-toggle" class="float-toggle" title="Polarlys (Aurora Borealis)">
  <span class="toggle-icon">🌌</span>
  <div class="toggle-track"><div class="toggle-thumb"></div></div>
</div>
```
Etter `#citylights-toggle`.

### controls.js

Legg til `onAurora` parameter og `makeToggle('aurora-toggle', onAurora)`.

### app.js

```js
import { initAurora, setAuroraVisible, updateAurora } from './aurora.js'
// init: initAurora(scene)
// controls: onAurora: setAuroraVisible
// loop: updateAurora(delta)
```

## Dekomponering

**Task 1:** Opprett js/aurora.js og koble inn i index.html, controls.js, app.js

(Én task — selvforsynt modul)

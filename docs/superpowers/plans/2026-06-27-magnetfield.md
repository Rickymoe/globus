# Magnetfelt-visualisering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til jordens magnetfelt (dipol-feltlinjer + GPU-animerte partikler) som aktiveres av den eksisterende Polarlys-togglen (🌌).

**Architecture:** Ny modul `js/magnetfield.js` med to Three.js-objekter: (1) `LineSegments` med pre-beregnede dipol-feltlinjer (CPU, én gang), (2) `Points` med GLSL vertex shader som animerer partikler langs feltbanene på GPU. Begge styres av async-safe `_visible`-mønster. `app.js` kobler `onAurora`-callbacken til begge.

**Tech Stack:** Three.js r165 (ES modules), GLSL, ingen nye avhengigheter.

## Global Constraints

- Three.js importert via importmap som `'three'` (ikke CDN-URL direkte)
- Alle nye mesh: `depthWrite: false`, `depthTest: false`, `transparent: true`
- Async-safe visibility: lagre `_visible`, anvend ved mesh-opprettelse
- Lokal test: `python3 -m http.server 8090` fra `/home/ricky/Dokumenter/Koding/globus/`
- Ingen endringer i `index.html` eller `controls.js`
- renderOrder feltlinjer=3, partikler=4 (over aurora renderOrder=2)

---

### Task 1: Opprett `js/magnetfield.js` med feltlinjer og partikkel-shader

**Files:**
- Create: `js/magnetfield.js`

**Interfaces:**
- Consumes: ingenting fra andre moduler
- Produces:
  - `initMagnetField(scene: THREE.Scene): void`
  - `setMagnetFieldVisible(v: boolean): void`
  - `updateMagnetField(delta: number): void`

- [ ] **Steg 1: Opprett filen med dipol-hjelpe­funksjon og feltlinjer**

Opprett `/home/ricky/Dokumenter/Koding/globus/js/magnetfield.js` med dette innholdet:

```js
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
```

- [ ] **Steg 2: Legg til partikkel-shader og eksporter**

Legg til resten av filen (etter `buildLines`):

```js
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
```

- [ ] **Steg 3: Verifiser at filen ikke har syntaksfeil**

```bash
cd /home/ricky/Dokumenter/Koding/globus
node --input-type=module < /dev/null 2>&1 || true
# Sjekk manuelt: ingen åpenbare syntaksfeil i editoren
```

Åpne `http://localhost:8090` i browser (start server: `python3 -m http.server 8090`). Konsollen skal ikke vise importfeil fra magnetfield.js ennå (modulen er ikke importert ennå).

- [ ] **Steg 4: Commit**

```bash
cd /home/ricky/Dokumenter/Koding/globus
git add js/magnetfield.js
git commit -m "feat: magnetfield module – dipole lines + GPU particle shader"
```

---

### Task 2: Koble `magnetfield.js` inn i `app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes:
  - `initMagnetField(scene)` fra `./magnetfield.js`
  - `setMagnetFieldVisible(v)` fra `./magnetfield.js`
  - `updateMagnetField(delta)` fra `./magnetfield.js`
- Produces: Polarlys-toggle aktiverer nå både aurora og magnetfelt

- [ ] **Steg 1: Legg til import øverst i `app.js`**

Finn linjen:
```js
import { initAurora, setAuroraVisible, updateAurora } from './aurora.js'
```

Legg til rett etter:
```js
import { initMagnetField, setMagnetFieldVisible, updateMagnetField } from './magnetfield.js'
```

- [ ] **Steg 2: Kall `initMagnetField` i init-sekvensen**

Finn:
```js
  initAurora(scene)
```

Legg til rett etter:
```js
  initMagnetField(scene)
```

- [ ] **Steg 3: Oppdater `onAurora`-callback**

Finn:
```js
    onAurora: setAuroraVisible,
```

Bytt ut med:
```js
    onAurora: v => { setAuroraVisible(v); setMagnetFieldVisible(v) },
```

- [ ] **Steg 4: Legg til `updateMagnetField` i loop**

Finn:
```js
    updateAurora(delta)
```

Legg til rett etter:
```js
    updateMagnetField(delta)
```

- [ ] **Steg 5: Visuell verifisering i browser**

Start server hvis ikke kjørende:
```bash
cd /home/ricky/Dokumenter/Koding/globus && python3 -m http.server 8090
```

Åpne `http://localhost:8090` og:
1. Klikk 🌌-togglen → feltlinjer skal dukke opp rundt globen som blå buede linjer fra pol til pol
2. Hvite/blå partikler skal animere langs feltlinjene
3. Klikk togglen av → alt forsvinner
4. Sjekk at andre toggles (sol, aurora-ring, jordskjelv) fremdeles fungerer
5. Åpne DevTools → Console: ingen feil

- [ ] **Steg 6: Commit og push**

```bash
cd /home/ricky/Dokumenter/Koding/globus
git add js/app.js
git commit -m "feat: wire magnetfield to aurora toggle (issue #22)"
git push
```

- [ ] **Steg 7: Lukk issue #22**

```bash
gh issue close 22 --repo Rickymoe/globus --comment "Implementert: dipol-feltlinjer + GPU-partikler aktivert av Polarlys-toggle"
```

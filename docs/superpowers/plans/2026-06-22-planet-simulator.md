# Planet Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive 3D Earth globe with terrain displacement, adjustable sea level, OpenWeatherMap cloud overlay, and particle-based gravity/wind simulation.

**Architecture:** Three-layer sphere stack (terrain r=100, water r=101, weather overlay r=102) in Three.js. ES modules via importmap — no build step required. Each JS module owns one concern and exports a clean API. `app.js` is the entry point that wires everything together.

**Tech Stack:** Three.js r165 (jsdelivr CDN), OrbitControls (Three.js addon), OpenWeatherMap Tiles API, vanilla HTML/CSS/JS

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | HTML structure, importmap, panel markup |
| `css/style.css` | Dark theme, panel layout, slider styling |
| `js/app.js` | Entry point — init sequence, wires modules together |
| `js/globe.js` | Three.js renderer, scene, camera, lights, OrbitControls, animation loop |
| `js/terrain.js` | Terrain sphere (texture + displacement), water sphere, sea level API |
| `js/weather.js` | OWM tile fetching, canvas texture, overlay sphere, cloud toggle |
| `js/particles.js` | 500-point particle system, gravity + wind per-frame physics |
| `js/controls.js` | DOM event binding — maps sliders/toggles to module callbacks |

---

## Task 1: Project scaffold

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/app.js`
- Create: `js/globe.js`
- Create: `js/terrain.js`
- Create: `js/weather.js`
- Create: `js/particles.js`
- Create: `js/controls.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planet Simulator</title>
  <link rel="stylesheet" href="css/style.css">
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <div id="canvas-container"></div>
  <aside id="panel">
    <h2>Planet Simulator</h2>

    <label>🌊 Havnivå
      <input type="range" id="sea-level" min="0" max="100" value="50">
    </label>

    <label>🌍 Gravitasjon
      <input type="range" id="gravity" min="0" max="100" value="50">
    </label>

    <label>💨 Vindretning
      <input type="range" id="wind-direction" min="0" max="360" value="90">
      <span id="wind-arrow">→</span>
    </label>

    <label class="toggle-row">
      <span>👁 Gjennomsiktig</span>
      <input type="checkbox" id="toggle-transparent">
    </label>

    <label class="toggle-row">
      <span>☁️ Skylag</span>
      <input type="checkbox" id="toggle-clouds" checked>
    </label>

    <button id="btn-refresh-weather">🔄 Oppdater vær</button>

    <div id="owm-key-section">
      <label>OWM API-nøkkel
        <input type="text" id="owm-api-key" placeholder="din_nøkkel_her">
      </label>
    </div>
  </aside>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create css/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0d1117;
  color: #c9d1d9;
  font-family: system-ui, sans-serif;
  display: flex;
  height: 100vh;
  overflow: hidden;
}

#canvas-container {
  flex: 1;
}

#canvas-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

#panel {
  width: 220px;
  background: #161b22;
  border-left: 1px solid #30363d;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

#panel h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #58a6ff;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #8b949e;
}

label.toggle-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

input[type="range"] {
  accent-color: #58a6ff;
  width: 100%;
}

input[type="text"] {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #c9d1d9;
  padding: 4px 8px;
  font-size: 12px;
  width: 100%;
}

#wind-arrow {
  font-size: 20px;
  text-align: center;
}

button {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  cursor: pointer;
  font-size: 13px;
  padding: 8px;
  width: 100%;
}

button:hover { background: #30363d; }
```

- [ ] **Step 3: Create stub JS files**

`js/globe.js`:
```js
export function initScene(container) { return { scene: null } }
export function startLoop(onFrame) {}
```

`js/terrain.js`:
```js
export function initTerrain(scene) {}
export function setSeaLevel(value) {}
export function setOpacity(transparent) {}
```

`js/weather.js`:
```js
export function initWeather(scene) {}
export async function fetchCloudTiles(apiKey) {}
export function setWeatherVisible(visible) {}
```

`js/particles.js`:
```js
export function initParticles(scene) {}
export function setGravity(value) {}
export function setWindDirection(degrees) {}
export function updateParticles(delta) {}
```

`js/controls.js`:
```js
export function initControls(callbacks) {}
```

`js/app.js`:
```js
import { initScene, startLoop } from './globe.js'
import { initTerrain, setSeaLevel, setOpacity } from './terrain.js'
import { initWeather, fetchCloudTiles, setWeatherVisible } from './weather.js'
import { initParticles, setGravity, setWindDirection, updateParticles } from './particles.js'
import { initControls } from './controls.js'

function main() {
  const container = document.getElementById('canvas-container')
  const { scene } = initScene(container)

  initTerrain(scene)
  initWeather(scene)
  initParticles(scene)

  initControls({
    onSeaLevel: setSeaLevel,
    onOpacity: setOpacity,
    onWeatherToggle: setWeatherVisible,
    onWeatherRefresh: () => {
      const key = document.getElementById('owm-api-key').value.trim()
      if (key) fetchCloudTiles(key)
    },
    onGravity: setGravity,
    onWind: setWindDirection,
  })

  startLoop((delta) => updateParticles(delta))
}

main()
```

- [ ] **Step 4: Start dev server and verify page loads**

```bash
cd /home/ricky/Dokumenter/Koding/globus
python3 -m http.server 8080
```

Open http://localhost:8080. Expected: black page on the left, dark panel on the right with sliders and controls visible. No errors in browser console (F12 → Console).

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/
git commit -m "feat: scaffold — HTML layout, CSS panel, module stubs"
```

---

## Task 2: Three.js scene (globe.js)

**Files:**
- Modify: `js/globe.js`

- [ ] **Step 1: Implement initScene and startLoop**

Replace all of `js/globe.js`:

```js
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let _scene, _camera, _renderer, _controls, _clock

export function initScene(container) {
  _scene = new THREE.Scene()
  _clock = new THREE.Clock()

  _camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
  _camera.position.z = 250

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  _renderer.setPixelRatio(window.devicePixelRatio)
  _renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(_renderer.domElement)

  _controls = new OrbitControls(_camera, _renderer.domElement)
  _controls.enableDamping = true
  _controls.dampingFactor = 0.05
  _controls.minDistance = 120
  _controls.maxDistance = 500

  const ambient = new THREE.AmbientLight(0xffffff, 0.3)
  _scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 3, 5)
  _scene.add(sun)

  window.addEventListener('resize', () => {
    _camera.aspect = container.clientWidth / container.clientHeight
    _camera.updateProjectionMatrix()
    _renderer.setSize(container.clientWidth, container.clientHeight)
  })

  return { scene: _scene }
}

export function startLoop(onFrame) {
  function animate() {
    requestAnimationFrame(animate)
    const delta = _clock.getDelta()
    _controls.update()
    onFrame(delta)
    _renderer.render(_scene, _camera)
  }
  animate()
}
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:8080. Expected: black canvas fills the left side. No console errors. (Scene is empty — no sphere yet.)

- [ ] **Step 3: Commit**

```bash
git add js/globe.js
git commit -m "feat: Three.js scene — renderer, camera, lights, OrbitControls"
```

---

## Task 3: Earth sphere + water sphere (terrain.js)

**Files:**
- Modify: `js/terrain.js`

Note on textures: Three.js hosts Earth textures at `threejs.org/examples/textures/planets/` with CORS headers — they load directly via `TextureLoader`. The specular map (`earth_specular_2048.jpg`) is used as a displacement map since it has land brighter than ocean — an approximate but visually useful approximation of elevation.

- [ ] **Step 1: Implement terrain and water spheres**

Replace all of `js/terrain.js`:

```js
import * as THREE from 'three'

const BASE = 'https://threejs.org/examples/textures/planets/'

let _terrainMesh, _waterMesh

export function initTerrain(scene) {
  const loader = new THREE.TextureLoader()

  const colorMap    = loader.load(BASE + 'earth_atmos_2048.jpg')
  const normalMap   = loader.load(BASE + 'earth_normal_2048.jpg')
  const displacementMap = loader.load(BASE + 'earth_specular_2048.jpg')

  const terrainGeo = new THREE.SphereGeometry(100, 256, 256)
  const terrainMat = new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap,
    displacementMap,
    displacementScale: 3,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  })
  _terrainMesh = new THREE.Mesh(terrainGeo, terrainMat)
  scene.add(_terrainMesh)

  const waterGeo = new THREE.SphereGeometry(101, 64, 64)
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1565c0,
    transparent: true,
    opacity: 0.75,
    shininess: 80,
  })
  _waterMesh = new THREE.Mesh(waterGeo, waterMat)
  scene.add(_waterMesh)
}

export function setSeaLevel(value) {
  // value 0–100 → sphere scale 0.985–1.015
  const scale = 0.985 + (value / 100) * 0.03
  _waterMesh.scale.setScalar(scale)
}

export function setOpacity(transparent) {
  _terrainMesh.material.opacity = transparent ? 0.25 : 1.0
}
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:8080. Expected:
- Earth sphere visible with blue water overlay
- Drag with mouse → globe rotates
- Scroll wheel → zoom in/out
- Textures load within a few seconds (fetched from threejs.org)

- [ ] **Step 3: Commit**

```bash
git add js/terrain.js
git commit -m "feat: Earth sphere with NASA textures, displacement map, and water layer"
```

---

## Task 4: Controls panel (controls.js)

**Files:**
- Modify: `js/controls.js`

- [ ] **Step 1: Implement initControls**

Replace all of `js/controls.js`:

```js
const WIND_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']

export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind }) {
  const seaSlider      = document.getElementById('sea-level')
  const gravSlider     = document.getElementById('gravity')
  const windSlider     = document.getElementById('wind-direction')
  const windArrow      = document.getElementById('wind-arrow')
  const chkTransparent = document.getElementById('toggle-transparent')
  const chkClouds      = document.getElementById('toggle-clouds')
  const btnRefresh     = document.getElementById('btn-refresh-weather')

  seaSlider.addEventListener('input', () => onSeaLevel(Number(seaSlider.value)))
  gravSlider.addEventListener('input', () => onGravity(Number(gravSlider.value)))

  windSlider.addEventListener('input', () => {
    const deg = Number(windSlider.value)
    onWind(deg)
    windArrow.textContent = WIND_ARROWS[Math.round(deg / 45) % 8]
  })

  chkTransparent.addEventListener('change', () => onOpacity(chkTransparent.checked))
  chkClouds.addEventListener('change', () => onWeatherToggle(chkClouds.checked))
  btnRefresh.addEventListener('click', onWeatherRefresh)

  // fire initial values so modules sync with default slider positions
  onSeaLevel(Number(seaSlider.value))
  onGravity(Number(gravSlider.value))
  onWind(Number(windSlider.value))
  onOpacity(chkTransparent.checked)
}
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:8080 and test each control:
- Sea level slider → water sphere visibly shrinks (slider left) and grows (slider right)
- Transparent toggle → Earth turns ghost-like, water sphere visible through it
- Gravity and wind sliders move without console errors (particle callbacks are still stubs)

- [ ] **Step 3: Commit**

```bash
git add js/controls.js
git commit -m "feat: controls panel — sea level, opacity, cloud toggle bound to module callbacks"
```

---

## Task 5: OpenWeatherMap cloud overlay (weather.js)

**Files:**
- Modify: `js/weather.js`

Note: Requires a free OWM API key. Sign up at https://openweathermap.org → "API keys" tab. New keys activate within ~2 hours. Enter the key in the panel at runtime — it is never stored.

OWM tiles use Web Mercator projection (not equirectangular). Applied to a sphere, cloud shapes will look correct between ±60° latitude but slightly stretched near poles — acceptable for MVP.

- [ ] **Step 1: Implement cloud overlay**

Replace all of `js/weather.js`:

```js
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
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:8080.
1. Enter your OWM API key in the text field
2. Click "🔄 Oppdater vær"
3. Expected: cloud pattern appears on globe surface within 5–10 seconds
4. Toggle "☁️ Skylag" → clouds hide/show

Without a key: globe renders normally, clicking refresh does nothing (empty cloud canvas).

- [ ] **Step 3: Commit**

```bash
git add js/weather.js
git commit -m "feat: OWM cloud overlay — 16 tiles at zoom=2 stitched onto canvas texture"
```

---

## Task 6: Particle system — gravity + wind (particles.js)

**Files:**
- Modify: `js/particles.js`

- [ ] **Step 1: Implement particle system**

Replace all of `js/particles.js`:

```js
import * as THREE from 'three'

const COUNT = 500
const SURFACE_R = 103    // just above the weather overlay sphere

let _points, _pos, _vel
let _gravity = 5         // units/s² toward surface
let _windAngle = 90      // degrees: 0=east 90=south 180=west 270=north

export function initParticles(scene) {
  _pos = new Float32Array(COUNT * 3)
  _vel = new Float32Array(COUNT * 3)

  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = SURFACE_R + Math.random() * 8
    _pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
    _pos[i*3+1] = r * Math.cos(phi)
    _pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(_pos, 3))

  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.6 })
  _points = new THREE.Points(geo, mat)
  scene.add(_points)
}

export function setGravity(value) {
  // slider 0–100 → 0.5–15 units/s²
  _gravity = 0.5 + (value / 100) * 14.5
}

export function setWindDirection(degrees) {
  _windAngle = degrees
}

export function updateParticles(delta) {
  if (!_points) return

  const windRad = (_windAngle * Math.PI) / 180
  const windX = Math.cos(windRad) * 8
  const windZ = Math.sin(windRad) * 8

  for (let i = 0; i < COUNT; i++) {
    const ix = i*3, iy = i*3+1, iz = i*3+2
    let x = _pos[ix], y = _pos[iy], z = _pos[iz]

    const dist = Math.sqrt(x*x + y*y + z*z)
    const nx = x/dist, ny = y/dist, nz = z/dist

    // pull toward surface
    _vel[ix] -= nx * _gravity * delta
    _vel[iy] -= ny * _gravity * delta
    _vel[iz] -= nz * _gravity * delta

    // lateral wind push
    _vel[ix] += windX * delta
    _vel[iz] += windZ * delta

    x += _vel[ix] * delta
    y += _vel[iy] * delta
    z += _vel[iz] * delta

    // reset particle if it leaves the near-surface band
    const newDist = Math.sqrt(x*x + y*y + z*z)
    if (newDist < SURFACE_R - 2 || newDist > SURFACE_R + 20) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = SURFACE_R + Math.random() * 5
      x = r * Math.sin(phi) * Math.cos(theta)
      y = r * Math.cos(phi)
      z = r * Math.sin(phi) * Math.sin(theta)
      _vel[ix] = 0; _vel[iy] = 0; _vel[iz] = 0
    }

    _pos[ix] = x; _pos[iy] = y; _pos[iz] = z
  }

  _points.geometry.attributes.position.needsUpdate = true
}
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:8080. Expected:
- Small white dots visible near globe surface
- Gravity slider left (low) → particles drift slowly and float higher
- Gravity slider right (high) → particles fall fast and hug the surface
- Wind direction slider → visible lateral drift direction changes

- [ ] **Step 3: Commit**

```bash
git add js/particles.js
git commit -m "feat: particle system — gravity pull and wind direction simulation"
```

---

## Task 7: .gitignore + final check

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
.superpowers/
```

- [ ] **Step 2: Full smoke test**

Open http://localhost:8080 and verify the complete feature set:
- Globe rotates on drag, zooms on scroll ✓
- Sea level slider shrinks/grows water sphere ✓
- Transparent toggle makes terrain see-through ✓
- Gravity slider changes particle fall speed ✓
- Wind direction slider changes particle drift direction ✓
- OWM API key + refresh loads cloud overlay (if key available) ✓
- Cloud toggle shows/hides overlay ✓

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore — exclude brainstorming session files"
```

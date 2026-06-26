import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let _scene, _camera, _renderer, _controls, _clock
let _resetting = false
let _ambient, _sunLight, _sunVisual, _moon, _apolloMarker
let _lastSunMinute = -1
let _moonTipEnabled = false
const _toEarth = new THREE.Vector3()
const SUN_RADIUS = 2000   // 1 AU
const MOON_ORBIT = 200

function solarParams() {
  const now = new Date()
  const dayFraction = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400
  const hourAngle   = (dayFraction - 0.5) * 2 * Math.PI
  const dayOfYear   = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 86400000)
  const decl        = -23.5 * Math.cos((dayOfYear + 10) / 365 * 2 * Math.PI) * Math.PI / 180
  return { hourAngle, decl }
}

function calcSunPosition() {
  const { hourAngle, decl } = solarParams()
  return new THREE.Vector3(
    Math.cos(hourAngle) * SUN_RADIUS,
    Math.sin(decl)      * SUN_RADIUS,
    Math.sin(hourAngle) * SUN_RADIUS,
  )
}

function calcMoonPosition() {
  // Synodic period, reference new moon 2000-01-06T18:14Z
  const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
  const SYNODIC_MS   = 29.530589 * 86400000
  const phase = ((Date.now() - REF_NEW_MOON) % SYNODIC_MS) / SYNODIC_MS  // 0=new, 0.5=full

  const { hourAngle, decl } = solarParams()
  const moonAngle = hourAngle + phase * 2 * Math.PI  // offset from sun by phase
  return new THREE.Vector3(
    Math.cos(moonAngle) * MOON_ORBIT,
    Math.sin(decl)      * MOON_ORBIT * 0.8,  // approximate same ecliptic tilt
    Math.sin(moonAngle) * MOON_ORBIT,
  )
}
const DEFAULT_CAM = new THREE.Vector3(0, 0, 250)

export function initScene(container) {
  _scene = new THREE.Scene()
  _clock = new THREE.Clock()

  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight
  _camera = new THREE.PerspectiveCamera(45, w / h, 1, 150000)
  _camera.position.z = 250

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  _renderer.setSize(w, h)
  container.appendChild(_renderer.domElement)

  _controls = new OrbitControls(_camera, _renderer.domElement)
  _controls.enableDamping = true
  _controls.dampingFactor = 0.05
  _controls.minDistance = 120
  _controls.maxDistance = 80000
  _controls.enablePan = false

  _ambient = new THREE.AmbientLight(0xffffff, 1.0)
  _scene.add(_ambient)

  _sunLight = new THREE.DirectionalLight(0xfff5e4, 2.2)
  _sunLight.position.copy(calcSunPosition())
  _sunLight.visible = false
  _scene.add(_sunLight)

  // Visual sun glow sprite
  const sunCanvas = document.createElement('canvas')
  sunCanvas.width = sunCanvas.height = 64
  const sctx = sunCanvas.getContext('2d')
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0,   'rgba(255, 240, 100, 1.0)')
  grad.addColorStop(0.3, 'rgba(255, 200,  50, 0.7)')
  grad.addColorStop(1,   'rgba(255, 160,   0, 0.0)')
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, 64, 64)
  _sunVisual = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }))
  _sunVisual.scale.set(160, 160, 1)
  _sunVisual.position.copy(_sunLight.position)
  _sunVisual.visible = false
  _scene.add(_sunVisual)

  // Moon
  const moonGeo = new THREE.SphereGeometry(9, 32, 32)
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.95, metalness: 0.0 })
  new THREE.TextureLoader().load(
    'https://threejs.org/examples/textures/planets/moon_1024.jpg',
    tex => { moonMat.map = tex; moonMat.needsUpdate = true }
  )
  _moon = new THREE.Mesh(moonGeo, moonMat)
  _moon.position.copy(calcMoonPosition())
  _scene.add(_moon)

  // Apollo 11 landing site — Earth-facing side of Moon
  const apolloGeo = new THREE.BufferGeometry()
  apolloGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  _apolloMarker = new THREE.Points(apolloGeo, new THREE.PointsMaterial({
    size: 5, color: 0xFFD700, sizeAttenuation: true, depthWrite: false,
  }))
  _apolloMarker.renderOrder = 2
  _apolloMarker.visible = false
  _scene.add(_apolloMarker)

  _initMoonTooltip(container)

  window.addEventListener('resize', () => {
    const rw = container.clientWidth || window.innerWidth
    const rh = container.clientHeight || window.innerHeight
    _camera.aspect = rw / rh
    _camera.updateProjectionMatrix()
    _renderer.setSize(rw, rh)
  })

  return { scene: _scene }
}

function _initMoonTooltip(container) {
  const tip = document.createElement('div')
  tip.style.cssText = [
    'position:absolute', 'pointer-events:none', 'display:none',
    'background:rgba(8,8,8,0.85)', 'color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.18)', 'border-radius:10px',
    'padding:9px 13px', 'font-family:system-ui,sans-serif',
    'font-size:13px', 'line-height:1.6', 'white-space:nowrap',
    'backdrop-filter:blur(4px)', 'z-index:99',
  ].join(';')
  container.appendChild(tip)

  const ray = new THREE.Raycaster()

  _renderer.domElement.addEventListener('pointermove', e => {
    if (!_moon) return
    const rect = _renderer.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      ((e.clientY - rect.top)  / rect.height) * -2 + 1,
    )
    ray.params.Points = { threshold: 4 }
    ray.setFromCamera(ndc, _camera)
    if (_apolloMarker) {
      const apolloHits = ray.intersectObject(_apolloMarker)
      if (apolloHits.length) {
        tip.innerHTML = '🚀 <b>Apollo 11</b><br><span style="color:#aaa;font-size:11px">Mare Tranquillitatis · 20. juli 1969</span>'
        tip.style.display = 'block'
        tip.style.left = (e.clientX - rect.left + 14) + 'px'
        tip.style.top  = (e.clientY - rect.top  - 36) + 'px'
        return
      }
    }
    if (!_moonTipEnabled) { tip.style.display = 'none'; return }
    const hits = ray.intersectObject(_moon)
    if (!hits.length) { tip.style.display = 'none'; return }

    // Fraction of visible face that is lit: 1 = full day, 0 = full night
    const sunDir = (_sunLight.visible ? _sunLight.position : new THREE.Vector3(1, 0, 0))
      .clone().sub(_moon.position).normalize()
    const camDir = _camera.position.clone().sub(_moon.position).normalize()
    const lit    = (sunDir.dot(camDir) + 1) / 2   // 0–1
    const temp   = Math.round(-173 + lit * 300)    // −173 °C … +127 °C
    const side   = lit > 0.55 ? 'Dagsiden' : lit < 0.45 ? 'Nattside' : 'Terminator'
    const emoji  = temp > 50 ? '🌡' : temp > 0 ? '🌡' : '🥶'

    tip.innerHTML = `${emoji} <b>${temp > 0 ? '+' : ''}${temp}°C</b> <span style="color:#777;font-size:11px">${side}</span>`
    tip.style.display = 'block'
    tip.style.left = (e.clientX - rect.left + 14) + 'px'
    tip.style.top  = (e.clientY - rect.top  - 36) + 'px'
  })
}

export function setMoonTempEnabled(enabled) {
  _moonTipEnabled = enabled
}

export function setApolloVisible(visible) {
  if (_apolloMarker) _apolloMarker.visible = visible
}

export function setMoonOpacity(transparent) {
  if (!_moon) return
  _moon.material.transparent = transparent
  _moon.material.opacity = transparent ? 0.45 : 1.0
  _moon.material.needsUpdate = true
}

export function setSunEnabled(enabled) {
  if (!_sunLight) return
  if (enabled) {
    const pos = calcSunPosition()
    _sunLight.position.copy(pos)
    _sunVisual.position.copy(pos)
  }
  _sunLight.visible  = enabled
  _sunVisual.visible = enabled
  _ambient.intensity = enabled ? 0.08 : 1.0
}

export function getCamera()      { return _camera }
export function getControls()    { return _controls }
export function getCanvas()      { return _renderer.domElement }
export function getSunDirection(){ return _sunLight.position }

export function resetCamera() {
  _resetting = true
}

export function getCompassAngle() {
  if (!_camera) return 0
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  _camera.matrixWorld.extractBasis(right, up, new THREE.Vector3())
  const north = new THREE.Vector3(0, 1, 0)
  return Math.atan2(north.dot(right), north.dot(up)) * (180 / Math.PI)
}

export function startLoop(onFrame) {
  if (!_clock) throw new Error('initScene must be called before startLoop')
  let rafId
  function animate() {
    rafId = requestAnimationFrame(animate)
    const delta = _clock.getDelta()
    if (_resetting) {
      _camera.position.lerp(DEFAULT_CAM, 0.08)
      if (_camera.position.distanceTo(DEFAULT_CAM) < 0.5) {
        _camera.position.copy(DEFAULT_CAM)
        _resetting = false
      }
    }
    if (_sunLight?.visible) {
      const m = new Date().getUTCMinutes()
      if (m !== _lastSunMinute) {
        _lastSunMinute = m
        const sunPos = calcSunPosition()
        _sunLight.position.copy(sunPos)
        _sunVisual.position.copy(sunPos)
        _moon?.position.copy(calcMoonPosition())
      }
    }
    _controls.update()
    if (_apolloMarker && _moon) {
      _toEarth.set(0, 0, 0).sub(_moon.position).normalize()
      _apolloMarker.position.copy(_moon.position).addScaledVector(_toEarth, 9.5)
    }
    onFrame(delta)
    _renderer.render(_scene, _camera)
  }
  animate()
  return () => cancelAnimationFrame(rafId)
}

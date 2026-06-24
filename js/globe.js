import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let _scene, _camera, _renderer, _controls, _clock
let _resetting = false
let _ambient, _sunLight, _sunVisual, _moon
let _lastSunMinute = -1
const SUN_RADIUS = 380
const MOON_ORBIT = 200
const MOON_TILT  = 22 * Math.PI / 180

function calcSunPosition() {
  const now = new Date()
  // UTC time — globe texture is aligned to Greenwich meridian
  const dayFraction = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400
  const hourAngle   = (dayFraction - 0.5) * 2 * Math.PI   // UTC noon=0, midnight=±π

  const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 86400000)
  const decl = -23.5 * Math.cos((dayOfYear + 10) / 365 * 2 * Math.PI) * Math.PI / 180

  return new THREE.Vector3(
    Math.cos(hourAngle) * SUN_RADIUS,
    Math.sin(decl)      * SUN_RADIUS,
    Math.sin(hourAngle) * SUN_RADIUS,
  )
}
const DEFAULT_CAM = new THREE.Vector3(0, 0, 250)

export function initScene(container) {
  _scene = new THREE.Scene()
  _clock = new THREE.Clock()

  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight
  _camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
  _camera.position.z = 250

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  _renderer.setSize(w, h)
  container.appendChild(_renderer.domElement)

  _controls = new OrbitControls(_camera, _renderer.domElement)
  _controls.enableDamping = true
  _controls.dampingFactor = 0.05
  _controls.minDistance = 120
  _controls.maxDistance = 500

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
  _sunVisual.scale.set(90, 90, 1)
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
  _moon.position.set(
    Math.cos(0.8) * MOON_ORBIT,
    Math.sin(0.8) * MOON_ORBIT * Math.sin(MOON_TILT),
    Math.sin(0.8) * MOON_ORBIT * Math.cos(MOON_TILT),
  )
  _scene.add(_moon)

  window.addEventListener('resize', () => {
    const rw = container.clientWidth || window.innerWidth
    const rh = container.clientHeight || window.innerHeight
    _camera.aspect = rw / rh
    _camera.updateProjectionMatrix()
    _renderer.setSize(rw, rh)
  })

  return { scene: _scene }
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

export function getCamera()   { return _camera }
export function getControls() { return _controls }
export function getCanvas()   { return _renderer.domElement }

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
      const m = new Date().getMinutes()
      if (m !== _lastSunMinute) {
        _lastSunMinute = m
        const pos = calcSunPosition()
        _sunLight.position.copy(pos)
        _sunVisual.position.copy(pos)
      }
    }
    _controls.update()
    onFrame(delta)
    _renderer.render(_scene, _camera)
  }
  animate()
  return () => cancelAnimationFrame(rafId)
}

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let _scene, _camera, _renderer, _controls, _clock
let _resetting = false
let _ambient, _sunLight
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
  _sunLight.position.set(300, 80, 0)
  _sunLight.visible = false
  _scene.add(_sunLight)

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
  _sunLight.visible  = enabled
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
    _controls.update()
    onFrame(delta)
    _renderer.render(_scene, _camera)
  }
  animate()
  return () => cancelAnimationFrame(rafId)
}

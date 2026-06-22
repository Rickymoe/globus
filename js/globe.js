import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let _scene, _camera, _renderer, _controls, _clock

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

  const ambient = new THREE.AmbientLight(0xffffff, 0.3)
  _scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 3, 5)
  _scene.add(sun)

  window.addEventListener('resize', () => {
    const rw = container.clientWidth || window.innerWidth
    const rh = container.clientHeight || window.innerHeight
    _camera.aspect = rw / rh
    _camera.updateProjectionMatrix()
    _renderer.setSize(rw, rh)
  })

  return { scene: _scene }
}

export function startLoop(onFrame) {
  if (!_clock) throw new Error('initScene must be called before startLoop')
  let rafId
  function animate() {
    rafId = requestAnimationFrame(animate)
    const delta = _clock.getDelta()
    _controls.update()
    onFrame(delta)
    _renderer.render(_scene, _camera)
  }
  animate()
  return () => cancelAnimationFrame(rafId)
}

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

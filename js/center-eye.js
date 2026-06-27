import { setCenterEyeMode } from './terrain.js'
import { setBordersCenterEye } from './borders.js'
import { setInsideGlobe } from './globe.js'
import { setLabelsCenterEye } from './labels.js'

const SURFACE = 99.5

let _camera = null
let _controls = null
let _inside = false

export function initCenterEye(camera, controls) {
  _camera = camera
  _controls = controls
}

export function updateCenterEye() {
  if (!_camera) return
  const shouldBeInside = _camera.position.length() < SURFACE
  if (shouldBeInside === _inside) return
  _inside = shouldBeInside
  setCenterEyeMode(_inside)
  setBordersCenterEye(_inside)
  setInsideGlobe(_inside)
  setLabelsCenterEye(_inside)
  _controls.rotateSpeed = _inside ? -1 : 1
  _controls.zoomSpeed   = _inside ? 5  : 1
}

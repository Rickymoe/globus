import * as THREE from 'three'

const R_ISS = 106.5

let _group      = null
let _sprite     = null
let _trackLine  = null
let _tooltip    = null
let _camera     = null
let _canvas     = null
let _lat = 0, _lon = 0
let _info       = null
let _time       = 0
let _lastTrack  = 0     // timestamp of last track fetch

function latLonToVec3(lat, lon, r = R_ISS) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -r * Math.cos(theta) * Math.sin(phi),
     r * Math.cos(phi),
     r * Math.sin(theta) * Math.sin(phi),
  )
}

// ── ISS sprite texture ────────────────────────────────────────────────────────

function makeIssTex() {
  const S   = 96
  const cx  = S / 2, cy = S / 2
  const c   = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')

  // Outer glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30)
  g.addColorStop(0,   'rgba(160,210,255,0.55)')
  g.addColorStop(0.5, 'rgba(100,170,255,0.20)')
  g.addColorStop(1,   'rgba(80,140,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)

  // Solar panel helper
  const panel = (x, y, w, h) => {
    ctx.fillStyle = '#5599ee'
    ctx.fillRect(x, y, w, h)
    // panel grid lines
    ctx.strokeStyle = 'rgba(180,220,255,0.5)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x + w/2, y); ctx.lineTo(x + w/2, y + h)
    ctx.moveTo(x, y + h/2); ctx.lineTo(x + w, y + h/2)
    ctx.stroke()
  }

  // Main truss (horizontal bar)
  ctx.fillStyle = '#ddeeff'
  ctx.fillRect(cx - 26, cy - 2.5, 52, 5)

  // Solar panels — 2 pairs each side
  panel(cx - 38, cy - 12, 14, 9)   // left upper
  panel(cx - 38, cy + 3,  14, 9)   // left lower
  panel(cx + 24, cy - 12, 14, 9)   // right upper
  panel(cx + 24, cy + 3,  14, 9)   // right lower

  // Habitation module stack (vertical)
  ctx.fillStyle = '#eef4ff'
  ctx.fillRect(cx - 4, cy - 10, 8, 20)

  // Node connectors
  ctx.fillStyle = '#cce0ff'
  ctx.fillRect(cx - 7, cy - 3, 14, 6)

  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 4)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(1, 'rgba(200,230,255,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  return new THREE.CanvasTexture(c)
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function _buildTooltip(container) {
  _tooltip = document.createElement('div')
  _tooltip.style.cssText = [
    'position:absolute','background:rgba(8,8,8,0.88)','color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.15)','border-radius:8px',
    'padding:7px 11px','font-size:12px','font-family:system-ui,sans-serif',
    'pointer-events:none','display:none','z-index:50','white-space:nowrap',
    'backdrop-filter:blur(4px)',
  ].join(';')
  container.appendChild(_tooltip)
}

function _projectISS() {
  if (!_sprite || !_camera || !_canvas) return null
  const rect = _canvas.getBoundingClientRect()
  const sc   = _sprite.position.clone().project(_camera)
  return {
    x: ( sc.x + 1) / 2 * rect.width,
    y: (-sc.y + 1) / 2 * rect.height,
  }
}

function onMouseMove(e) {
  if (!_group?.visible || !_info) return
  const rect = _canvas.getBoundingClientRect()
  const sp   = _projectISS()
  if (!sp) return
  const d = Math.hypot(e.clientX - rect.left - sp.x, e.clientY - rect.top - sp.y)
  if (d < 36) {
    const alt = _info.altitude?.toFixed(1) ?? '–'
    const vel = _info.velocity != null ? (_info.velocity / 3.6).toFixed(2) : '–'
    _tooltip.innerHTML =
      `🛸 <b>International Space Station</b>` +
      `<br><span style="color:#aaa;font-size:11px">` +
      `Alt ${alt} km · ${vel} km/s · ${_lat.toFixed(2)}°, ${_lon.toFixed(2)}°</span>`
    _tooltip.style.left    = (sp.x + 14) + 'px'
    _tooltip.style.top     = (sp.y - 10) + 'px'
    _tooltip.style.display = 'block'
  } else {
    _tooltip.style.display = 'none'
  }
}

// ── Orbital track ─────────────────────────────────────────────────────────────

async function fetchTrackPoints() {
  // 10 points × 3-min intervals = 30 min back (≈ 1/3 orbit → single trailing arc)
  const now  = Math.floor(Date.now() / 1000)
  const step = 3 * 60
  const ts   = Array.from({ length: 10 }, (_, i) => now - (9 - i) * step)
  const url  = `https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${ts.join(',')}&units=kilometers`
  const data = await fetch(url).then(r => r.json())
  if (!Array.isArray(data)) return []
  return data.map(p => ({ lat: p.latitude, lon: p.longitude }))
}

function buildTrack(points) {
  if (points.length < 2) return

  const STEPS = 40   // subdivisions per segment → smooth arc along sphere
  const vecs  = points.map(p => latLonToVec3(p.lat, p.lon))
  const segs  = vecs.length - 1
  const total = segs * STEPS + 1

  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)

  let idx = 0
  for (let seg = 0; seg < segs; seg++) {
    const v1    = vecs[seg]
    const v2    = vecs[seg + 1]
    const count = seg === segs - 1 ? STEPS + 1 : STEPS

    for (let s = 0; s < count; s++) {
      const t       = s / STEPS
      const globalT = (seg * STEPS + s) / (segs * STEPS)

      // Ground track: project onto surface so globe occludes the back side
      const v = v1.clone().lerp(v2, t).normalize().multiplyScalar(100.5)
      pos[idx*3] = v.x; pos[idx*3+1] = v.y; pos[idx*3+2] = v.z

      const br = 0.08 + globalT * 0.72
      col[idx*3] = br; col[idx*3+1] = br * 0.88; col[idx*3+2] = 1.0
      idx++
    }
  }

  if (_trackLine) {
    _group.remove(_trackLine)
    _trackLine.geometry.dispose()
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))

  _trackLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthTest: true,
  }))
  _trackLine.renderOrder = 9
  _group.add(_trackLine)
}

async function refreshTrack() {
  try {
    const pts = await fetchTrackPoints()
    if (pts.length) buildTrack(pts)
    _lastTrack = Date.now()
  } catch (e) {
    console.warn('[iss] track fetch failed', e.message)
  }
}

// ── Fetch loop ────────────────────────────────────────────────────────────────

const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544'
let _retryDelay = 15000

async function fetchAndUpdate() {
  try {
    const d = await fetch(ISS_URL).then(r => r.json())
    if (d.latitude != null && d.longitude != null) {
      _lat  = d.latitude
      _lon  = d.longitude
      _info = d
      const v = latLonToVec3(_lat, _lon)
      if (_sprite) _sprite.position.copy(v)
    }
    _retryDelay = 15000
  } catch {
    _retryDelay = Math.min(_retryDelay * 2, 120000)
  }
  setTimeout(fetchAndUpdate, _retryDelay)
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initIss(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas

  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  const mat = new THREE.SpriteMaterial({
    map: makeIssTex(),
    transparent: true,
    depthTest: true,
    opacity: 1,
  })
  _sprite = new THREE.Sprite(mat)
  _sprite.scale.set(8, 8, 1)
  _sprite.renderOrder = 10
  _sprite.position.set(0, R_ISS, 0)
  _group.add(_sprite)

  const container = document.getElementById('canvas-container')
  _buildTooltip(container)
  canvas.addEventListener('mousemove', onMouseMove)

  fetchAndUpdate()
  refreshTrack()
}

export function updateIss(delta) {
  if (!_group?.visible || !_sprite) return
  _time += delta
  _sprite.material.opacity = 0.85 + 0.15 * Math.sin(_time * 2.5)
  // Refresh track every 5 minutes
  if (Date.now() - _lastTrack > 5 * 60 * 1000) refreshTrack()
}

export function setIssVisible(visible) {
  if (_group) _group.visible = visible
  if (!visible && _tooltip) _tooltip.style.display = 'none'
}

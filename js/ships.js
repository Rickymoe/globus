import * as THREE from 'three'

const R          = 101.6
const WS_URL     = 'wss://stream.aisstream.io/v0/stream'
const REBUILD_MS = 3000   // rebuild geometry every 3 s

// AIS ship type → display info
function shipMeta(t) {
  if (t >= 70 && t <= 79)              return { label: 'Cargo',     color: new THREE.Color(0.25, 0.55, 1.00) }
  if (t >= 80 && t <= 89)              return { label: 'Tanker',    color: new THREE.Color(1.00, 0.50, 0.10) }
  if (t >= 60 && t <= 69)              return { label: 'Passenger', color: new THREE.Color(0.20, 0.90, 0.40) }
  if (t === 30)                        return { label: 'Fishing',   color: new THREE.Color(1.00, 0.88, 0.10) }
  if (t === 37 || t === 36)            return { label: 'Pleasure',  color: new THREE.Color(1.00, 0.45, 0.85) }
  if (t === 31 || t === 32 || t === 52) return { label: 'Tug',      color: new THREE.Color(0.60, 0.85, 0.40) }
  if (t >= 50 && t <= 59)              return { label: 'Service',   color: new THREE.Color(0.80, 0.55, 1.00) }
  return                                      { label: 'Other',     color: new THREE.Color(0.55, 0.55, 0.55) }
}

function toVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(theta),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(theta),
  )
}

function makeGlowTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(8,8,0,8,8,7)
  g.addColorStop(0,   'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  g.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0,0,16,16)
  return new THREE.CanvasTexture(c)
}

let _group     = null
let _points    = null
let _material  = null
let _tooltip   = null
let _panel     = null
let _camera    = null
let _canvas    = null
let _ws        = null
let _visible   = false
let _dirty     = false
let _lastBuild = 0
let _hoverPts  = []
let _time      = 0

const _vessels = new Map()   // mmsi → { lat, lon, name, shipType, sog }

// ── Geometry rebuild ──────────────────────────────────────────────────────────

function _rebuild() {
  const arr = [..._vessels.values()].filter(v => v.lat != null && v.lon != null)
  if (!arr.length) return

  const pos = new Float32Array(arr.length * 3)
  const col = new Float32Array(arr.length * 3)

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    const p = toVec3(v.lat, v.lon)
    pos[i*3]   = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z
    const c = shipMeta(v.shipType).color
    col[i*3]   = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))

  if (_points) { _group.remove(_points); _points.geometry.dispose() }
  _points = new THREE.Points(geo, _material)
  _points.renderOrder = 2
  _group.add(_points)

  _dirty = false
  _updatePanel()
}

// ── Stats panel ───────────────────────────────────────────────────────────────

function _buildPanel() {
  _panel = document.createElement('div')
  _panel.style.cssText = [
    'position:fixed','bottom:1rem','left:50%','transform:translateX(-50%)',
    'display:none','flex-direction:column','gap:0.55rem',
    'padding:0.85rem 1.4rem','background:rgba(0,0,0,0.75)',
    'border-radius:1.25rem','backdrop-filter:blur(10px)',
    'z-index:100','font-family:system-ui,sans-serif','color:white',
    'min-width:320px','pointer-events:none',
  ].join(';')
  document.body.appendChild(_panel)
}

function _updatePanel() {
  if (!_panel || _panel.style.display === 'none') return
  const all     = [..._vessels.values()]
  const total   = all.length
  const cargo   = all.filter(v => v.shipType >= 70 && v.shipType <= 79).length
  const tanker  = all.filter(v => v.shipType >= 80 && v.shipType <= 89).length
  const pass    = all.filter(v => v.shipType >= 60 && v.shipType <= 69).length
  const fish    = all.filter(v => v.shipType === 30).length
  const pleasure = all.filter(v => v.shipType === 37 || v.shipType === 36).length
  const tug     = all.filter(v => v.shipType === 31 || v.shipType === 32 || v.shipType === 52).length

  _panel.innerHTML = `
    <div style="font-size:18px;font-weight:600">🚢 ${total.toLocaleString()} vessels live</div>
    <div style="display:flex;gap:0.8rem;font-size:12px;flex-wrap:wrap">
      <span style="color:#4488ff">⬤ ${cargo} cargo</span>
      <span style="color:#ff8822">⬤ ${tanker} tanker</span>
      <span style="color:#33ee66">⬤ ${pass} passenger</span>
      <span style="color:#ffdd22">⬤ ${fish} fishing</span>
      <span style="color:#ff44cc">⬤ ${pleasure} pleasure</span>
      <span style="color:#88dd55">⬤ ${tug} tug</span>
    </div>
  `
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────

function _projectVessels() {
  if (!_camera || !_canvas || !_points) return
  _hoverPts = []
  const rect   = _canvas.getBoundingClientRect()
  const camDir = _camera.position.clone().normalize()
  const arr    = [..._vessels.values()].filter(v => v.lat != null)

  for (const v of arr) {
    const pos3 = toVec3(v.lat, v.lon)
    if (pos3.clone().normalize().dot(camDir) < 0.1) continue
    const sc = pos3.clone().project(_camera)
    _hoverPts.push({
      x: ( sc.x+1)/2*rect.width,
      y: (-sc.y+1)/2*rect.height,
      v,
    })
  }
}

function onMouseMove(e) {
  if (!_group?.visible) return
  const rect = _canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let nearest = null, minD = 30
  for (const h of _hoverPts) {
    const d = Math.hypot(h.x-mx, h.y-my)
    if (d < minD) { minD = d; nearest = h }
  }
  if (nearest) {
    const v    = nearest.v
    const meta = shipMeta(v.shipType)
    const hex  = '#' + [meta.color.r, meta.color.g, meta.color.b]
                   .map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('')
    const name = v.name?.trim() || `MMSI ${v.mmsi}`
    const sog  = v.sog != null ? `${v.sog.toFixed(1)} kn` : '—'
    _tooltip.innerHTML =
      `<span style="color:${hex};font-size:9px">⬤</span> <b>${name}</b>` +
      `<br><span style="color:#aaa;font-size:11px">${meta.label} · ${sog}</span>`
    _tooltip.style.left    = (nearest.x+14)+'px'
    _tooltip.style.top     = (nearest.y-10)+'px'
    _tooltip.style.display = 'block'
  } else {
    _tooltip.style.display = 'none'
  }
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

async function _connect(apiKey) {
  if (_ws) { _ws.close(); _ws = null }

  _ws = new WebSocket(WS_URL)

  _ws.onopen = () => {
    console.log('[ships] WebSocket connected')
    _ws.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }))
  }

  _ws.onmessage = async (e) => {
    try {
      const text = typeof e.data === 'string' ? e.data : await e.data.text()
      const msg  = JSON.parse(text)
      const meta = msg.MetaData
      if (!meta?.MMSI) return

      const mmsi     = meta.MMSI
      const existing = _vessels.get(mmsi) ?? {}

      if (msg.MessageType === 'ShipStaticData') {
        const s = msg.Message?.ShipStaticData
        if (!s) return
        _vessels.set(mmsi, {
          ...existing,
          mmsi,
          name:     s.Name?.trim() || meta.ShipName?.trim() || existing.name,
          shipType: s.Type ?? existing.shipType ?? 0,
          lat:      existing.lat ?? meta.latitude ?? null,
          lon:      existing.lon ?? meta.longitude ?? null,
        })
      } else {
        // PositionReport
        if (meta.latitude == null) return
        _vessels.set(mmsi, {
          ...existing,
          mmsi,
          lat:  meta.latitude,
          lon:  meta.longitude,
          name: meta.ShipName?.trim() || existing.name,
          sog:  msg.Message?.PositionReport?.Sog,
        })
      }
      _dirty = true
    } catch { /* skip malformed */ }
  }

  _ws.onerror = e => console.warn('[ships] WebSocket error', e)
  _ws.onclose = () => {
    console.log('[ships] WebSocket closed — reconnecting in 10 s')
    if (_visible) setTimeout(() => _connect(apiKey), 10_000)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initShips(scene, camera, canvas) {
  _camera = camera
  _canvas = canvas

  _group = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  _material = new THREE.PointsMaterial({
    size: 1.8, map: makeGlowTex(),
    alphaTest: 0.05, sizeAttenuation: true,
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })

  _tooltip = document.createElement('div')
  _tooltip.style.cssText = [
    'position:absolute','background:rgba(8,8,8,0.85)','color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.15)','border-radius:8px',
    'padding:6px 10px','font-size:12px','font-family:system-ui,sans-serif',
    'pointer-events:none','display:none','z-index:50',
    'white-space:nowrap','backdrop-filter:blur(4px)',
  ].join(';')
  document.getElementById('canvas-container').appendChild(_tooltip)
  canvas.addEventListener('mousemove', onMouseMove)

  _buildPanel()

  // Load API key from data/config.json (gitignored)
  try {
    const cfg = await fetch('./data/config.json').then(r => r.json())
    if (cfg.aisApiKey) {
      _connect(cfg.aisApiKey)
    } else {
      console.warn('[ships] data/config.json has no aisApiKey')
    }
  } catch {
    console.warn('[ships] No data/config.json found — add { "aisApiKey": "..." }')
  }
}

export function updateShips(delta) {
  if (!_group?.visible) return
  _time += delta

  const now = performance.now()
  if (_dirty && now - _lastBuild > REBUILD_MS) {
    _lastBuild = now
    _rebuild()
    _projectVessels()
  }
}

export function setShipsVisible(v) {
  _visible = v
  if (_group) _group.visible = v
  if (!v && _tooltip) _tooltip.style.display = 'none'
  if (_panel) {
    _panel.style.display = v ? 'flex' : 'none'
    if (v) _updatePanel()
  }
}

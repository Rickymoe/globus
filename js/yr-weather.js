import * as THREE from 'three'

const YR_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

const SYMBOL_EMOJI = {
  clearsky: '☀️', fair: '🌤', partlycloudy: '⛅', cloudy: '☁️',
  fog: '🌫', lightrainshowers: '🌦', rainshowers: '🌦', heavyrainshowers: '🌧',
  lightrain: '🌦', rain: '🌧', heavyrain: '🌧',
  lightsleet: '🌨', sleet: '🌨', heavysleet: '🌨',
  lightsnow: '❄️', snow: '❄️', heavysnow: '❄️', snowshowers: '🌨',
  thunder: '⛈', rainandthunder: '⛈', snowandthunder: '⛈',
}

function symbolEmoji(code) {
  if (!code) return '🌡'
  const base = code.replace(/_(day|night|polartwilight)$/, '')
  for (const [k, v] of Object.entries(SYMBOL_EMOJI)) {
    if (base === k || base.startsWith(k)) return v
  }
  return '🌡'
}

function windDir(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
}

function coordLabel(lat, lon) {
  const la = Math.abs(lat).toFixed(2) + (lat >= 0 ? '°N' : '°S')
  const lo = Math.abs(lon).toFixed(2) + (lon >= 0 ? '°E' : '°W')
  return `${la}, ${lo}`
}

let _popup = null
let _camera = null
let _canvas = null

function createPopup() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:absolute',
    'min-width:170px',
    'background:rgba(8,8,8,0.88)',
    'color:#e0e0e0',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:14px',
    'padding:13px 15px 11px',
    'font-family:system-ui,sans-serif',
    'font-size:13px',
    'line-height:1.65',
    'display:none',
    'z-index:100',
    'backdrop-filter:blur(6px)',
  ].join(';')
  document.getElementById('canvas-container').appendChild(el)
  return el
}

function place(clientX, clientY) {
  const rect = _canvas.getBoundingClientRect()
  const x = clientX - rect.left + 18
  const y = clientY - rect.top - 160
  _popup.style.left = Math.min(x, rect.width - 210) + 'px'
  _popup.style.top  = Math.max(y, 8) + 'px'
}

function render(html) {
  _popup.innerHTML = html
  _popup.style.display = 'block'
  _popup.querySelector('.yr-close')?.addEventListener('click',
    () => { _popup.style.display = 'none' })
}

function closeBtn() {
  return `<span class="yr-close" style="cursor:pointer;color:#555;font-size:17px;line-height:1;padding:2px 0 0 8px">×</span>`
}

async function fetchWeather(lat, lon, clientX, clientY) {
  place(clientX, clientY)
  render(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <span style="color:#777;font-size:11px">${coordLabel(lat, lon)}</span>
      ${closeBtn()}
    </div>
    <div style="color:#555;margin-top:6px">Henter…</div>
  `)

  try {
    const res = await fetch(`${YR_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json  = await res.json()
    const ts    = json.properties.timeseries[0]
    const inst  = ts.data.instant.details
    const next  = ts.data.next_1_hours ?? ts.data.next_6_hours
    const emoji = symbolEmoji(next?.summary?.symbol_code)
    const temp  = inst.air_temperature?.toFixed(1) ?? '–'
    const wind  = inst.wind_speed?.toFixed(1) ?? '–'
    const dir   = windDir(inst.wind_from_direction ?? 0)
    const prec  = (next?.details?.precipitation_amount ?? 0).toFixed(1)
    const hum   = inst.relative_humidity?.toFixed(0) ?? '–'

    render(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="font-size:28px;line-height:1">${emoji}</span>
        ${closeBtn()}
      </div>
      <div style="font-size:26px;font-weight:600;margin:4px 0 2px">${temp}°C</div>
      <div style="color:#777;font-size:11px;margin-bottom:9px">${coordLabel(lat, lon)}</div>
      <div>💨 ${wind} m/s ${dir}</div>
      <div>🌧 ${prec} mm</div>
      <div>💧 ${hum}%</div>
      <div style="margin-top:9px;font-size:10px;color:#444;text-align:right">yr.no / MET Norway</div>
    `)
  } catch (err) {
    render(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="color:#e66;font-size:12px">${err.message}</span>
        ${closeBtn()}
      </div>
    `)
  }
}

// ── hit-test helpers ─────────────────────────────────────────────────────────

function sphereHit(e) {
  const rect = _canvas.getBoundingClientRect()
  const ndc  = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    ((e.clientY - rect.top)  / rect.height) * -2 + 1,
  )
  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, _camera)
  const hit = new THREE.Vector3()
  return ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 101), hit)
    ? hit : null
}

function vec3ToLatLon(v) {
  const n = v.clone().normalize()
  const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI
  let lon = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180
  if (lon < -180) lon += 360
  if (lon >  180) lon -= 360
  return [lat, lon]
}

// ── pointer listeners (bubble phase — fires after dragger's capture) ──────────

let _downPos = null

function onPointerDown(e) {
  if (e.button !== 0) return
  _downPos = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e) {
  if (!_enabled || e.button !== 0 || !_downPos) return
  const dx = e.clientX - _downPos.x
  const dy = e.clientY - _downPos.y
  _downPos = null
  if (Math.hypot(dx, dy) > 6) return  // was a drag, not a click

  const hit = sphereHit(e)
  if (!hit) return
  const [lat, lon] = vec3ToLatLon(hit)
  fetchWeather(lat, lon, e.clientX, e.clientY)
}

// ── init ──────────────────────────────────────────────────────────────────────

let _enabled = false

export function setWeatherClickEnabled(enabled) {
  _enabled = enabled
  if (!enabled && _popup) _popup.style.display = 'none'
}

export function initWeatherClick(camera, canvas) {
  _camera = camera
  _canvas = canvas
  _popup  = createPopup()
  canvas.addEventListener('pointerdown', onPointerDown)  // bubble
  canvas.addEventListener('pointerup',   onPointerUp)    // bubble
}

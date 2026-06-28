import * as THREE from 'three'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const COUNTRIES_CDN = 'https://cdn.jsdelivr.net/npm/world-countries@5/countries.json'

let _popup = null
let _camera = null
let _canvas = null
let _enabled = false
let _downPos = null

// Loaded once on first click, then cached
let _byIso2 = null
async function getCountry(iso2) {
  if (!_byIso2) {
    const all = await fetch(COUNTRIES_CDN).then(r => r.json())
    _byIso2 = Object.fromEntries(all.map(c => [c.cca2, c]))
  }
  return _byIso2[iso2] ?? null
}

function createPopup() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:absolute',
    'min-width:180px',
    'max-width:240px',
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
    'pointer-events:auto',
  ].join(';')
  document.getElementById('canvas-container').appendChild(el)
  return el
}

function closeBtn() {
  return `<span class="ci-close" style="cursor:pointer;color:#555;font-size:17px;line-height:1;padding:2px 0 0 8px">×</span>`
}

function place(clientX, clientY) {
  const rect = _canvas.getBoundingClientRect()
  const x = clientX - rect.left + 18
  const y = clientY - rect.top - 200
  _popup.style.left = Math.min(x, rect.width - 260) + 'px'
  _popup.style.top  = Math.max(y, 8) + 'px'
}

function render(html) {
  _popup.innerHTML = html
  _popup.style.display = 'block'
  _popup.querySelector('.ci-close')?.addEventListener('click',
    () => { _popup.style.display = 'none' })
}

function fmtPop(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' mrd'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' mill'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' 000'
  return String(n)
}

function fmtArea(n) {
  if (!n) return '–'
  return n.toLocaleString('en-US') + ' km²'
}

function sphereHit(e) {
  const rect = _canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(
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

async function fetchCountryInfo(lat, lon, clientX, clientY) {
  place(clientX, clientY)
  render(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <span style="color:#777;font-size:11px">${lat.toFixed(2)}°, ${lon.toFixed(2)}°</span>
      ${closeBtn()}
    </div>
    <div style="color:#555;margin-top:6px">Loading…</div>
  `)

  try {
    const geo = await fetch(
      `${NOMINATIM_URL}?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&format=json&zoom=6&accept-language=en`
    ).then(r => r.json())

    const countryCode = geo.address?.country_code?.toUpperCase()
    if (!countryCode) {
      render(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <span style="font-size:22px">🌊</span>
          ${closeBtn()}
        </div>
        <div style="font-weight:600;margin:4px 0 2px">Open sea</div>
        <div style="color:#555;font-size:11px">${lat.toFixed(3)}°, ${lon.toFixed(3)}°</div>
      `)
      return
    }

    const country = await getCountry(countryCode)

    const flag     = country?.flag ?? ''
    const name     = country?.name?.common ?? geo.address?.country ?? countryCode
    const capital  = (country?.capital ?? [])[0] ?? '–'
    const pop      = fmtPop(country?.population ?? 0)
    const area     = fmtArea(country?.area)
    const langs    = Object.values(country?.languages ?? {}).slice(0, 2).join(', ') || '–'
    const currencies = Object.values(country?.currencies ?? {})
    const currency = currencies.length
      ? `${currencies[0].name} (${currencies[0].symbol ?? Object.keys(country.currencies)[0]})`
      : '–'

    // For countries with states/provinces, show the subdivision
    const subdivision = geo.address?.state ?? geo.address?.province ?? geo.address?.region ?? ''
    const showSub = subdivision && subdivision !== name

    render(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="font-size:2em;line-height:1">${flag}</span>
        ${closeBtn()}
      </div>
      <div style="font-size:1.1em;font-weight:600;margin:6px 0 2px">${name}</div>
      ${showSub ? `<div style="color:#ccc;font-size:12px;margin-bottom:2px">📍 ${subdivision}</div>` : ''}
      <div style="color:#888;font-size:11px;margin-bottom:8px">🏛 ${capital}</div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">
        ${country?.population ? `<div>👥 ${pop}</div>` : ''}
        <div>📐 ${area}</div>
        <div>💬 ${langs}</div>
        <div>💰 ${currency}</div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:#444;text-align:right">world-countries / OSM</div>
    `)
  } catch (err) {
    console.error('[countryinfo] fetch error:', err)
    render(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="color:#e66;font-size:12px">Could not load data</span>
        ${closeBtn()}
      </div>
      <div style="color:#555;font-size:10px;margin-top:4px">${err.message}</div>
    `)
  }
}

function onPointerDown(e) {
  if (e.button !== 0) return
  _downPos = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e) {
  if (!_enabled || e.button !== 0 || !_downPos) return
  const dx = e.clientX - _downPos.x
  const dy = e.clientY - _downPos.y
  _downPos = null
  if (Math.hypot(dx, dy) > 6) return

  if (_popup.style.display !== 'none') { _popup.style.display = 'none'; return }

  const hit = sphereHit(e)
  if (!hit) return
  const [lat, lon] = vec3ToLatLon(hit)
  fetchCountryInfo(lat, lon, e.clientX, e.clientY)
}

export function initCountryInfo(camera, canvas) {
  _camera = camera
  _canvas = canvas
  _popup  = createPopup()
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup',   onPointerUp)
}

export function setCountryInfoEnabled(enabled) {
  _enabled = enabled
  if (!enabled && _popup) _popup.style.display = 'none'
}

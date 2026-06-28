// Discrete API health indicator: small dot bottom-left, hover → per-API list

const today = () => new Date().toISOString().slice(0, 10)

const APIS = [
  { name: 'USGS Earthquakes',   url: () => 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson' },
  { name: 'NASA EONET',         url: () => 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1' },
  { name: 'NASA DONKI',         url: () => `https://api.nasa.gov/DONKI/FLR?startDate=${today()}&endDate=${today()}&api_key=DEMO_KEY` },
  { name: 'NOAA Space Weather', url: () => 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json' },
  { name: 'ISS Position',       url: () => 'https://api.wheretheiss.at/v1/satellites/25544' },
  { name: 'MET Norway',         url: () => 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.9&lon=10.7' },
  { name: 'OSM Nominatim',      url: () => 'https://nominatim.openstreetmap.org/reverse?lat=59.9&lon=10.7&format=json&zoom=3' },
  { name: 'jsDelivr CDN',       url: () => 'https://cdn.jsdelivr.net/npm/world-countries@5/countries.json' },
  { name: 'GitHub Raw',         url: () => 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json' },
]

// Fetch only headers, abort body download immediately
async function ping(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    ctrl.abort()
    return res.ok
  } catch {
    clearTimeout(timer)
    return false
  }
}

let _dot   = null
let _panel = null
let _statuses = APIS.map(() => null)  // null = pending, true = ok, false = fail

function dotColor() {
  const known = _statuses.filter(s => s !== null)
  if (!known.length)           return '#555'
  if (known.every(s => s))     return '#22c55e'
  if (known.some(s => s))      return '#eab308'
  return '#ef4444'
}

function render() {
  _dot.style.background = dotColor()

  const rows = APIS.map((api, i) => {
    const s = _statuses[i]
    const color = s === null ? '#555' : s ? '#22c55e' : '#ef4444'
    return `<div style="display:flex;align-items:center;gap:6px;padding:1px 0">
      <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
      <span style="color:${s === false ? '#ef4444' : '#ccc'}">${api.name}</span>
    </div>`
  }).join('')

  const ok   = _statuses.filter(s => s === true).length
  const fail = _statuses.filter(s => s === false).length
  const summary = fail
    ? `<div style="color:#ef4444;font-size:10px;margin-top:6px">${fail} unreachable</div>`
    : ok === APIS.length
      ? `<div style="color:#22c55e;font-size:10px;margin-top:6px">All ${ok} APIs OK</div>`
      : `<div style="color:#555;font-size:10px;margin-top:6px">Checking…</div>`

  _panel.innerHTML = `
    <div style="font-size:11px;font-family:system-ui,sans-serif;line-height:1.7">
      ${rows}${summary}
    </div>`
}

async function refresh() {
  _statuses = APIS.map(() => null)
  render()
  await Promise.all(APIS.map(async (api, i) => {
    _statuses[i] = await ping(api.url())
    render()
  }))
}

export function initApiStatus() {
  // Dot
  _dot = document.createElement('div')
  _dot.style.cssText = [
    'position:fixed', 'bottom:5.6rem', 'left:1.15rem',
    'width:8px', 'height:8px', 'border-radius:50%',
    'background:#555', 'cursor:default', 'z-index:200',
    'transition:background 0.4s',
  ].join(';')

  // Hover panel
  _panel = document.createElement('div')
  _panel.style.cssText = [
    'position:fixed', 'bottom:7rem', 'left:0.7rem',
    'background:rgba(8,8,8,0.88)', 'color:#ccc',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:10px', 'padding:8px 11px',
    'backdrop-filter:blur(6px)', 'z-index:201',
    'display:none', 'pointer-events:none',
    'white-space:nowrap',
  ].join(';')

  _dot.addEventListener('mouseenter', () => { _panel.style.display = 'block' })
  _dot.addEventListener('mouseleave', () => { _panel.style.display = 'none' })

  document.body.appendChild(_dot)
  document.body.appendChild(_panel)

  refresh()
  setInterval(refresh, 5 * 60 * 1000)
}

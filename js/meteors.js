import * as THREE from 'three'

// ── Shower data ───────────────────────────────────────────────────────────────
// window: [[startMonth, startDay], [endMonth, endDay]]
// peak:   [month, day]
// ra/dec: J2000 radiant coordinates (degrees)
const SHOWERS = [
  { name:'Quadrantids',    peak:[1,3],   window:[[12,28],[1,12]],  zhr:120, ra:230, dec:49,  color:[0.4,0.7,1.0] },
  { name:'Lyrids',         peak:[4,22],  window:[[4,14],[4,30]],   zhr:18,  ra:271, dec:33,  color:[0.7,1.0,0.6] },
  { name:'Eta Aquariids',  peak:[5,6],   window:[[4,19],[5,28]],   zhr:50,  ra:338, dec:-1,  color:[0.4,0.8,1.0] },
  { name:'Perseids',       peak:[8,12],  window:[[7,17],[8,24]],   zhr:100, ra:48,  dec:58,  color:[0.3,0.6,1.0] },
  { name:'Draconids',      peak:[10,8],  window:[[10,6],[10,10]],  zhr:10,  ra:262, dec:54,  color:[0.5,1.0,0.5] },
  { name:'Orionids',       peak:[10,21], window:[[10,2],[11,7]],   zhr:20,  ra:95,  dec:16,  color:[1.0,0.6,0.2] },
  { name:'Leonids',        peak:[11,17], window:[[11,6],[11,30]],  zhr:15,  ra:152, dec:22,  color:[1.0,0.4,0.1] },
  { name:'Geminids',       peak:[12,14], window:[[12,4],[12,20]],  zhr:120, ra:112, dec:33,  color:[1.0,0.85,0.3] },
  { name:'Ursids',         peak:[12,22], window:[[12,17],[12,26]], zhr:10,  ra:217, dec:76,  color:[0.6,0.8,1.0] },
]

const SPORADIC_COLOR = [0.55, 0.7, 1.0]

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SPAWN_R    = 400   // spawn radius (deep space)
const BURN_R     = 108   // burn-up radius (in atmosphere)
const TRAIL_LEN  = 55    // world units for streak length
const MAX_ACTIVE = 80    // max simultaneous meteor lines
const SPORADIC_RATE = 0.25  // meteors/sec always on

// ── Module state ──────────────────────────────────────────────────────────────
let _group     = null
let _panel     = null
let _sprite    = null
let _visible   = false
let _active    = []       // array of meteor objects
let _spawnAccum = 0

// ── Date helpers ──────────────────────────────────────────────────────────────

function _doy(m, d) {
  const acc = [0,31,59,90,120,151,181,212,243,273,304,334]
  return acc[m - 1] + d
}

function _getActiveShower() {
  const now   = new Date()
  const today = _doy(now.getMonth() + 1, now.getDate())
  for (const s of SHOWERS) {
    const start = _doy(s.window[0][0], s.window[0][1])
    const end   = _doy(s.window[1][0], s.window[1][1])
    const active = start <= end
      ? today >= start && today <= end
      : today >= start || today <= end  // crosses year boundary
    if (active) {
      const peakDoy = _doy(s.peak[0], s.peak[1])
      return { shower: s, today, peakDoy }
    }
  }
  return null
}

function _nextShower() {
  const now   = new Date()
  const today = _doy(now.getMonth() + 1, now.getDate())
  let best = null, bestDays = 999
  for (const s of SHOWERS) {
    const peakDoy = _doy(s.peak[0], s.peak[1])
    let days = peakDoy - today
    if (days < 0) days += 365
    if (days < bestDays) { bestDays = days; best = { shower: s, days } }
  }
  return best
}

function _currentRate(active) {
  if (!active) return SPORADIC_RATE
  const { shower, today, peakDoy } = active
  let diff = today - peakDoy
  if (diff >  182) diff -= 365
  if (diff < -182) diff += 365
  const intensity  = Math.exp(-(diff * diff) / 9)   // Gaussian, half-width ~3 days
  const showerRate = SPORADIC_RATE + (shower.zhr / 120) * 0.9
  return SPORADIC_RATE + (showerRate - SPORADIC_RATE) * intensity
}

// ── Radiant direction ─────────────────────────────────────────────────────────

function _radiantDir(ra, dec) {
  const now  = new Date()
  const jd   = now.getTime() / 86400000 + 2440587.5
  const gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360 + 360) % 360
  const ha   = (gmst - ra) * Math.PI / 180
  const d    = dec * Math.PI / 180
  return new THREE.Vector3(
    Math.cos(d) * Math.cos(ha),
    Math.sin(d),
    Math.cos(d) * Math.sin(ha),
  ).normalize()
}

// ── Radiant glow sprite ───────────────────────────────────────────────────────

function _makeGlowTex() {
  const c   = document.createElement('canvas')
  c.width   = c.height = 64
  const ctx = c.getContext('2d')
  const g   = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
  g.addColorStop(0,   'rgba(255,220,150,1)')
  g.addColorStop(0.4, 'rgba(255,160,80,0.5)')
  g.addColorStop(1,   'rgba(255,100,30,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function _updateRadiantSprite(active) {
  if (!_sprite) return
  if (!active) { _sprite.visible = false; return }
  const dir = _radiantDir(active.shower.ra, active.shower.dec)
  _sprite.position.copy(dir.multiplyScalar(350))
  _sprite.visible = _visible
}

// ── Meteor spawning ───────────────────────────────────────────────────────────

function _spawnMeteor(active) {
  let incomingDir
  let tailColor = SPORADIC_COLOR

  if (active && Math.random() < 0.85) {
    // Shower meteor: comes from radiant direction with small spread
    const rd = _radiantDir(active.shower.ra, active.shower.dec)
    let perp = new THREE.Vector3(-rd.y, rd.x, 0)
    if (perp.lengthSq() < 1e-6) perp.set(0, -rd.z, rd.y)
    perp.normalize()
    const perp2 = rd.clone().cross(perp).normalize()
    incomingDir = rd.clone().negate()
      .addScaledVector(perp,  (Math.random() - 0.5) * 0.3)
      .addScaledVector(perp2, (Math.random() - 0.5) * 0.3)
      .normalize()
    tailColor = active.shower.color
  } else {
    // Sporadic: random direction
    incomingDir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize()
  }

  // Tangential spread so meteors don't all overlap
  let perp = new THREE.Vector3(-incomingDir.y, incomingDir.x, 0)
  if (perp.lengthSq() < 1e-6) perp.set(0, -incomingDir.z, incomingDir.y)
  perp.normalize()
  const perp2 = incomingDir.clone().cross(perp).normalize()
  const offsetAngle = Math.random() * Math.PI * 2
  const offsetR     = Math.random() * 55

  const head0 = incomingDir.clone()
    .multiplyScalar(-SPAWN_R)
    .addScaledVector(perp,  Math.cos(offsetAngle) * offsetR)
    .addScaledVector(perp2, Math.sin(offsetAngle) * offsetR)

  const speed    = 180 + Math.random() * 140   // world units / sec
  const velocity = incomingDir.clone().multiplyScalar(speed)
  const duration = ((SPAWN_R - BURN_R) / speed) * (0.65 + Math.random() * 0.25)

  const positions = new Float32Array(6)
  const colors    = new Float32Array([
    tailColor[0] * 0.6, tailColor[1] * 0.6, tailColor[2] * 0.6,  // tail: dim colored
    1, 1, 1,                                                        // head: bright white
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3))

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent:  true,
    opacity:      1.0,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending,
  })

  const line          = new THREE.Line(geo, mat)
  line.frustumCulled  = false
  _group.add(line)

  return { head0, velocity, age: 0, duration, line, mat, tailColor }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function _buildPanel() {
  _panel = document.createElement('div')
  _panel.style.cssText = [
    'display:none', 'flex-direction:column', 'gap:0.5rem',
    'padding:0.85rem 1.4rem', 'background:rgba(0,0,0,0.75)',
    'border-radius:1.25rem', 'backdrop-filter:blur(10px)',
    'font-family:system-ui,sans-serif', 'color:white',
    'min-width:280px', 'pointer-events:none',
  ].join(';')
  document.getElementById('panel-stack').appendChild(_panel)
}

function _colorHex(rgb) {
  return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

function _updatePanel(active) {
  if (!_panel || _panel.style.display === 'none') return
  if (active) {
    const s       = active.shower
    const hex     = _colorHex(s.color)
    const dayStr  = `${s.peak[1]}. ${MONTHS_SHORT[s.peak[0] - 1]}`
    const diff    = active.today - active.peakDoy
    const daysStr = diff === 0 ? '🌟 Peak today!'
      : diff < 0  ? `${-diff} days to peak (${dayStr})`
      :             `${diff} days after peak (${dayStr})`
    const intensity = Math.min(1, s.zhr / 120)
    const bars      = Math.round(intensity * 8)
    const barStr    = '█'.repeat(bars) + '░'.repeat(8 - bars)
    _panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem">
        <span style="font-size:18px;font-weight:700;color:${hex}">☄️ ${s.name}</span>
      </div>
      <div style="font-size:11px;color:#aaa;letter-spacing:0.05em">
        <span style="color:${hex};font-family:monospace">${barStr}</span>
        &nbsp;ZHR ~${s.zhr}
      </div>
      <div style="font-size:12px;color:#bbb">${daysStr}</div>
    `
  } else {
    const next = _nextShower()
    const s    = next?.shower
    const hex  = s ? _colorHex(s.color) : '#888'
    const ns   = s
      ? `<span style="color:${hex}">${s.name}</span> · ${s.peak[1]}. ${MONTHS_SHORT[s.peak[0]-1]} (in ${next.days} days)`
      : '—'
    _panel.innerHTML = `
      <div style="font-size:17px;font-weight:600;color:#aaa">☄️ Sporadic meteors</div>
      <div style="font-size:12px;color:#666">Next shower: ${ns}</div>
    `
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initMeteors(scene) {
  _group         = new THREE.Group()
  _group.visible = false
  scene.add(_group)

  // Radiant glow sprite (shown only during active showers)
  const spriteMat  = new THREE.SpriteMaterial({
    map:         _makeGlowTex(),
    transparent: true,
    opacity:     0.7,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  })
  _sprite         = new THREE.Sprite(spriteMat)
  _sprite.scale.setScalar(25)
  _sprite.frustumCulled = false
  _sprite.visible = false
  scene.add(_sprite)

  _buildPanel()
}

export function setMeteorsVisible(v) {
  _visible = v
  if (_group) _group.visible = v
  if (_panel) _panel.style.display = v ? 'flex' : 'none'
  if (!v) {
    if (_sprite) _sprite.visible = false
    // Clean up active meteors
    for (const m of _active) {
      _group.remove(m.line)
      m.line.geometry.dispose()
      m.mat.dispose()
    }
    _active     = []
    _spawnAccum = 0
  }
}

export function updateMeteors(delta) {
  if (!_group?.visible) return

  const active = _getActiveShower()
  _updateRadiantSprite(active)

  // Spawn
  _spawnAccum += delta * _currentRate(active)
  if (_spawnAccum > 2) _spawnAccum = 2  // safety: clamp before loop
  while (_spawnAccum >= 1 && _active.length < MAX_ACTIVE) {
    _spawnAccum -= 1
    _active.push(_spawnMeteor(active))
  }

  // Update and cull
  const toRemove = []
  for (const m of _active) {
    m.age += delta
    const t = m.age / m.duration
    if (t >= 1) { toRemove.push(m); continue }

    const head = m.head0.clone().addScaledVector(m.velocity, m.age)

    // Skip if behind the globe (dot product with camera would be better,
    // but simple distance check is sufficient here)
    if (head.length() < 95) { toRemove.push(m); continue }

    const trailScale = Math.min(1, t * 4)  // trail grows in over first 25% of life
    const tail = head.clone().addScaledVector(
      m.velocity.clone().normalize(), -TRAIL_LEN * trailScale
    )

    const pos = m.line.geometry.attributes.position
    pos.setXYZ(0, tail.x, tail.y, tail.z)
    pos.setXYZ(1, head.x, head.y, head.z)
    pos.needsUpdate = true

    // Fade via vertex colors: head white→dim, tail colored→black
    const fade = t > 0.65 ? (1 - t) / 0.35 : 1.0
    const col  = m.line.geometry.attributes.color
    col.setXYZ(0, m.tailColor[0] * 0.6 * fade, m.tailColor[1] * 0.6 * fade, m.tailColor[2] * 0.6 * fade)
    col.setXYZ(1, fade, fade, fade)
    col.needsUpdate = true
  }

  for (const m of toRemove) {
    _group.remove(m.line)
    m.line.geometry.dispose()
    m.mat.dispose()
    _active.splice(_active.indexOf(m), 1)
  }

  _updatePanel(active)
}

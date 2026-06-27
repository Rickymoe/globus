import * as THREE from 'three'
import { feature } from 'topojson-client'

const R = 103  // above cloud layer (r=102)

// ISO 3166-1 numeric → display name
const NAMES = {
  4:'Afghanistan', 8:'Albania', 12:'Algeria', 24:'Angola', 32:'Argentina',
  36:'Australia', 40:'Austria', 50:'Bangladesh', 56:'Belgium', 64:'Bhutan',
  68:'Bolivia', 76:'Brazil', 100:'Bulgaria', 104:'Myanmar', 116:'Cambodia',
  120:'Cameroon', 124:'Canada', 140:'C. Afr. Rep.', 152:'Chile', 156:'China',
  170:'Colombia', 178:'Congo', 180:'DR Congo', 188:'Costa Rica', 192:'Cuba',
  203:'Czechia', 208:'Denmark', 218:'Ecuador', 818:'Egypt', 231:'Ethiopia',
  246:'Finland', 250:'France', 266:'Gabon', 276:'Germany', 288:'Ghana',
  300:'Greece', 304:'Greenland', 320:'Guatemala', 332:'Haiti', 340:'Honduras',
  348:'Hungary', 352:'Iceland', 356:'India', 360:'Indonesia', 364:'Iran',
  368:'Iraq', 372:'Ireland', 376:'Israel', 380:'Italy', 392:'Japan',
  400:'Jordan', 398:'Kazakhstan', 404:'Kenya', 408:'N. Korea', 410:'S. Korea',
  418:'Laos', 422:'Lebanon', 434:'Libya', 442:'Luxembourg', 466:'Mali',
  478:'Mauritania', 484:'Mexico', 458:'Malaysia', 496:'Mongolia',
  504:'Morocco', 508:'Mozambique', 516:'Namibia', 524:'Nepal',
  528:'Netherlands', 554:'New Zealand', 558:'Nicaragua', 562:'Niger',
  566:'Nigeria', 578:'Norway', 586:'Pakistan', 591:'Panama', 600:'Paraguay',
  604:'Peru', 608:'Philippines', 616:'Poland', 620:'Portugal', 642:'Romania',
  643:'Russia', 682:'Saudi Arabia', 686:'Senegal', 706:'Somalia',
  710:'South Africa', 724:'Spain', 144:'Sri Lanka', 729:'Sudan',
  752:'Sweden', 756:'Switzerland', 760:'Syria', 764:'Thailand',
  792:'Turkey', 800:'Uganda', 804:'Ukraine', 784:'UAE', 826:'UK',
  840:'USA', 858:'Uruguay', 860:'Uzbekistan', 862:'Venezuela',
  704:'Vietnam', 887:'Yemen', 894:'Zambia', 716:'Zimbabwe',
  51:'Armenia', 31:'Azerbaijan', 112:'Belarus', 191:'Croatia',
  233:'Estonia', 268:'Georgia', 428:'Latvia', 498:'Moldova',
  703:'Slovakia', 705:'Slovenia', 450:'Madagascar', 512:'Oman',
  634:'Qatar', 417:'Kyrgyzstan', 762:'Tajikistan', 795:'Turkmenistan',
}

// Manual [lon, lat] overrides for countries where auto-centroid is inaccurate
// (elongated shapes, antimeridian-crossing, island chains, etc.)
const CENTROID_OVERRIDE = {
  578: [10,   65],  // Norway — narrow coastal strip, auto-centroid lands in Sweden
  304: [-42,  72],  // Greenland — not in topojson features, placed manually
  352: [-18,  65],  // Iceland
  152: [-71, -33],  // Chile — very elongated N-S, centroid drifts into Argentina
  124: [-96,  58],  // Canada — antimeridian + Nunavut skew
  643: [ 55,  62],  // Russia — antimeridian split
  840: [-100, 40],  // USA — Alaska pulls centroid far west
  360: [113,  -1],  // Indonesia — island chain, centroid falls in sea
  608: [122,  12],  // Philippines — island chain
  554: [171, -42],  // New Zealand — two islands, centroid in sea
  826: [ -2,  54],  // UK — centroid drifts into North Sea
  458: [110,   4],  // Malaysia — split between peninsula and Borneo
}

function latLonToVec3(lat, lon) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -R * Math.cos(theta) * Math.sin(phi),
     R * Math.cos(phi),
     R * Math.sin(theta) * Math.sin(phi),
  )
}

function ringCentroid(ring) {
  let lon = 0, lat = 0
  for (const [lo, la] of ring) { lon += lo; lat += la }
  return [lon / ring.length, lat / ring.length]
}

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width  = 256
  canvas.height = 48
  const ctx = canvas.getContext('2d')

  ctx.font = 'bold 15px system-ui, sans-serif'
  const tw = ctx.measureText(text).width
  const bw = tw + 18, bh = 26
  const bx = (256 - bw) / 2, by = (48 - bh) / 2

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 5)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 24)

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
  }))
  sprite.scale.set(14, 2.625, 1)
  return sprite
}

// Extra labels for regions/territories not in the topojson as separate countries
// Each entry: [name, lon, lat]
const MANUAL_LABELS = [
  ['Alaska', -153, 64],
]

let _group = null

export async function initLabels(scene) {
  _group = new THREE.Group()
  _group.visible = false  // off by default
  scene.add(_group)

  const world = await fetch(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  ).then(r => r.json())

  for (const f of feature(world, world.objects.countries).features) {
    const id = Number(f.id)
    const name = NAMES[id]
    if (!name) continue

    let lon, lat
    if (CENTROID_OVERRIDE[id]) {
      ;[lon, lat] = CENTROID_OVERRIDE[id]
    } else {
      const geom = f.geometry
      let ring
      if (geom.type === 'Polygon') {
        ring = geom.coordinates[0]
      } else {
        ring = geom.coordinates.map(p => p[0]).reduce((a, b) => b.length > a.length ? b : a)
      }
      ;[lon, lat] = ringCentroid(ring)
    }
    const sprite = makeLabelSprite(name)
    sprite.position.copy(latLonToVec3(lat, lon))
    _group.add(sprite)
  }

  for (const [name, lon, lat] of MANUAL_LABELS) {
    const sprite = makeLabelSprite(name)
    sprite.position.copy(latLonToVec3(lat, lon))
    _group.add(sprite)
  }
}

export function setLabelsVisible(visible) {
  if (_group) _group.visible = visible
}

export function setLabelsCenterEye(inside) {
  if (!_group) return
  const s = inside ? 97 / 103 : 1
  _group.scale.setScalar(s)
}

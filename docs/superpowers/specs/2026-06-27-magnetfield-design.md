# Magnetfelt-visualisering — Design

**Dato:** 2026-06-27  
**Issue:** #22  
**Status:** Godkjent

## Sammendrag

Legger til visualisering av jordens magnetfelt som en del av den eksisterende Polarlys-togglen (🌌). Ingen ny toggle. Når aurora er på, vises både aurora-ringen og magnetfeltet.

## Komponenter

### Ny modul: `js/magnetfield.js`

Eksporterer:
- `initMagnetField(scene)` — oppretter feltlinjer og partikkel-mesh, begge usynlige som default
- `setMagnetFieldVisible(v)` — async-safe: lagrer `_visible`, setter på begge mesh når de finnes
- `updateMagnetField(delta)` — øker `uTime` i partikkel-shaderen når synlig

#### 1. Feltlinjer (`THREE.LineSegments`)

Dipol-feltlinje-ligning: `r = L · cos²(λ_m)` der `L` er skall-parameteren og `λ_m` er magnetisk breddegrad.

- **L-skall:** 1.1, 1.5, 2.0, 2.5 (tilsvarer 110–250 enheter fra sentrum)
- **Meridianer:** 12 stk., jevnt fordelt (0°, 30°, 60°... 330°)
- **Steg per linje:** 80 punkter, λ_m fra −80° til +80°
- **Totalt:** 48 linjer, beregnet én gang på CPU ved init
- **Magnetisk akse-tilt:** 11° rotasjon via `THREE.Matrix4` (rotasjon rundt Z-aksen tilnærmet)
- **Material:** `LineBasicMaterial`, farge `#4488ff`, `transparent: true`, `opacity: 0.35`, `depthWrite: false`, `depthTest: false`
- **renderOrder:** 3 (over aurora renderOrder=2)

#### 2. Partikler (`THREE.Points` + GLSL vertex shader)

~2000 partikler, fullstendig GPU-animert.

**Attributter per partikkel:**
- `aL` — feltlinje-skall (tilfeldig fra de 4 L-verdiene)
- `aMagLon` — magnetisk lengdegrad (tilfeldig 0–2π)
- `aPhase` — startposisjon langs banen (tilfeldig 0–1)
- `aSpeed` — individuel hastighet (tilfeldig 0.08–0.18)

**Vertex shader:**
```glsl
t = mod(aPhase + uTime * aSpeed, 1.0)
λ_m = (t - 0.5) * π  // −π/2 til +π/2
r = aL * cos²(λ_m) * 100.0
// Konverter (r, λ_m, aMagLon) → Cartesisk
// Anvend 11° tilt-rotasjon
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0)
gl_PointSize = 3.0
```

**Fragment shader:** Forkaster hjørner (cirkelform), farge blå-hvit.

**Material:** `ShaderMaterial`, `transparent: true`, `depthWrite: false`, `depthTest: false`, `blending: THREE.AdditiveBlending`

**renderOrder:** 4

## Endringer i eksisterende filer

### `js/app.js`
- Import: `initMagnetField`, `setMagnetFieldVisible`, `updateMagnetField`
- `initMagnetField(scene)` i init-sekvensen
- `onAurora: v => { setAuroraVisible(v); setMagnetFieldVisible(v) }`
- `updateMagnetField(delta)` i loop

### `js/controls.js`
Ingen endringer.

### `index.html`
Ingen endringer (ingen ny toggle).

## Sfære-stakk (oppdatert)

| renderOrder / radius | Objekt |
|---|---|
| renderOrder:-10 | Stjerner |
| r=100 | Terrain |
| r=101 | Vann |
| r=101.5 | Grenser |
| r=103 | Labels, Capitals |
| r=130 | Atmosfære |
| renderOrder=2 | Aurora |
| **renderOrder=3** | **Magnetfelt-linjer (ny)** |
| **renderOrder=4** | **Magnetfelt-partikler (ny)** |
| r=200 | Måne |
| r=2000 | Sol |

## Ikke i scope

- Ekte IGRF-data (dipol-tilnærming er tilstrekkelig visuelt)
- Separat toggle
- Interaksjon/tooltip på feltlinjene

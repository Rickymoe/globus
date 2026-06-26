# Live jordskalv-visualisering — Design

**Dato:** 2026-06-26
**Repo:** Rickymoe/globus

## Oversikt

Henter sanntids jordskalvdata (M2.5+, siste 7 dager) fra USGS GeoJSON Feed og viser dem som pulserende ringer på jordkloden. Fargekodede etter magnitude, animert med expand+fade-loop.

**Datakilde:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson`

## Filer som påvirkes

- **Ny:** `js/earthquakes.js` — henting, geometri, animasjon
- **Modifiser:** `index.html` — legg til toggle-knapp
- **Modifiser:** `js/controls.js` — legg til `onEarthquakes` callback
- **Modifiser:** `js/app.js` — importer, init, koble til loop og controls

## Teknisk tilnærming

### earthquakes.js

Radius R = 101.5 (samme som us-states.js, rett over overflaten).

`latLonToVec3(lat, lon)` — identisk konvertering som us-states.js.

For hvert jordskalv:
- Opprett en `THREE.RingGeometry(0.8, 1.2, 32)` som representerer ringen
- Roter ringen slik at den er tangent til klodeoverflaten (normalvektor peker ut fra sentrum)
- Plasser ved jordskalvets koordinater

Farge etter magnitude:
- M 2.5–4.0 → `0xffee00` (gul)
- M 4.0–6.0 → `0xff7700` (oransje)
- M 6.0+    → `0xff1a1a` (rød)

Startskala etter magnitude:
- M < 4: maxScale = 1.5
- M 4–6: maxScale = 2.5
- M 6+:  maxScale = 4.0

Animasjon per ring: hver ring har en `phase` offset (0–1, randomisert ved oppstart).
I `updateEarthquakes(delta)`:
- `t = (elapsed + phase) % period` / period  → 0..1
- `scale = t * maxScale`
- `opacity = 1 - t`
- Sett `mesh.scale.setScalar(scale)` og `mesh.material.opacity = opacity`

Alle ringer samlet i en `THREE.Group`. Toggle: `_group.visible = visible`.

Eksporterte funksjoner:
```js
export async function initEarthquakes(scene) { ... }
export function setEarthquakesVisible(visible) { ... }
export function updateEarthquakes(delta) { ... }
```

### index.html

Legg til i `#toggle-stack` (etter `#weather-toggle`):
```html
<div id="earthquakes-toggle" class="float-toggle" title="Jordskalv (USGS)">
  <span class="toggle-icon">🌋</span>
  <div class="toggle-track"><div class="toggle-thumb"></div></div>
</div>
```

### controls.js

Legg til parameter `onEarthquakes` og koble til `earthquakes-toggle`:
```js
export function initControls({ ..., onEarthquakes }) {
  const earthquakesToggle = makeToggle('earthquakes-toggle', onEarthquakes)
  onEarthquakes(earthquakesToggle.classList.contains('active'))
}
```

### app.js

```js
import { initEarthquakes, setEarthquakesVisible, updateEarthquakes } from './earthquakes.js'
// i main():
initEarthquakes(scene)
// i initControls:
onEarthquakes: setEarthquakesVisible,
// i startLoop-callback:
updateEarthquakes(delta)  // delta fra globe.js startLoop
```

## Dekomponering

**Task 1:** Opprett `js/earthquakes.js` med fetch, geometri og animasjon
**Task 2:** Koble inn i `index.html`, `controls.js` og `app.js`

## Forutsetninger

- `startLoop` i `globe.js` eksponerer `delta` til callback — sjekk om dette er tilfelle, ellers bruk `THREE.Clock` internt i earthquakes.js
- USGS-APIet er åpent (ingen API-nøkkel)

# ISS Real-Time Tracker — Design

**Dato:** 2026-06-26
**Repo:** Rickymoe/globus

## Oversikt

Viser ISS (Den internasjonale romstasjonen) som en lysende prikk som orbiterer jordkloden i sanntid. Posisjonsdata fra Open Notify API, oppdatert hvert 10. sekund. Aktiveres via toggle-knapp med 🛸-ikon.

**Datakilde:** `https://api.open-notify.org/iss-now.json` (åpent API, støtter CORS)

## Filer som påvirkes

- **Ny:** `js/iss.js` — fetch, geometri, oppdatering
- **Modifiser:** `index.html` — legg til toggle-knapp
- **Modifiser:** `js/controls.js` — legg til `onIss` callback
- **Modifiser:** `js/app.js` — importer, init, toggle

## Teknisk tilnærming

### ISS-høyde og radius

- Jordklode: R = 100 world units = 6371 km (faktisk radius)
- ISS orbiterer ~408 km over overflaten
- Skalert: 408 / 6371 × 100 ≈ 6.4 world units
- ISS-radius: **R_ISS = 106.4**

### latLonToVec3

Identisk konvertering som us-states.js / capitals.js, men med R_ISS:

```js
function latLonToVec3(lat, lon, r) {
  const phi   = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(
    -r * Math.cos(theta) * Math.sin(phi),
     r * Math.cos(phi),
     r * Math.sin(theta) * Math.sin(phi),
  )
}
```

### Geometri

ISS vises som `THREE.Points` med én prikk:
- `PointsMaterial({ color: 0xffffff, size: 8, sizeAttenuation: true })`
- Plasseres ved korrekt lat/lon på R_ISS

### Glød-effekt

En ekstra, litt større `THREE.Points`-instans med:
- `color: 0x88ccff, size: 16, opacity: 0.4, transparent: true`
- Samme posisjon — skaper en myk lyshalo

### Tooltip

Klikk på ISS-prikken (raycaster) viser en popup:
```
🛸 ISS
Høyde: 408 km
Hastighet: 7.66 km/s
```
(Statiske verdier — tilstrekkelig for v1)

### Polling

```js
async function fetchAndUpdate() {
  const res = await fetch('https://api.open-notify.org/iss-now.json')
  const data = await res.json()
  const lat = parseFloat(data.iss_position.latitude)
  const lon = parseFloat(data.iss_position.longitude)
  updateIssPosition(lat, lon)
}
// Oppdater umiddelbart, deretter hvert 10. sekund
fetchAndUpdate()
setInterval(fetchAndUpdate, 10000)
```

### iss.js eksporterte funksjoner

```js
export async function initIss(scene, camera, canvas) { ... }
export function setIssVisible(visible) { ... }
```

### index.html

Legg til etter `#earthquakes-toggle`:
```html
<div id="iss-toggle" class="float-toggle" title="ISS — sanntidsposisjon">
  <span class="toggle-icon">🛸</span>
  <div class="toggle-track"><div class="toggle-thumb"></div></div>
</div>
```

### controls.js

Legg til `onIss` parameter og `makeToggle('iss-toggle', onIss)`.

### app.js

```js
import { initIss, setIssVisible } from './iss.js'
// i main():
initIss(scene, getCamera(), getCanvas())
// i initControls:
onIss: setIssVisible,
```

## Dekomponering

**Task 1:** Opprett `js/iss.js` med fetch, geometri, glow og polling
**Task 2:** Koble inn i `index.html`, `controls.js`, `app.js`

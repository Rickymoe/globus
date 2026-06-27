# Planet Comparison Mode — Design Spec
*Issue #23 · 2026-06-27*

## Mål

Gi brukeren en visuell følelse av størrelsesforholdet mellom Jorda og andre planeter. Valgt planet vises som en gigantisk bakgrunn bak jordkloden; brukeren zoomer naturlig ut for å se begge i kontekst. Banebevegelse er ikke formålet — kun skala.

---

## Brukerflyt

1. Brukeren slår på 🪐-toggle → sol-systemet vises som i dag, OG et planetpanel dukker opp nederst på skjermen.
2. Brukeren trykker på en planet (f.eks. Jupiter) → **planet-sammenlignings-modus** aktiveres.
3. I sammenlignings-modus:
   - Normal globusscene skjules (atmosfære, lys, border m.m. skjules).
   - Valgt planet rendres i korrekt størrelse relativt til Jorda (r=100 world units).
   - Jorda-sfæren posisjoneres foran planeten.
   - Planeten plasseres langs −Z-aksen, sentrert bak Jorda.
   - Kamera starter tett på Jorda; planeten fyller bakgrunnen.
   - OrbitControls target settes til planetens sentrum.
   - Brukeren zoomer ut og ser Jorda krympe mot planeten.
4. Tilbake-knapp (øverst til venstre) gjenoppretter normal visning.

---

## Størrelsesforhold

Jorda-sfæren i scenen er r = 100 world units. Planetradier skaleres etter faktiske forholdstall:

| Planet  | Ratio vs Jorda | Radius (world units) | Farge      |
|---------|---------------|----------------------|------------|
| Merkur  | 0.38×         | 38                   | `#aaaaaa`  |
| Venus   | 0.95×         | 95                   | `#e8d08c`  |
| Mars    | 0.53×         | 53                   | `#c1440e`  |
| Jupiter | 11.2×         | 1 120                | `#c88b3a`  |
| Saturn  | 9.45×         | 945                  | `#e8d87c`  |
| Uranus  | 4.0×          | 400                  | `#7de8e8`  |
| Neptun  | 3.9×          | 390                  | `#4060ff`  |

Saturn får ringer (RingGeometry, samme proporsjoner som eksisterende).

---

## Kameraposisjonering

Ved aktivering:
- `planet.position.set(0, 0, -(planetR * 1.05 + 100))` — planet bak Jorda med liten margin
- `camera.position.set(0, 0, 300)` — starter tett på Jorda
- `controls.target.set(0, 0, -(planetR * 1.05 + 100))` — orbit rundt planetsentrum
- `controls.minDistance = 50`, `controls.maxDistance = planetR * 8` — lar brukeren zoome fra tett på Jorda til full oversikt

---

## Komponenter

### `js/planet-compare.js` (ny)

Eksporterer:
- `initPlanetCompare(scene, camera, controls)` — registrerer scene-referanser, oppretter planet-mesher lazy (ved første aktivering)
- `enterPlanetCompare(planetName)` — aktiverer modus for valgt planet
- `exitPlanetCompare()` — gjenoppretter normal visning
- `isPlanetCompareActive()` → boolean

Internt:
- Én `THREE.Group` (`_compareGroup`) som legges til scenen ved init og skjules/vises.
- Planet-mesher opprettes én gang per planet og gjenbrukes.
- Lagrer og gjenoppretter `controls.target`, `controls.minDistance`, `controls.maxDistance`, og kameraposisjon ved exit.

### Planet-panel (HTML/CSS, dynamisk opprettet i `planet-compare.js`)

- `<div id="planet-panel">` plasseres nederst på skjermen, `position: fixed; bottom: 1rem`.
- Én `<button>` per planet: rund fargerik sirkel (56×56 px) + planetnavn under.
- Synlig kun når 🪐-toggle er på.
- På mobil: horisontal scrollbar hvis nødvendig (`overflow-x: auto; display: flex`).
- Tilbake-knapp: `<button id="planet-compare-back">` vises øverst til venstre i sammenlignings-modus.

### Endringer i eksisterende filer

| Fil | Endring |
|-----|---------|
| `js/controls.js` | Ved 🪐-toggle on/off: kall `showPlanetPanel(true/false)` |
| `js/app.js` | `import { initPlanetCompare } from './planet-compare.js'` + kall ved oppstart |
| `index.html` | Ingen — panelet opprettes dynamisk av `planet-compare.js` |

---

## Hva som skjules/vises i sammenlignings-modus

Skjules:
- Atmosfære-mesh
- Sol-systemets planeter og banelinjer (eksisterende `_group` fra `solar-system.js`)
- Stjernefelt (stars)
- Alle toggle-kontrollerte lag (borders, labels, capitals osv.) — via `setVisible(false)` på eksisterende eksporter

Vises:
- `_compareGroup` (valgt planet + Jorda-sfæren som allerede er i scenen)
- Tilbake-knapp

Jorda-terreng-sfæren **beholdes synlig** — brukeren ser sin vanlige jordklode foran planeten.

---

## Kanttilfeller

- **Merkur/Venus/Mars** er mindre enn Jorda → planet vises bak Jorda som en liten sirkel. Fortsatt informativt.
- **Saturn-ringer** roteres `Math.PI * 0.42` på X-aksen (samme som eksisterende).
- **Toggle av 🪐 mens sammenlignings-modus er aktiv**: kall `exitPlanetCompare()` automatisk og skjul panelet.
- **Vindusstørrelse endres**: panelet er CSS `fixed` og skalerer naturlig.

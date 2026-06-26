import { initScene, startLoop, resetCamera, getCompassAngle, getCamera, getControls, getCanvas, setSunEnabled, setMoonTempEnabled, setMoonOpacity, setApolloVisible } from './globe.js'
import { initAtmosphere } from './atmosphere.js'
import { initTerrain, setSeaLevel, setOpacity } from './terrain.js'
import { setGravity, setWindDirection } from './particles.js'
import { initControls } from './controls.js'
import { initBorders, setBordersVisible } from './borders.js'
import { initUsStates } from './us-states.js'
import { initEarthquakes, setEarthquakesVisible, updateEarthquakes } from './earthquakes.js'
import { initLabels, setLabelsVisible } from './labels.js'
import { initDragger, setDragMode } from './dragger.js'
import { initLatLines, setEquatorVisible } from './latlines.js'
import { initCapitals, setCapitalsVisible } from './capitals.js'
import { initWeatherClick, setWeatherClickEnabled } from './yr-weather.js'
import { initStars } from './stars.js'
import { initSolarSystem, setSolarSystemVisible, updatePlanetScales } from './solar-system.js'

function main() {
  const container = document.getElementById('canvas-container')
  const { scene } = initScene(container)

  initStars(scene)
  initAtmosphere(scene)
  initTerrain(scene)
initBorders(scene)
  initUsStates(scene)
  initEarthquakes(scene)
  initLabels(scene)
  initDragger(scene, getCamera(), getControls(), getCanvas())
  initLatLines(scene)
  initCapitals(scene, getCamera(), getCanvas())
  initWeatherClick(getCamera(), getCanvas())
  initSolarSystem(scene)

  const needle = document.getElementById('compass-needle')

  initControls({
    onOpacity: v => { setOpacity(v); setMoonOpacity(v) },
    onBorders: setBordersVisible,
    onLabels: setLabelsVisible,
    onDragMode: setDragMode,
    onEquator: setEquatorVisible,
    onCapitals: v => { setCapitalsVisible(v); setApolloVisible(v) },
    onSolarSystem: setSolarSystemVisible,
    onSun: setSunEnabled,
    onWeatherClick: v => { setWeatherClickEnabled(v); setMoonTempEnabled(v) },
    onEarthquakes: setEarthquakesVisible,
    onReset: resetCamera,
  })

  startLoop(delta => {
    needle.style.transform = `rotate(${getCompassAngle()}deg)`
    updatePlanetScales(getCamera())
    updateEarthquakes(delta)
  })
}

main()

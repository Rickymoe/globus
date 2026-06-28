import { initScene, startLoop, resetCamera, getCompassAngle, getCamera, getControls, getCanvas, setSunEnabled, setMoonTempEnabled, setMoonOpacity, setApolloVisible, getSunDirection } from './globe.js'
import { initAtmosphere, updateAtmosphere, setSunOnAtmosphere } from './atmosphere.js'
import { initTerrain, setSeaLevel, setOpacity, updateAtmGlow } from './terrain.js'
import { setGravity, setWindDirection } from './particles.js'
import { initControls } from './controls.js'
import { initBorders, setBordersVisible } from './borders.js'
import { initUsStates, setUsStatesVisible } from './us-states.js'
import { initEarthquakes, setEarthquakesVisible, updateEarthquakes } from './earthquakes.js'
import { initIss, setIssVisible } from './iss.js'
import { initTectonic, setTectonicVisible } from './tectonic.js'
import { initCityLights, setCityLightsVisible, updateCityLights } from './citylights.js'
import { initAurora, setAuroraVisible, updateAurora } from './aurora.js'
import { initTimezones, setTimezonesVisible } from './timezones.js'
import { initMagnetField, setMagnetFieldVisible, updateMagnetField } from './magnetfield.js'
import { initLabels, setLabelsVisible } from './labels.js'
import { initDragger, setDragMode } from './dragger.js'
import { initLatLines, setEquatorVisible } from './latlines.js'
import { initCapitals, setCapitalsVisible } from './capitals.js'
import { initWeatherClick, setWeatherClickEnabled } from './yr-weather.js'
import { initCountryInfo, setCountryInfoEnabled } from './countryinfo.js'
import { initCarousel } from './carousel.js'
import { initCenterEye, updateCenterEye } from './center-eye.js'
import { initStars } from './stars.js'
import { initSolarSystem, setSolarSystemVisible, updatePlanetScales } from './solar-system.js'
import { initPlanetCompare, showPlanetPanel, exitPlanetCompare } from './planet-compare.js'
import { initEonet, setEonetVisible, updateEonet } from './eonet.js'

function main() {
  const container = document.getElementById('canvas-container')
  const { scene } = initScene(container)

  initStars(scene)
  initAtmosphere(scene)
  initTerrain(scene)
initBorders(scene)
  initUsStates(scene)
  initEarthquakes(scene, getCamera(), getCanvas())
  initIss(scene)
  initTectonic(scene)
  initCityLights(scene)
  initAurora(scene)
  initMagnetField(scene)
  initTimezones(scene)
  initLabels(scene)
  initDragger(scene, getCamera(), getControls(), getCanvas())
  initLatLines(scene)
  initCapitals(scene, getCamera(), getCanvas())
  initWeatherClick(getCamera(), getCanvas())
  initCountryInfo(getCamera(), getCanvas())
  initCenterEye(getCamera(), getControls())
  initSolarSystem(scene)
  initPlanetCompare(scene, getCamera(), getControls())
  initEonet(scene, getCamera(), getCanvas())

  const needle = document.getElementById('compass-needle')

  initCarousel()
  initControls({
    onOpacity: v => { setOpacity(v); setMoonOpacity(v) },
    onBorders: v => { setBordersVisible(v); setUsStatesVisible(v) },
    onLabels: setLabelsVisible,
    onDragMode: setDragMode,
    onEquator: setEquatorVisible,
    onCapitals: v => { setCapitalsVisible(v); setApolloVisible(v) },
    onSolarSystem: v => {
      if (!v) exitPlanetCompare()
      setSolarSystemVisible(v)
      showPlanetPanel(v)
    },
    onSun: v => { setSunEnabled(v); setSunOnAtmosphere(v) },
    onCityLights: setCityLightsVisible,
    onAurora: v => { setAuroraVisible(v); setMagnetFieldVisible(v) },
    onWeatherClick: v => { setWeatherClickEnabled(v); setMoonTempEnabled(v) },
    onEarthquakes: v => { setEarthquakesVisible(v); setEonetVisible(v) },
    onIss: setIssVisible,
    onTectonic: setTectonicVisible,
    onCountryInfo: setCountryInfoEnabled,
    onTimezones: setTimezonesVisible,
    onReset: resetCamera,
  })

  startLoop(delta => {
    needle.style.transform = `rotate(${getCompassAngle()}deg)`
    updatePlanetScales(getCamera())
    updateEarthquakes(delta)
    updateCityLights(getSunDirection())
    const camDist = getCamera().position.length()
    updateAtmosphere(getSunDirection(), camDist)
    updateAtmGlow(camDist)
    updateAurora(delta)
    updateMagnetField(delta)
    updateEonet(delta)
    updateCenterEye(delta)
  })
}

main()

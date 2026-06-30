import { initScene, startLoop, resetCamera, getCompassAngle, getCamera, getControls, getCanvas, getRenderer, setSunEnabled, setMoonTempEnabled, setMoonOpacity, setApolloVisible, getSunDirection } from './globe.js'
import { initUiTooltip } from './ui-tooltip.js'
import { initFullscreenButton } from './fullscreen-button.js'
import { initVRControls, updateVRControls } from './vr-controls.js'
import { initAtmosphere, updateAtmosphere, setSunOnAtmosphere } from './atmosphere.js'
import { initTerrain, setSeaLevel, setOpacity, updateAtmGlow } from './terrain.js'
import { setGravity, setWindDirection } from './particles.js'
import { initControls } from './controls.js'
import { initBorders, setBordersVisible } from './borders.js'
import { initAdmin1, setAdmin1Visible } from './admin1.js'
import { initEarthquakes, setEarthquakesVisible, updateEarthquakes } from './earthquakes.js'
import { initIss, setIssVisible, updateIss } from './iss.js'
import { initTectonic, setTectonicVisible } from './tectonic.js'
import { initCityLights, setCityLightsVisible, updateCityLights } from './citylights.js'
import { initAurora, setAuroraVisible, updateAurora, setAuroraActivity } from './aurora.js'
import { initDonki, getAuroraActivity } from './donki.js'
import { initTimezones, setTimezonesVisible } from './timezones.js'
import { initMagnetField, setMagnetFieldVisible, updateMagnetField } from './magnetfield.js'
import { initLabels, setLabelsVisible } from './labels.js'
import { initDragger, setDragMode } from './dragger.js'
import { initLatLines, setEquatorVisible } from './latlines.js'
import { initCapitals, setCapitalsVisible } from './capitals.js'
import { initWeatherClick, setWeatherClickEnabled } from './yr-weather.js'
import { initCountryInfo, setCountryInfoEnabled } from './countryinfo.js'
import { initCenterEye, updateCenterEye } from './center-eye.js'
import { initStars } from './stars.js'
import { initSolarSystem, setSolarSystemVisible, updatePlanetScales } from './solar-system.js'
import { initPlanetCompare, showPlanetPanel, exitPlanetCompare } from './planet-compare.js'
import { initEonet, setEonetVisible, updateEonet } from './eonet.js'
import { initSatellites, setSatellitesVisible, updateSatellites } from './satellites.js'
import { initCurrents, setCurrentsVisible, updateCurrents } from './currents.js'
import { initShips, setShipsVisible, updateShips } from './ships.js'
import { initMeteors, setMeteorsVisible, updateMeteors } from './meteors.js'
import { initOceanLabels, setOceanLabelsVisible, updateOceanLabels } from './ocean-labels.js'
import { initApiStatus } from './api-status.js'

function main() {
  const container = document.getElementById('canvas-container')
  initUiTooltip()
  initFullscreenButton()
  const { scene } = initScene(container)

  initStars(scene)
  initAtmosphere(scene)
  initTerrain(scene)
initBorders(scene)
  initAdmin1(scene)
  initEarthquakes(scene, getCamera(), getCanvas())
  initIss(scene, getCamera(), getCanvas())
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
  initDonki().then(() => setAuroraActivity(getAuroraActivity()))
  initApiStatus()
  initSolarSystem(scene)
  initPlanetCompare(scene, getCamera(), getControls())
  initEonet(scene, getCamera(), getCanvas())
  initSatellites(scene, getCamera(), getCanvas())
  initCurrents(scene, getCamera(), getCanvas())
  initShips(scene, getCamera(), getCanvas())
  initMeteors(scene)
  initOceanLabels(scene)
  initVRControls(getRenderer(), getCamera())

  const needle = document.getElementById('compass-needle')

  initControls({
    onOpacity: v => { setOpacity(v); setMoonOpacity(v) },
    onBorders: v => { setBordersVisible(v); setAdmin1Visible(v) },
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
    onSatellites: setSatellitesVisible,
    onIss: setIssVisible,
    onTectonic: setTectonicVisible,
    onCountryInfo: setCountryInfoEnabled,
    onTimezones: setTimezonesVisible,
    onCurrents: v => { setCurrentsVisible(v); setOceanLabelsVisible(v) },
    onShips: setShipsVisible,
    onMeteors: setMeteorsVisible,
    onReset: resetCamera,
  })

  startLoop(delta => {
    updateVRControls(delta)
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
    updateSatellites(delta)
    updateIss(delta)
    updateCurrents(delta)
    updateShips(delta)
    updateMeteors(delta)
    updateOceanLabels(getCamera())
    updateCenterEye(delta)
  })
}

main()

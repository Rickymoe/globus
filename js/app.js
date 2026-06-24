import { initScene, startLoop, resetCamera, getCompassAngle, getCamera, getControls, getCanvas } from './globe.js'
import { initTerrain, setSeaLevel, setOpacity } from './terrain.js'
import { setGravity, setWindDirection } from './particles.js'
import { initControls } from './controls.js'
import { initBorders, setBordersVisible } from './borders.js'
import { initLabels, setLabelsVisible } from './labels.js'
import { initDragger, setDragMode } from './dragger.js'
import { initLatLines, setEquatorVisible } from './latlines.js'
import { initCapitals, setCapitalsVisible } from './capitals.js'
import { initWeatherClick, setWeatherClickEnabled } from './yr-weather.js'

function main() {
  const container = document.getElementById('canvas-container')
  const { scene } = initScene(container)

  initTerrain(scene)
initBorders(scene)
  initLabels(scene)
  initDragger(scene, getCamera(), getControls(), getCanvas())
  initLatLines(scene)
  initCapitals(scene, getCamera(), getCanvas())
  initWeatherClick(getCamera(), getCanvas())

  const needle = document.getElementById('compass-needle')

  initControls({
    onOpacity: setOpacity,
    onBorders: setBordersVisible,
    onLabels: setLabelsVisible,
    onDragMode: setDragMode,
    onEquator: setEquatorVisible,
    onCapitals: setCapitalsVisible,
    onWeatherClick: setWeatherClickEnabled,
    onReset: resetCamera,
  })

  startLoop(() => {
    needle.style.transform = `rotate(${getCompassAngle()}deg)`
  })
}

main()

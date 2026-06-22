import { initScene, startLoop } from './globe.js'
import { initTerrain, setSeaLevel, setOpacity } from './terrain.js'
import { initWeather, fetchCloudTiles, setWeatherVisible } from './weather.js'
import { setGravity, setWindDirection } from './particles.js'
import { initControls } from './controls.js'

function main() {
  const container = document.getElementById('canvas-container')
  const { scene } = initScene(container)

  initTerrain(scene)
  initWeather(scene)

  initControls({
    onSeaLevel: setSeaLevel,
    onOpacity: setOpacity,
    onWeatherToggle: setWeatherVisible,
    onWeatherRefresh: () => {
      const key = document.getElementById('owm-api-key').value.trim()
      if (key) fetchCloudTiles(key)
    },
    onGravity: setGravity,
    onWind: setWindDirection,
  })

  startLoop(() => {})
}

main()

const WIND_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']

export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind }) {
  const seaSlider      = document.getElementById('sea-level')
  const gravSlider     = document.getElementById('gravity')
  const windSlider     = document.getElementById('wind-direction')
  const windArrow      = document.getElementById('wind-arrow')
  const chkTransparent = document.getElementById('toggle-transparent')
  const chkClouds      = document.getElementById('toggle-clouds')
  const btnRefresh     = document.getElementById('btn-refresh-weather')

  seaSlider.addEventListener('input', () => onSeaLevel(Number(seaSlider.value)))
  gravSlider.addEventListener('input', () => onGravity(Number(gravSlider.value)))

  windSlider.addEventListener('input', () => {
    const deg = Number(windSlider.value)
    onWind(deg)
    windArrow.textContent = WIND_ARROWS[Math.round(deg / 45) % 8]
  })

  chkTransparent.addEventListener('change', () => onOpacity(chkTransparent.checked))
  chkClouds.addEventListener('change', () => onWeatherToggle(chkClouds.checked))
  btnRefresh.addEventListener('click', onWeatherRefresh)

  // fire initial values so modules sync with default slider positions
  onSeaLevel(Number(seaSlider.value))
  onGravity(Number(gravSlider.value))
  onWind(Number(windSlider.value))
  onOpacity(chkTransparent.checked)
}

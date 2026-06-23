const WIND_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']

export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind, onReset }) {
  const chkTransparent = document.getElementById('toggle-transparent')
  const chkClouds      = document.getElementById('toggle-clouds')
  const btnRefresh     = document.getElementById('btn-refresh-weather')

  chkTransparent.addEventListener('change', () => onOpacity(chkTransparent.checked))
  chkClouds.addEventListener('change', () => onWeatherToggle(chkClouds.checked))
  btnRefresh.addEventListener('click', onWeatherRefresh)
  document.getElementById('compass')?.addEventListener('click', onReset)

  onOpacity(chkTransparent.checked)
  onWeatherToggle(chkClouds.checked)
}

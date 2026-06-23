export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind, onReset }) {
  const transparentToggle = document.getElementById('transparent-toggle')
  const chkClouds         = document.getElementById('toggle-clouds')
  const btnRefresh        = document.getElementById('btn-refresh-weather')

  transparentToggle.addEventListener('click', () => {
    transparentToggle.classList.toggle('active')
    onOpacity(transparentToggle.classList.contains('active'))
  })

  chkClouds.addEventListener('change', () => onWeatherToggle(chkClouds.checked))
  btnRefresh.addEventListener('click', onWeatherRefresh)
  document.getElementById('compass')?.addEventListener('click', onReset)

  onOpacity(false)
  onWeatherToggle(chkClouds.checked)
}

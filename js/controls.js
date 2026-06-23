export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind, onBorders, onReset }) {
  const transparentToggle = document.getElementById('transparent-toggle')
  const bordersToggle     = document.getElementById('borders-toggle')
  const chkClouds         = document.getElementById('toggle-clouds')
  const btnRefresh        = document.getElementById('btn-refresh-weather')

  transparentToggle.addEventListener('click', () => {
    transparentToggle.classList.toggle('active')
    onOpacity(transparentToggle.classList.contains('active'))
  })

  bordersToggle.addEventListener('click', () => {
    bordersToggle.classList.toggle('active')
    onBorders(bordersToggle.classList.contains('active'))
  })

  chkClouds.addEventListener('change', () => onWeatherToggle(chkClouds.checked))
  btnRefresh.addEventListener('click', onWeatherRefresh)
  document.getElementById('compass')?.addEventListener('click', onReset)

  onOpacity(false)
  onBorders(bordersToggle.classList.contains('active'))
  onWeatherToggle(chkClouds.checked)
}

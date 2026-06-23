function makeToggle(id, onChange) {
  const el = document.getElementById(id)
  el.addEventListener('click', () => {
    el.classList.toggle('active')
    onChange(el.classList.contains('active'))
  })
  return el
}

export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind, onBorders, onReset }) {
  const cloudsToggle      = makeToggle('clouds-toggle',      onWeatherToggle)
  const bordersToggle     = makeToggle('borders-toggle',     onBorders)
  const transparentToggle = makeToggle('transparent-toggle', onOpacity)

  document.getElementById('compass')?.addEventListener('click', onReset)

  onWeatherToggle(cloudsToggle.classList.contains('active'))
  onBorders(bordersToggle.classList.contains('active'))
  onOpacity(transparentToggle.classList.contains('active'))
}

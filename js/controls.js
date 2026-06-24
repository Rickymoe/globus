function makeToggle(id, onChange) {
  const el = document.getElementById(id)
  el.addEventListener('click', () => {
    el.classList.toggle('active')
    onChange(el.classList.contains('active'))
  })
  return el
}

export function initControls({ onSeaLevel, onOpacity, onWeatherToggle, onWeatherRefresh, onGravity, onWind, onBorders, onLabels, onDragMode, onEquator, onReset }) {
  const dragToggle        = makeToggle('drag-toggle',        onDragMode)
  const labelsToggle      = makeToggle('labels-toggle',      onLabels)
  const cloudsToggle      = makeToggle('clouds-toggle',      onWeatherToggle)
  const bordersToggle     = makeToggle('borders-toggle',     onBorders)
  const transparentToggle = makeToggle('transparent-toggle', onOpacity)
  const equatorToggle     = makeToggle('equator-toggle',     onEquator)

  document.getElementById('compass')?.addEventListener('click', onReset)

  onDragMode(dragToggle.classList.contains('active'))
  onLabels(labelsToggle.classList.contains('active'))
  onWeatherToggle(cloudsToggle.classList.contains('active'))
  onBorders(bordersToggle.classList.contains('active'))
  onOpacity(transparentToggle.classList.contains('active'))
  onEquator(equatorToggle.classList.contains('active'))
}

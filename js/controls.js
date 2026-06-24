function makeToggle(id, onChange) {
  const el = document.getElementById(id)
  el.addEventListener('click', () => {
    el.classList.toggle('active')
    onChange(el.classList.contains('active'))
  })
  return el
}

export function initControls({ onOpacity, onBorders, onLabels, onDragMode, onEquator, onCapitals, onWeatherClick, onReset }) {
  const dragToggle        = makeToggle('drag-toggle',        onDragMode)
  const labelsToggle      = makeToggle('labels-toggle',      onLabels)
  const bordersToggle     = makeToggle('borders-toggle',     onBorders)
  const transparentToggle = makeToggle('transparent-toggle', onOpacity)
  const equatorToggle     = makeToggle('equator-toggle',     onEquator)
  const capitalsToggle    = makeToggle('capitals-toggle',    onCapitals)
  const weatherToggle     = makeToggle('weather-toggle',     onWeatherClick)

  document.getElementById('compass')?.addEventListener('click', onReset)

  onDragMode(dragToggle.classList.contains('active'))
  onLabels(labelsToggle.classList.contains('active'))
  onBorders(bordersToggle.classList.contains('active'))
  onOpacity(transparentToggle.classList.contains('active'))
  onEquator(equatorToggle.classList.contains('active'))
  onCapitals(capitalsToggle.classList.contains('active'))
  onWeatherClick(weatherToggle.classList.contains('active'))
}

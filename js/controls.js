function makeToggle(id, onChange) {
  const el = document.getElementById(id)
  el.addEventListener('click', () => {
    el.classList.toggle('active')
    onChange(el.classList.contains('active'))
  })
  return el
}

export function initControls({ onOpacity, onBorders, onLabels, onDragMode, onEquator, onCapitals, onSolarSystem, onSun, onWeatherClick, onEarthquakes, onReset }) {
  const dragToggle        = makeToggle('drag-toggle',        onDragMode)
  const labelsToggle      = makeToggle('labels-toggle',      onLabels)
  const bordersToggle     = makeToggle('borders-toggle',     onBorders)
  const transparentToggle = makeToggle('transparent-toggle', onOpacity)
  const equatorToggle     = makeToggle('equator-toggle',     onEquator)
  const capitalsToggle    = makeToggle('capitals-toggle',    onCapitals)
  const solarToggle       = makeToggle('solar-toggle',       onSolarSystem)
  const sunToggle         = makeToggle('sun-toggle',         onSun)
  const weatherToggle     = makeToggle('weather-toggle',     onWeatherClick)
  const earthquakesToggle = makeToggle('earthquakes-toggle', onEarthquakes)

  document.getElementById('compass')?.addEventListener('click', onReset)

  onDragMode(dragToggle.classList.contains('active'))
  onLabels(labelsToggle.classList.contains('active'))
  onBorders(bordersToggle.classList.contains('active'))
  onOpacity(transparentToggle.classList.contains('active'))
  onEquator(equatorToggle.classList.contains('active'))
  onCapitals(capitalsToggle.classList.contains('active'))
  onSolarSystem(solarToggle.classList.contains('active'))
  onSun(sunToggle.classList.contains('active'))
  onWeatherClick(weatherToggle.classList.contains('active'))
  onEarthquakes(earthquakesToggle.classList.contains('active'))
}

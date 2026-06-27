let _offset = 0
let _pillH = null

function getPillH() {
  if (_pillH !== null) return _pillH
  const first = document.querySelector('#toggle-stack .float-toggle')
  if (!first) return 52
  _pillH = first.getBoundingClientRect().height + 10
  return _pillH
}

function getTotal() {
  return document.querySelectorAll('#toggle-stack .float-toggle').length
}

function getMaxOffset() {
  const visible = Math.floor(
    document.getElementById('carousel-viewport').offsetHeight / getPillH()
  )
  return Math.max(0, getTotal() - visible)
}

function applyOffset(n) {
  _offset = Math.max(0, Math.min(n, getMaxOffset()))
  document.getElementById('toggle-stack').style.transform =
    `translateY(-${_offset * getPillH()}px)`
  const max = getMaxOffset()
  document.getElementById('carousel-prev').disabled = _offset <= 0
  document.getElementById('carousel-next').disabled = _offset >= max
}

export function initCarousel() {
  document.getElementById('carousel-prev')
    .addEventListener('click', () => applyOffset(_offset - 1))
  document.getElementById('carousel-next')
    .addEventListener('click', () => applyOffset(_offset + 1))

  document.getElementById('carousel-wrap')
    .addEventListener('wheel', e => {
      e.preventDefault()
      applyOffset(_offset + (e.deltaY > 0 ? 1 : -1))
    }, { passive: false })

  window.addEventListener('resize', () => {
    _pillH = null
    applyOffset(_offset)
  })

  applyOffset(0)
}

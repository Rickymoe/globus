const TOOLTIP_STYLE = [
  'position:fixed',
  'background:rgba(0,0,0,0.72)',
  'color:#fff',
  'padding:4px 10px',
  'border-radius:999px',
  'font-size:13px',
  'pointer-events:none',
  'white-space:nowrap',
  'display:none',
  'font-family:system-ui,sans-serif',
  'border:1px solid rgba(255,255,255,0.2)',
  'z-index:300',
].join(';')

let _tooltip = null

function showTooltip(target, text) {
  _tooltip.textContent = text
  _tooltip.style.display = 'block'

  const rect = target.getBoundingClientRect()
  const left = rect.left - _tooltip.offsetWidth - 10
  const top  = rect.top + rect.height / 2 - _tooltip.offsetHeight / 2
  _tooltip.style.left = Math.max(left, 4) + 'px'
  _tooltip.style.top  = Math.max(top, 4) + 'px'
}

function hideTooltip() {
  _tooltip.style.display = 'none'
}

export function initUiTooltip() {
  _tooltip = document.createElement('div')
  _tooltip.style.cssText = TOOLTIP_STYLE
  document.body.appendChild(_tooltip)

  const targets = document.querySelectorAll('#toggle-groups [title], #compass[title]')
  targets.forEach(el => {
    const text = el.getAttribute('title')
    el.removeAttribute('title')
    el.addEventListener('pointerenter', () => showTooltip(el, text))
    el.addEventListener('pointerleave', hideTooltip)
  })
}

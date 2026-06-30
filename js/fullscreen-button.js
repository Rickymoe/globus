const BASE_STYLE = [
  'position:fixed', 'top:3.3rem', 'right:1rem', 'z-index:200',
  'background:rgba(0,0,0,0.7)', 'color:#fff',
  'border:1px solid rgba(255,255,255,0.25)', 'border-radius:0.6rem',
  'padding:0.45rem 1rem', 'font:13px system-ui,sans-serif',
  'backdrop-filter:blur(6px)', 'cursor:pointer', 'transition:background 0.15s',
].join(';')

export function initFullscreenButton() {
  if (!document.documentElement.requestFullscreen) return

  const btn = document.createElement('button')
  btn.textContent = '⛶ Fullscreen'
  btn.style.cssText = BASE_STYLE
  btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.15)' }
  btn.onmouseleave = () => { btn.style.background = 'rgba(0,0,0,0.7)' }
  document.body.appendChild(btn)

  btn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  })

  document.addEventListener('fullscreenchange', () => {
    btn.textContent = document.fullscreenElement ? '⛶ Exit fullscreen' : '⛶ Fullscreen'
  })
}

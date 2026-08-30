import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'

export function TitleBar() {
  const isMac = window.relay.platform === 'darwin'
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false

    void window.relay.invoke('window:isFullscreen').then((fullscreen) => {
      if (!cancelled) {
        setIsFullscreen(fullscreen)
      }
    })

    const unsubscribe = window.relay.on('window:fullscreenChanged', (event) => {
      setIsFullscreen(event.isFullscreen)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const handleDoubleClick = () => {
    void window.relay.invoke('window:toggleMaximize')
  }

  const showTrafficLightPadding = isMac && !isFullscreen

  return (
    <div
      className={cn(
        'titlebar flex h-titlebar shrink-0 items-center justify-between border-b border-divider bg-bg',
        showTrafficLightPadding ? 'pl-titlebar-mac pr-3' : 'px-3'
      )}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-1.5 text-text-secondary">
        <span className="relay-mark size-3.5 shrink-0" aria-hidden />
        <span className="text-xs">Relay</span>
      </div>
      <span
        className="rounded-panel border border-divider px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-tertiary"
        aria-label={`Version ${window.relay.version}`}
      >
        v{window.relay.version}
      </span>
    </div>
  )
}

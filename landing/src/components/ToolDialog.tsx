import { useEffect, useRef } from 'react'
import type { FeatureTool } from '../config'
import { Screenshot } from './Screenshot'
import { WindowChrome } from './WindowChrome'

interface ToolDialogProps {
  tools: readonly FeatureTool[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function TerminalPreview() {
  return (
    <div className="terminal-preview" aria-label="Example SSH terminal session inside Zvia">
      <div>
        <span className="text-[#4a9d5f]">ubuntu@production</span>
        <span className="text-[#f2f2f2]">:</span>
        <span className="text-[#6b8cce]">~</span>
        <span className="text-[#f2f2f2]">$ </span>
        <span>systemctl status nginx</span>
      </div>
      <div className="mt-3">
        <span className="text-[#4a9d5f]">●</span> nginx.service - A high performance web server
      </div>
      <div className="text-[#999999]">     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)</div>
      <div className="text-[#999999]">     Active: active (running) since Mon 2026-08-25 09:14:02 UTC</div>
      <div className="mt-3">
        <span className="text-[#4a9d5f]">ubuntu@production</span>
        <span className="text-[#f2f2f2]">:</span>
        <span className="text-[#6b8cce]">~</span>
        <span className="text-[#f2f2f2]">$ </span>
        <span className="inline-block h-[1.1em] w-2 translate-y-[2px] bg-[#f2f2f2]" aria-hidden />
      </div>
    </div>
  )
}

export function ToolDialog({ tools, index, onClose, onNavigate }: ToolDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const tool = tools[index]
  const count = tools.length

  const goPrev = () => onNavigate((index - 1 + count) % count)
  const goNext = () => onNavigate((index + 1) % count)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [index])

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${tool.label} — Zvia tool`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="dialog-panel"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {tool.screenshot ? (
          <Screenshot
            cover
            title={`production — ${tool.label.toLowerCase()}`}
            src={tool.screenshot}
            alt={`Zvia ${tool.label} panel`}
            onClose={onClose}
          />
        ) : (
          <div className="window-frame">
            <WindowChrome
              title={`production — ${tool.label.toLowerCase()}`}
              onClose={onClose}
            />
            <div className="feature-screenshot-frame">
              <TerminalPreview />
            </div>
          </div>
        )}

        <div className="dialog-meta">
          <p className="dialog-meta-title">
            {tool.label}
            <span className="font-mono text-text-tertiary"> · {tool.command}</span>
          </p>
          <p className="dialog-meta-desc">{tool.description}</p>

          <div className="dialog-meta-nav">
            <button type="button" className="dialog-nav-button" onClick={goPrev} aria-label="Previous tool">
              ←
            </button>
            <span className="dialog-counter" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button type="button" className="dialog-nav-button" onClick={goNext} aria-label="Next tool">
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { SITE } from '../config'

const DOWNLOAD_OPTIONS = [
  { id: 'macos', label: 'macOS', href: SITE.downloadMac },
  { id: 'windows', label: 'Windows', href: SITE.downloadWindows }
] as const

function ChevronIcon() {
  return (
    <svg
      aria-hidden
      className="size-3.5 shrink-0 opacity-70"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface DownloadDropdownProps {
  className?: string
  onSelect?: () => void
}

export function DownloadDropdown({ className = '', onSelect }: DownloadDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    onSelect?.()
  }

  return (
    <div ref={containerRef} className={`download-dropdown ${className}`.trim()}>
      <button
        type="button"
        className="download-dropdown-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        id="download"
        onClick={() => setOpen((value) => !value)}
      >
        Download
        <ChevronIcon />
      </button>

      {open && (
        <div id={menuId} className="download-dropdown-menu" role="menu" aria-label="Download Zvia">
          {DOWNLOAD_OPTIONS.map((option) => (
            <a
              key={option.id}
              href={option.href}
              role="menuitem"
              className="download-dropdown-item"
              onClick={close}
            >
              <span className="download-dropdown-item-label">{option.label}</span>
              <span className="download-dropdown-item-hint">Download</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

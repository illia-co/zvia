import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { WindowChrome } from './WindowChrome'

interface ImageLightboxProps {
  src: string
  alt: string
  title?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, title, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? alt}
      onClick={onClose}
    >
      <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div className="window-frame">
          <WindowChrome title={title} onClose={onClose} />
          <img src={src} alt={alt} className="block h-auto w-full" />
        </div>
      </div>
    </div>,
    document.body
  )
}

import { useState } from 'react'
import { ImageLightbox } from './ImageLightbox'
import { WindowChrome } from './WindowChrome'

interface ScreenshotProps {
  title?: string
  src: string
  alt: string
  cover?: boolean
  fill?: boolean
  eager?: boolean
  caption?: string
  onClose?: () => void
  className?: string
  showExpandHint?: boolean
}

function ExpandHint() {
  return (
    <div className="expand-hint" aria-hidden>
      <svg className="expand-hint-arrow" viewBox="0 0 44 24" fill="none">
        <path
          d="M43 3 C 31 -0.5, 18 2.5, 10 8 C 6.5 10.5, 4 12, 2 14"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M7.5 9 L 2 14 L 8 14"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function Screenshot({
  title,
  src,
  alt,
  cover = false,
  fill = false,
  eager = false,
  caption,
  onClose,
  className = '',
  showExpandHint = false
}: ScreenshotProps) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <div
        className={`window-frame${fill ? ' screenshot-fill' : ''}${className ? ` ${className}` : ''}`}
      >
        {showExpandHint && <ExpandHint />}
        <WindowChrome
          title={title}
          onClose={onClose}
          onMaximize={() => setZoomed(true)}
        />
        {fill ? (
          <div className="screenshot-body">
            <img
              src={src}
              alt={alt}
              className="screenshot-fill-img"
              loading={eager ? 'eager' : 'lazy'}
            />
          </div>
        ) : cover ? (
          <div className="feature-screenshot-frame">
            <img
              src={src}
              alt={alt}
              className="feature-screenshot-image"
              width={1440}
              height={900}
              loading={eager ? 'eager' : 'lazy'}
            />
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className="block w-full"
            width={2880}
            height={1800}
            loading={eager ? 'eager' : 'lazy'}
          />
        )}
        {caption && <div className="screenshot-caption">{caption}</div>}
      </div>
      {zoomed && (
        <ImageLightbox src={src} alt={alt} title={title} onClose={() => setZoomed(false)} />
      )}
    </>
  )
}

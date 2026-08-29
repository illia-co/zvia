import { useCallback, useState, type KeyboardEvent } from 'react'
import { HERO_SCREENSHOTS } from '../config'
import { WindowChrome } from './WindowChrome'

type CardRole = 'front' | 'middle' | 'back' | 'hidden'

function getCardRole(index: number, activeIndex: number, total: number): CardRole {
  const offset = (index - activeIndex + total) % total
  if (offset === 0) return 'front'
  if (offset === 1) return 'middle'
  if (offset === 2) return 'back'
  return 'hidden'
}

export function ScreenshotStack() {
  const [activeIndex, setActiveIndex] = useState(0)
  const total = HERO_SCREENSHOTS.length

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % total) + total) % total)
    },
    [total]
  )

  const goNext = useCallback(() => {
    goTo(activeIndex + 1)
  }, [activeIndex, goTo])

  const goPrev = useCallback(() => {
    goTo(activeIndex - 1)
  }, [activeIndex, goTo])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    },
    [goNext, goPrev]
  )

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="screenshot-stack" aria-live="polite">
        {HERO_SCREENSHOTS.map((screenshot, index) => {
          const role = getCardRole(index, activeIndex, total)
          return (
            <div
              key={screenshot.label}
              className={`screenshot-card screenshot-card--${role}`}
              aria-hidden={role !== 'front'}
            >
              <div className="window-frame">
                <WindowChrome ariaHidden />
                <img
                  src={screenshot.src}
                  alt={screenshot.alt}
                  className="block w-full"
                  width={1440}
                  height={900}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="mt-6 flex items-center justify-center gap-4"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous screenshot"
          className="screenshot-control"
        >
          ←
        </button>

        <div className="screenshot-dots" role="tablist" aria-label="Screenshots">
          {HERO_SCREENSHOTS.map((screenshot, index) => (
            <button
              key={screenshot.label}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Show ${screenshot.label}`}
              title={screenshot.label}
              onClick={() => goTo(index)}
              className={`screenshot-dot${index === activeIndex ? ' screenshot-dot--active' : ''}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Next screenshot"
          className="screenshot-control"
        >
          →
        </button>
      </div>
    </div>
  )
}

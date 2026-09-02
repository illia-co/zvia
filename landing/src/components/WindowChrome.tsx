type WindowChromeProps = {
  title?: string
  onClose?: () => void
  onMaximize?: () => void
  ariaHidden?: boolean
}

export function WindowChrome({ title, onClose, onMaximize, ariaHidden }: WindowChromeProps) {
  return (
    <div className="window-chrome" aria-hidden={ariaHidden}>
      {onClose ? (
        <button
          type="button"
          className="window-dot window-dot--close window-dot--button"
          onClick={onClose}
          aria-label="Close"
        />
      ) : (
        <span className="window-dot window-dot--close" aria-hidden />
      )}
      <span className="window-dot window-dot--minimize" aria-hidden />
      {onMaximize ? (
        <button
          type="button"
          className="window-dot window-dot--maximize window-dot--button"
          onClick={onMaximize}
          aria-label="Open full screen"
        />
      ) : (
        <span className="window-dot window-dot--maximize" aria-hidden />
      )}
      {title ? <span className="window-chrome-title">{title}</span> : null}
    </div>
  )
}

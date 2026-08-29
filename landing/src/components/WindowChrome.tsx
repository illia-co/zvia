type WindowChromeProps = {
  title?: string
  ariaHidden?: boolean
}

export function WindowChrome({ title, ariaHidden }: WindowChromeProps) {
  return (
    <div className="window-chrome" aria-hidden={ariaHidden}>
      <span className="window-dot window-dot--close" aria-hidden />
      <span className="window-dot window-dot--minimize" aria-hidden />
      <span className="window-dot window-dot--maximize" aria-hidden />
      {title ? <span className="window-chrome-title">{title}</span> : null}
    </div>
  )
}

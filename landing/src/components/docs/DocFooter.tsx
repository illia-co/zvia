import { SITE } from '../../config'

const footerLinkClass =
  'text-sm text-text-secondary no-underline transition-colors duration-default hover:text-text'

export function DocFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="doc-footer">
      <div className="flex items-center gap-2 text-sm font-medium text-text">
        <span className="zvia-mark size-3.5" aria-hidden />
        <span>Zvia</span>
      </div>

      <nav className="flex flex-wrap items-center gap-3" aria-label="Footer">
        <a
          href={SITE.github}
          className={footerLinkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span className="text-sm text-text-tertiary" aria-hidden>
          ·
        </span>
        <a href={SITE.downloadMac} className={footerLinkClass}>
          macOS
        </a>
        <span className="text-sm text-text-tertiary" aria-hidden>
          ·
        </span>
        <a href={SITE.downloadWindows} className={footerLinkClass}>
          Windows
        </a>
      </nav>

      <p className="m-0 text-sm text-text-tertiary">© {year} Zvia</p>
    </footer>
  )
}

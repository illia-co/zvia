import { Link } from 'react-router-dom'
import { SITE } from '../config'
import { useDownloadLinks } from '../hooks/useDownloadLinks'

const footerLinkClass =
  'text-sm text-text-secondary no-underline transition-colors duration-default hover:text-text'

export function FooterNav() {
  const downloads = useDownloadLinks()

  return (
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
      <a href={downloads.downloadMac} className={footerLinkClass} rel="noopener noreferrer">
        macOS
      </a>
      <span className="text-sm text-text-tertiary" aria-hidden>
        ·
      </span>
      <a href={downloads.downloadWindows} className={footerLinkClass} rel="noopener noreferrer">
        Windows
      </a>
      <span className="text-sm text-text-tertiary" aria-hidden>
        ·
      </span>
      <Link to="/impressum" className={footerLinkClass}>
        Legal Notice
      </Link>
      <span className="text-sm text-text-tertiary" aria-hidden>
        ·
      </span>
      <Link to="/datenschutz" className={footerLinkClass}>
        Privacy Policy
      </Link>
    </nav>
  )
}

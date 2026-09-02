import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DownloadDropdown } from './DownloadDropdown'

const HOME_SECTION_LINKS = [
  { hash: '#deployments', label: 'Deployments' },
  { hash: '#trust', label: 'How it connects' },
  { hash: '#features', label: 'Features' },
  { hash: '#compare', label: 'Compare' },
  { hash: '#open-source', label: 'Open Source' }
] as const

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isDocs = location.pathname.startsWith('/documentation')
  const homeBase = import.meta.env.BASE_URL

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const navLinks = [
    ...HOME_SECTION_LINKS.map((link) => ({
      href: `${homeBase}${link.hash}`,
      label: link.label
    })),
    { href: '/documentation', label: 'Documentation', active: isDocs }
  ]

  const closeMenu = () => setMobileOpen(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-divider bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-text no-underline"
            onClick={closeMenu}
          >
            <span className="zvia-mark size-4" aria-hidden />
            Zvia
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {navLinks.map((link) =>
              link.href.startsWith('/documentation') ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm no-underline transition-colors duration-default ${
                    'active' in link && link.active
                      ? 'text-text'
                      : 'text-text-secondary hover:text-text'
                  }`}
                  aria-current={'active' in link && link.active ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary no-underline transition-colors duration-default hover:text-text"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden md:flex">
            <DownloadDropdown />
          </div>

          <button
            type="button"
            className={`burger${mobileOpen ? ' burger--open' : ''}`}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="burger-line" />
            <span className="burger-line" />
            <span className="burger-line" />
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={`mobile-menu${mobileOpen ? ' mobile-menu--open' : ''}`}
        aria-hidden={!mobileOpen}
      >
        <nav className="mobile-menu-links" aria-label="Mobile">
          {navLinks.map((link) =>
            link.href.startsWith('/documentation') ? (
              <Link
                key={link.href}
                to={link.href}
                className="mobile-menu-link"
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="mobile-menu-link"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="mobile-menu-action">
          <DownloadDropdown onSelect={closeMenu} />
        </div>
      </div>
    </>
  )
}

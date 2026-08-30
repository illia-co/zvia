import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DownloadDropdown } from './DownloadDropdown'

const HOME_NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#ssh', label: 'SSH' },
  { href: '/#open-source', label: 'Open Source' }
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isDocs = location.pathname.startsWith('/documentation')

  const navLinks = [
    ...HOME_NAV_LINKS,
    { href: '/documentation', label: 'Documentation', active: isDocs }
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-divider bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium text-text no-underline">
          <span className="zvia-mark size-4" aria-hidden />
          Zvia
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {navLinks.map((link) => (
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
          ))}
        </nav>

        <div className="hidden md:flex">
          <DownloadDropdown />
        </div>

        <button
          type="button"
          className="flex flex-col gap-1.5 p-2 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="block h-0.5 w-5 bg-text" />
          <span className="block h-0.5 w-5 bg-text" />
          <span className="block h-0.5 w-5 bg-text" />
        </button>
      </div>

      {mobileOpen && (
        <nav
          className="border-t border-divider px-6 py-4 md:hidden"
          aria-label="Mobile"
        >
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/documentation') ? (
                  <Link
                    to={link.href}
                    className={`block text-sm no-underline ${
                      'active' in link && link.active
                        ? 'text-text'
                        : 'text-text-secondary'
                    }`}
                    onClick={() => setMobileOpen(false)}
                    aria-current={'active' in link && link.active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    className="block text-sm text-text-secondary no-underline"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
            <li className="pt-2">
              <DownloadDropdown className="w-full" onSelect={() => setMobileOpen(false)} />
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}

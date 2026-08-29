import { DOC_NAV } from '../../docs/content'

const linkClass =
  'rounded-panel px-2.5 py-1.5 text-sm text-text-secondary no-underline transition-colors duration-default hover:bg-bg-secondary hover:text-text'

export function DocMobileNav() {
  return (
    <nav className="doc-mobile-nav" aria-label="Documentation sections">
      {DOC_NAV.map((group) => (
        <div key={group.label} className="doc-mobile-nav-group">
          <p className="doc-mobile-nav-label">{group.label}</p>
          <div className="doc-mobile-nav-links">
            {group.items.map((item) => (
              <a key={item.id} href={`#${item.id}`} className={linkClass}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

import { DOC_NAV } from '../../docs/content'

const linkClass =
  'block rounded-panel px-2 py-1 text-sm text-text-secondary no-underline transition-colors duration-default hover:bg-bg-secondary hover:text-text'

const activeLinkClass =
  'block rounded-panel bg-bg-secondary px-2 py-1 text-sm text-text no-underline'

interface DocSidebarProps {
  activeId?: string
}

export function DocSidebar({ activeId }: DocSidebarProps) {
  return (
    <nav className="doc-sidebar" aria-label="Documentation">
      {DOC_NAV.map((group) => (
        <div key={group.label} className="doc-sidebar-group">
          <p className="doc-sidebar-label">{group.label}</p>
          <ul className="doc-sidebar-list">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={activeId === item.id ? activeLinkClass : linkClass}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

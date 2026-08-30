import { SITE } from '../config'
import { LinkButton } from './Button'
import { Reveal } from './Reveal'

const footerLinkClass =
  'text-sm text-text-secondary no-underline transition-colors duration-default hover:text-text'

export function SiteClosing() {
  const year = new Date().getFullYear()

  return (
    <section className="border-t border-divider bg-bg-secondary">
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="site-closing-cta">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Get started
            </p>
            <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
              Your server. Your infrastructure.
            </h2>
            <p className="m-0 mt-2 text-text-secondary">
              One workspace.
            </p>
          </div>
          <div className="site-closing-cta-actions">
            <LinkButton href={SITE.downloadMac}>Download for macOS</LinkButton>
            <LinkButton href={SITE.downloadWindows} variant="secondary">
              Download for Windows
            </LinkButton>
          </div>
        </Reveal>

        <footer className="site-closing-footer">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <span className="zvia-mark size-3.5" aria-hidden />
              <span>Zvia</span>
            </div>
          </div>

          <nav
            className="flex items-center gap-3 md:justify-center"
            aria-label="Footer"
          >
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

          <p className="m-0 text-sm text-text-tertiary md:text-right">
            © {year} Zvia
          </p>
        </footer>
      </div>
    </section>
  )
}

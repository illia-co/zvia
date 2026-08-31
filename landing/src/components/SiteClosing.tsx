import { useDownloadLinks } from '../hooks/useDownloadLinks'
import { LinkButton } from './Button'
import { FooterNav } from './FooterNav'
import { Reveal } from './Reveal'

export function SiteClosing() {
  const downloads = useDownloadLinks()
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
            <LinkButton href={downloads.downloadMac} rel="noopener noreferrer">
              Download for macOS
            </LinkButton>
            <LinkButton href={downloads.downloadWindows} variant="secondary" rel="noopener noreferrer">
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

          <div className="md:justify-center">
            <FooterNav />
          </div>

          <p className="m-0 text-sm text-text-tertiary md:text-right">
            © {year} Zvia
          </p>
        </footer>
      </div>
    </section>
  )
}

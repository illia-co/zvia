import { FooterNav } from './FooterNav'
import { Reveal } from './Reveal'

export function SiteClosing() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-divider bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="site-closing-footer">
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
          </div>
        </Reveal>
      </div>
    </footer>
  )
}

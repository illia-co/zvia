import { FooterNav } from '../FooterNav'

export function DocFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="doc-footer">
      <div className="flex items-center gap-2 text-sm font-medium text-text">
        <span className="zvia-mark size-3.5" aria-hidden />
        <span>Zvia</span>
      </div>

      <FooterNav />

      <p className="m-0 text-sm text-text-tertiary">© {year} Zvia</p>
    </footer>
  )
}

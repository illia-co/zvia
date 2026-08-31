import type { ReactNode } from 'react'
import { DocFooter } from './docs/DocFooter'
import { Header } from './Header'

interface LegalPageProps {
  title: string
  children: ReactNode
}

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <>
      <Header />
      <main id="main" className="doc-page">
        <div className="doc-page-inner legal-page-inner">
          <article className="doc-content">
            <h1 className="doc-title">{title}</h1>
            <div className="doc-prose">{children}</div>
          </article>
        </div>

        <div className="doc-page-footer">
          <DocFooter />
        </div>
      </main>
    </>
  )
}

import { DocFooter } from '../components/docs/DocFooter'
import { DocMobileNav } from '../components/docs/DocMobileNav'
import { DocProse } from '../components/docs/DocProse'
import { DocSidebar } from '../components/docs/DocSidebar'
import { Header } from '../components/Header'
import { DOC_PAGE_META } from '../config'
import { DOC_SECTIONS } from '../docs/content'
import { usePageMeta } from '../hooks/usePageMeta'

export function DocumentationPage() {
  usePageMeta(DOC_PAGE_META.title, DOC_PAGE_META.description)

  return (
    <>
      <Header />
      <main id="main" className="doc-page">
        <div className="doc-page-inner">
          <aside className="doc-aside">
            <DocSidebar />
          </aside>

          <article className="doc-content">
            <h1 className="sr-only">Zvia documentation — Linux server management over SSH</h1>
            <DocMobileNav />
            {DOC_SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="doc-section"
                aria-labelledby={`${section.id}-title`}
              >
                {section.eyebrow && (
                  <p className="doc-eyebrow">{section.eyebrow}</p>
                )}
                <h2 id={`${section.id}-title`} className="doc-title">
                  {section.title}
                </h2>
                <DocProse blocks={section.blocks} />
              </section>
            ))}
          </article>
        </div>

        <div className="doc-page-footer">
          <DocFooter />
        </div>
      </main>
    </>
  )
}

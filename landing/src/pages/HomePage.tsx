import { Comparison } from '../components/Comparison'
import { Differentiator } from '../components/Differentiator'
import { FeatureGrid } from '../components/FeatureGrid'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { OpenSource } from '../components/OpenSource'
import { SeoJsonLd } from '../components/SeoJsonLd'
import { SiteClosing } from '../components/SiteClosing'
import { TrustSection } from '../components/TrustSection'
import { SITE } from '../config'
import { usePageMeta } from '../hooks/usePageMeta'

export function HomePage() {
  usePageMeta(SITE.title, SITE.description)

  return (
    <>
      <SeoJsonLd />
      <Header />
      <main id="main">
        <Hero />
        <Differentiator />
        <TrustSection />
        <FeatureGrid />
        <Comparison />
        <OpenSource />
      </main>
      <SiteClosing />
    </>
  )
}

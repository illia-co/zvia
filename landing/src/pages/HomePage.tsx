import { AuthenticationSection } from '../components/AuthenticationSection'
import { DeploymentsSection } from '../components/DeploymentsSection'
import { SiteClosing } from '../components/SiteClosing'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { OpenSource } from '../components/OpenSource'
import { Problem } from '../components/Problem'
import { RealSSH } from '../components/RealSSH'
import { SeoJsonLd } from '../components/SeoJsonLd'
import { ServerContext } from '../components/ServerContext'
import { TerminalSection } from '../components/TerminalSection'
import { FeatureTabs } from '../components/FeatureTabs'
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
        <DeploymentsSection />
        <Problem />
        <FeatureTabs />
        <ServerContext />
        <RealSSH />
        <AuthenticationSection />
        <TerminalSection />
        <OpenSource />
        <SiteClosing />
      </main>
    </>
  )
}

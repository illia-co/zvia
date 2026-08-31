import { LegalPage } from '../components/LegalPage'
import { IMPRESSUM_PAGE_META, LEGAL, SITE } from '../config'
import { usePageMeta } from '../hooks/usePageMeta'

export function ImpressumPage() {
  usePageMeta(IMPRESSUM_PAGE_META.title, IMPRESSUM_PAGE_META.description)

  return (
    <LegalPage title="Legal Notice">
      <p className="doc-paragraph">
        Legal notice and provider identification for this website ({SITE.canonical}).
      </p>

      <h2 className="doc-subheading">Responsible for content</h2>
      <p className="doc-paragraph">
        {LEGAL.providerName}
        <br />
        {LEGAL.address.street}
        <br />
        {LEGAL.address.postalCode} {LEGAL.address.city}
        <br />
        {LEGAL.address.country}
      </p>

      <h2 className="doc-subheading">Contact</h2>
      {LEGAL.contactEmail ? (
        <p className="doc-paragraph">
          Email:{' '}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-text hover:underline">
            {LEGAL.contactEmail}
          </a>
        </p>
      ) : (
        <p className="doc-paragraph">
          For questions about this website and the project, please use{' '}
          <a
            href={LEGAL.githubContact}
            className="text-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Issues
          </a>{' '}
          in the{' '}
          <a
            href={SITE.github}
            className="text-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {SITE.github.replace('https://github.com/', '')}
          </a>{' '}
          repository.
        </p>
      )}

      <h2 className="doc-subheading">Open-source project</h2>
      <p className="doc-paragraph">
        Zvia is an open-source desktop application. Source code, releases, and documentation
        are provided via GitHub. This website is for project information only.
      </p>

      <h2 className="doc-subheading">Liability for content</h2>
      <p className="doc-paragraph">
        We have made every effort to ensure the accuracy of the content on this website.
        However, we cannot guarantee that the information is complete, correct, or up to date.
        As the service provider, we are responsible for our own content on these pages under
        general law.
      </p>

      <h2 className="doc-subheading">Liability for links</h2>
      <p className="doc-paragraph">
        This website contains links to external third-party websites (for example, GitHub). We
        have no influence over their content. The respective provider or operator is always
        responsible for the content of linked pages.
      </p>

      <h2 className="doc-subheading">Hosting</h2>
      <p className="doc-paragraph">
        This website is hosted on {LEGAL.hosting.provider} ({LEGAL.hosting.website}). For more
        information about privacy with our hosting provider, see the{' '}
        <a href="/datenschutz" className="text-text hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </LegalPage>
  )
}

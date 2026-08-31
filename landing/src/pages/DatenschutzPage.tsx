import { LegalPage } from '../components/LegalPage'
import { DATENSCHUTZ_PAGE_META, LEGAL, SITE } from '../config'
import { usePageMeta } from '../hooks/usePageMeta'

export function DatenschutzPage() {
  usePageMeta(DATENSCHUTZ_PAGE_META.title, DATENSCHUTZ_PAGE_META.description)

  return (
    <LegalPage title="Privacy Policy">
      <p className="doc-paragraph">
        This privacy policy applies to the website at {SITE.canonical} and to general
        information about the open-source Zvia project.
      </p>

      <h2 className="doc-subheading">Data controller</h2>
      <p className="doc-paragraph">
        {LEGAL.providerName}
        <br />
        {LEGAL.address.street}
        <br />
        {LEGAL.address.postalCode} {LEGAL.address.city}
        <br />
        {LEGAL.address.country}
        <br />
        {LEGAL.contactEmail ? (
          <>
            Email:{' '}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-text hover:underline">
              {LEGAL.contactEmail}
            </a>
          </>
        ) : (
          <>
            Contact:{' '}
            <a
              href={LEGAL.githubContact}
              className="text-text hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Issues
            </a>
          </>
        )}
      </p>

      <h2 className="doc-subheading">Website — no tracking</h2>
      <p className="doc-paragraph">
        This website is a static information site. We do not use analytics tools (such as Google
        Analytics or Matomo) and we do not use tracking cookies. There is no embedded user
        tracking and no advertising pixels.
      </p>
      <p className="doc-paragraph">
        Visiting the website does not involve contact forms, and we do not actively collect
        personal data.
      </p>

      <h2 className="doc-subheading">Hosting and server logs</h2>
      <p className="doc-paragraph">
        The website is served via GitHub Pages ({LEGAL.hosting.website}). When you load a page,
        the hosting provider may record technically necessary server logs (for example, IP
        address, time of access, requested URL, browser type). This processing is carried out
        by the hosting provider. For details, see{' '}
        <a
          href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
          className="text-text hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub&apos;s privacy statement
        </a>
        .
      </p>

      <h2 className="doc-subheading">External links and downloads</h2>
      <p className="doc-paragraph">
        The website links to GitHub (source code, issues, releases) and may fetch the latest
        release URLs from the GitHub API when you load the page, so download links stay current.
        If you use those links or downloads, GitHub&apos;s privacy terms (or those of the
        relevant third party) apply.
      </p>

      <h2 className="doc-subheading">Zvia desktop application</h2>
      <p className="doc-paragraph">
        Zvia is a local desktop application (Electron). The app connects directly over SSH to
        servers you configure. There is no telemetry, no analytics, and no central Zvia server
        that receives your server data.
      </p>
      <ul className="doc-list">
        <li>
          SSH credentials and server profiles are stored locally on your device (for example,
          via the operating system credential store).
        </li>
        <li>
          Private SSH keys are not passed to the app&apos;s renderer process and are not sent
          to us.
        </li>
        <li>
          Terminal sessions and file operations run directly between your device and the server
          you choose.
        </li>
        <li>
          The app does not send usage statistics or crash reports to us unless you choose to
          report them via GitHub.
        </li>
      </ul>
      <p className="doc-paragraph">
        For more technical details about the security model, see{' '}
        <a
          href={`${SITE.github}/blob/main/SECURITY.md`}
          className="text-text hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          SECURITY.md
        </a>{' '}
        in the repository.
      </p>

      <h2 className="doc-subheading">Your rights</h2>
      <p className="doc-paragraph">
        Where we process personal data, you may have rights under applicable data protection law
        — including access, correction, deletion, restriction of processing, and objection.
        Contact us using the details above.
      </p>

      <h2 className="doc-subheading">Last updated</h2>
      <p className="doc-paragraph">August 2026</p>
    </LegalPage>
  )
}

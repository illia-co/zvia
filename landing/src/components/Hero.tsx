import { SCREENSHOTS, SITE } from '../config'
import { LinkButton } from './Button'
import { DownloadDropdown } from './DownloadDropdown'
import { Reveal } from './Reveal'
import { Screenshot } from './Screenshot'

function GitHubIcon() {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

const TRUST_MARKS = ['macOS', 'Windows', 'Linux', 'MIT', 'No agent', 'No credentials'] as const

export function Hero() {
  return (
    <section className="hero-section border-b border-divider">
      <div className="hero-grid" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
        <Reveal className="text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-divider bg-bg/70 px-3 py-1 text-xs text-text-secondary">
            <span className="size-1.5 rounded-full bg-status-healthy" aria-hidden />
            Open source · agentless · SSH
          </p>
          <h1 className="m-0 mx-auto max-w-3xl text-4xl font-medium leading-[1.1] tracking-tight text-text md:text-6xl">
            See how your server is actually wired.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Zvia is a native desktop app for Linux servers over plain SSH. It maps every
            application from domain to backend — with the evidence to prove it — and it
            stores nothing: <span className="text-text">no agent on the server</span>,{' '}
            <span className="text-text">no credentials anywhere</span>.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <DownloadDropdown />
            <LinkButton href={SITE.github} variant="secondary" target="_blank" rel="noopener noreferrer" className="gap-2">
              <GitHubIcon />
              View on GitHub
            </LinkButton>
          </div>
          <p className="mt-7 font-mono text-xs text-text-tertiary">
            {TRUST_MARKS.join('  ·  ')}
          </p>
        </Reveal>

        <Reveal className="mt-12 md:mt-16">
          <div className="framed-screenshot mx-auto max-w-5xl">
            <Screenshot
              title="production — deployments"
              src={SCREENSHOTS.topology}
              alt="Zvia deployment topology canvas showing how a production server's applications are wired from domain to backend"
              eager
              showExpandHint
            />
            <div className="framed-screenshot-caption">
              <span className="font-mono text-text-secondary">
                production.example.com
              </span>
              <span className="text-text-tertiary">→</span>
              <span className="font-mono text-text-secondary">nginx</span>
              <span className="text-text-tertiary">→</span>
              <span className="font-mono text-text-secondary">:3000</span>
              <span className="font-mono text-status-healthy">● healthy</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

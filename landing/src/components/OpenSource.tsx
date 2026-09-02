import { SITE } from '../config'
import { LinkButton } from './Button'
import { Reveal } from './Reveal'

function StarIcon() {
  return (
    <svg aria-hidden className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  )
}

export function OpenSource() {
  return (
    <section id="open-source" className="section-with-grid py-16 md:py-24">
      <div className="section-grid-bg" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Open source
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Free forever. Yours to inspect.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-text-secondary">
            Zvia is MIT-licensed. No account, no cloud, no lock-in — read the source,
            report issues, or ship a fix.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton
              href={SITE.github}
              variant="primary"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <StarIcon />
              Star on GitHub
            </LinkButton>
            <LinkButton href={SITE.releases} variant="secondary" rel="noopener noreferrer">
              Install
            </LinkButton>
          </div>

          <p className="mt-8 font-mono text-xs text-text-tertiary">
            MIT · macOS · Windows · Linux
          </p>
        </Reveal>
      </div>
    </section>
  )
}

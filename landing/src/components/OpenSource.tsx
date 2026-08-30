import { SITE } from '../config'
import { LinkButton } from './Button'
import { Reveal } from './Reveal'

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
            Built in the open.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-text-secondary">
            Zvia is an open-source SSH server management tool. Inspect the code,
            report issues, and contribute on GitHub.
          </p>
          <div className="mt-8">
            <LinkButton
              href={SITE.github}
              variant="primary"
              className="gap-2 px-5"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon />
              Zvia
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

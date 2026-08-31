import { useDownloadLinks } from '../hooks/useDownloadLinks'
import { LinkButton } from './Button'
import { Reveal } from './Reveal'
import { ScreenshotStack } from './ScreenshotStack'

export function Hero() {
  const downloads = useDownloadLinks()

  return (
    <section className="hero-section border-b border-divider">
      <div className="hero-grid" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
      <Reveal className="text-center">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Zvia
        </p>
        <h1 className="m-0 mx-auto max-w-3xl text-4xl font-medium leading-tight tracking-tight text-text md:text-5xl">
          See how your applications are wired.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
          Zvia discovers deployment topologies over SSH — nginx, ports, containers,
          and services — then lets you inspect every connection from one calm,
          server-scoped workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href={downloads.downloadMac} rel="noopener noreferrer">
            Download for macOS
          </LinkButton>
          <LinkButton href={downloads.downloadWindows} variant="secondary" rel="noopener noreferrer">
            Download for Windows
          </LinkButton>
        </div>
        <p className="mt-6 text-sm text-text-tertiary">
          Open source · macOS · Windows · Linux · SSH
        </p>
      </Reveal>

      <Reveal className="mt-12 md:mt-16">
        <ScreenshotStack />
      </Reveal>
      </div>
    </section>
  )
}

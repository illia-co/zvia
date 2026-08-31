import { useState } from 'react'
import { DEPLOYMENT_SCREENSHOTS } from '../config'
import { Reveal } from './Reveal'
import { SegmentedControl } from './SegmentedControl'
import { WindowChrome } from './WindowChrome'

const VIEW_OPTIONS = DEPLOYMENT_SCREENSHOTS.map((screenshot) => ({
  id: screenshot.id,
  label: screenshot.label
}))

const DISCOVERY_CHAIN = ['Nginx', 'SSL', 'Ports', 'Services', 'Containers'] as const

export function DeploymentsSection() {
  const [activeView, setActiveView] = useState(DEPLOYMENT_SCREENSHOTS[0].id)
  const screenshot =
    DEPLOYMENT_SCREENSHOTS.find((entry) => entry.id === activeView) ??
    DEPLOYMENT_SCREENSHOTS[0]

  return (
    <section id="deployments" className="border-t border-divider py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Deployments
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            See how each application is wired.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Zvia discovers deployment topologies from nginx, SSL, ports, processes,
            systemd, and Docker — then maps the path from domain to backend on the
            server you selected. No agent, no fleet view.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <div className="chain-diagram rounded-panel border border-divider bg-bg-secondary p-5">
            {DISCOVERY_CHAIN.map((item, index) => (
              <span key={item} className="flex items-center gap-2">
                {index > 0 && <span className="chain-arrow" aria-hidden>→</span>}
                <span className="rounded-sm bg-bg px-2 py-1 text-text">{item}</span>
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-10">
          <SegmentedControl
            options={VIEW_OPTIONS}
            value={activeView}
            onChange={setActiveView}
            ariaLabel="Deployment views"
          />
        </Reveal>

        <Reveal className="mt-8">
          <div key={activeView} role="tabpanel" aria-label={screenshot.label}>
            <div className="section-two-col">
              <div>
                <h3 className="m-0 text-xl font-medium text-text md:text-2xl">
                  {screenshot.headline}
                </h3>
                <p className="mt-3 text-text-secondary">{screenshot.description}</p>
                <ul className="mt-6 space-y-2 text-sm text-text-secondary">
                  {screenshot.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="window-frame">
                <WindowChrome ariaHidden />
                <div className="feature-screenshot-frame">
                  <img
                    src={screenshot.src}
                    alt={screenshot.alt}
                    className="feature-screenshot-image"
                    width={1440}
                    height={900}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

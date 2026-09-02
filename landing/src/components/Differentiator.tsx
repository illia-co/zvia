import type { ReactNode } from 'react'
import { SCREENSHOTS } from '../config'
import { Reveal } from './Reveal'
import { Screenshot } from './Screenshot'

const CONFIDENCE = [
  { style: 'confirmed', label: 'confirmed', hint: 'direct evidence' },
  { style: 'likely', label: 'likely', hint: 'inferred' },
  { style: 'unknown', label: 'unknown', hint: 'best guess' }
] as const

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
      {children}
    </p>
  )
}

function BentoDetailList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="bento-detail-list">
      {items.map((item, index) => (
        <li key={index} className="bento-detail-item">
          <span className="bento-detail-marker" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CollectorChips({ sources }: { sources: string[] }) {
  return (
    <div className="bento-collectors" aria-label="Correlated data sources">
      {sources.map((source) => (
        <span key={source} className="bento-collector-chip">
          {source}
        </span>
      ))}
    </div>
  )
}

function BentoRow({ children }: { children: ReactNode }) {
  return <div className="bento-row">{children}</div>
}

function Figure({
  title,
  src,
  alt,
  caption,
  span
}: {
  title: string
  src: string
  alt: string
  caption: string
  span: 2 | 4
}) {
  return (
    <Screenshot
      fill
      title={title}
      src={src}
      alt={alt}
      caption={caption}
      className={`bento-span-${span}`}
    />
  )
}

export function Differentiator() {
  return (
    <section id="deployments" className="border-b border-divider py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Deployments
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            A topology, not a to-do list.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Other tools show you what&apos;s installed. Zvia shows how it&apos;s
            connected — and why — by reconstructing the wiring of every application on
            the server, then letting you pin a known-good state and diff against it.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <div className="bento-grid">
            <BentoRow>
              <div className="bento-tile bento-span-2">
                <div className="bento-tile-copy">
                  <Eyebrow>Discover</Eyebrow>
                  <h3 className="m-0 text-lg font-medium text-text">
                    What&apos;s running — and how is it wired?
                  </h3>
                  <p className="m-0 mt-3 text-sm leading-relaxed text-text-secondary">
                    One scan correlates nginx, SSL, ports, processes, systemd, and Docker
                    into a per-domain topology.
                  </p>
                </div>
                <div className="bento-tile-footer">
                  <CollectorChips
                    sources={['nginx', 'SSL', 'ports', 'processes', 'systemd', 'Docker']}
                  />
                  <BentoDetailList
                    items={[
                      'One row per domain — shared backends surfaced, never merged',
                      'Solid, dashed, and dotted edges reflect evidence confidence'
                    ]}
                  />
                </div>
              </div>

              <Figure
                span={4}
                title="production — topology"
                src={SCREENSHOTS.topology}
                alt="Zvia deployment topology canvas tracing an application from domain through nginx and a port to its backend"
                caption="The path from domain to backend, drawn out."
              />
            </BentoRow>

            <BentoRow>
              <div className="bento-tile bento-span-2">
                <div className="bento-tile-copy">
                  <Eyebrow>Compare</Eyebrow>
                  <h3 className="m-0 text-lg font-medium text-text">
                    Tag the healthy state. Diff any two points.
                  </h3>
                  <p className="m-0 mt-3 text-sm leading-relaxed text-text-secondary">
                    Pin a snapshot as known-good, then diff any two points in time — always
                    scoped to a single deployment.
                  </p>
                </div>
                <div className="bento-tile-footer">
                  <BentoDetailList
                    items={[
                      <>
                        Tag <span className="font-mono text-text">stable</span>, deploy, then diff.
                      </>,
                      'Drill to the exact before/after of one change.',
                      'Scoped to one deployment — changes on other apps never leak in.'
                    ]}
                  />
                </div>
              </div>

              <Figure
                span={2}
                title="production — snapshots"
                src={SCREENSHOTS.snapshots}
                alt="Zvia snapshot history for a deployment, showing tagged known-good states with per-snapshot change summaries"
                caption="Tagged snapshots with change summaries."
              />

              <Figure
                span={2}
                title="production — diff"
                src={SCREENSHOTS.diff}
                alt="Zvia deployment diff highlighting the exact before and after of a single change"
                caption="The exact before/after of a single change."
              />
            </BentoRow>

            <BentoRow>
              <Figure
                span={4}
                title="production — inspector"
                src={SCREENSHOTS.inspector}
                alt="Zvia deployment inspector showing the evidence behind a single connection"
                caption="Click any edge for the Why? inspector."
              />

              <div className="bento-tile bento-span-2">
                <div className="bento-tile-copy">
                  <Eyebrow>Evidence</Eyebrow>
                  <h3 className="m-0 text-lg font-medium text-text">
                    Why does Zvia think these are connected?
                  </h3>
                  <p className="m-0 mt-3 text-sm leading-relaxed text-text-secondary">
                    Every edge is evidence-backed. Click a connection to see the nginx
                    directive, port binding, or process match behind it.
                  </p>
                </div>
                <div className="bento-tile-footer">
                  <div className="bento-code-snippet" aria-label="Example nginx evidence">
                    <span className="bento-code-snippet-label">nginx directive</span>
                    <code>proxy_pass http://127.0.0.1:3000;</code>
                  </div>
                  <ul className="confidence-legend">
                    {CONFIDENCE.map((entry) => (
                      <li key={entry.style} className="confidence-legend-row">
                        <span
                          className={`confidence-edge confidence-edge--${entry.style}`}
                          aria-hidden
                        />
                        <span className="font-mono text-sm text-text">{entry.label}</span>
                        <span className="text-sm text-text-tertiary">{entry.hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </BentoRow>
          </div>
        </Reveal>

        <Reveal className="mt-12">
          <div className="payoff-callout">
            <p className="payoff-eyebrow">Why you&apos;d want this</p>
            <p className="payoff-title">Catch the break before your users do.</p>
            <p className="payoff-body">
              A bad deploy rewrites a <span className="font-mono text-text">proxy_pass</span>, a
              reload orphans a vhost, a container starts crash-looping. Zvia turns that from a
              hunch into a diff — the exact line that changed since it was healthy. You stop
              grepping logs for an hour and open the diff instead.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

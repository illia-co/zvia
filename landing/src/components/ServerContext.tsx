import { useState } from 'react'
import { Reveal } from './Reveal'
import { SegmentedControl } from './SegmentedControl'

type ContextTab = 'web-stack' | 'containers'

const CONTEXT_OPTIONS = [
  { id: 'web-stack' as const, label: 'Web stack' },
  { id: 'containers' as const, label: 'Containers' }
]

const CONTEXT_CONTENT = {
  'web-stack': {
    chain: ['Nginx', 'Port', 'Service', 'Process', 'Logs'],
    description:
      'Follow a request from the web server through the listening port, systemd service, running process, and into the logs — without switching tools.'
  },
  containers: {
    chain: ['Docker', 'Container', 'Port', 'Logs'],
    description:
      'Trace a container from the Docker daemon through its network bindings and into container logs, all within the same server context.'
  }
} as const

function Chain({ items }: { items: string[] }) {
  return (
    <div className="chain-diagram rounded-panel border border-divider bg-bg-secondary p-5">
      {items.map((item, index) => (
        <span key={item} className="flex items-center gap-2">
          {index > 0 && <span className="chain-arrow" aria-hidden>→</span>}
          <span className="rounded-sm bg-bg px-2 py-1 text-text">{item}</span>
        </span>
      ))}
    </div>
  )
}

export function ServerContext() {
  const [activeTab, setActiveTab] = useState<ContextTab>('web-stack')
  const content = CONTEXT_CONTENT[activeTab]

  return (
    <section id="context" className="border-t border-divider bg-bg-secondary py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Server context
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Everything connects.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Relay tools cross-reference the same server state. Follow a path
            from service to process to logs without leaving the workspace.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <SegmentedControl
            options={CONTEXT_OPTIONS}
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="Context chains"
          />
        </Reveal>

        <Reveal className="mt-8">
          <div key={activeTab} role="tabpanel" aria-label={activeTab}>
            <Chain items={[...content.chain]} />
            <p className="mt-4 text-sm text-text-secondary">{content.description}</p>
          </div>
        </Reveal>

        <Reveal className="mt-10">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-block size-2 rounded-full bg-status-healthy"
              aria-hidden
            />
            <span className="text-text-secondary">
              <span className="font-mono text-text">production</span>
              <span className="mx-2 text-text-tertiary">·</span>
              ubuntu@203.0.113.10
              <span className="mx-2 text-text-tertiary">·</span>
              Connected
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

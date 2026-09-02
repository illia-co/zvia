import { Reveal } from './Reveal'
import { WindowChrome } from './WindowChrome'

const FLOW_STEPS = ['OS keychain', 'SSH agent', 'Zvia', 'SSH', 'your server'] as const

const TRUST_POINTS = [
  {
    title: 'Nothing installed on the server',
    detail:
      'A stock Ubuntu or Debian host is enough. No agent, no daemon, no inbound ports beyond SSH.'
  },
  {
    title: 'No credentials stored by Zvia',
    detail:
      'Keys live where your OS already keeps them — the SSH agent or keychain. Zvia never sees a server password.'
  },
  {
    title: 'No account, no cloud, no telemetry',
    detail:
      'Zvia talks only to your servers. There is no central service that receives your data.'
  },
  {
    title: 'Your permissions, exactly',
    detail:
      'Every action runs over SSH as your logged-in user, with precisely that user\u2019s privileges. No more.'
  }
] as const

export function TrustSection() {
  return (
    <section id="trust" className="border-b border-divider py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            How it connects
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Your credentials, your permissions, one hop.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Zvia has no credentials and no privileges of its own. It connects the same way
            you would — over standard SSH — and takes on exactly your identity when it gets
            there.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="window-frame">
            <WindowChrome title="Zvia" />
            <div
              className="ssh-flow-body"
              role="img"
              aria-label="Connection flow: Zvia uses keys from your OS keychain, through the SSH agent, over SSH to your server — with no datastore of its own in the middle"
            >
              <div className="ssh-flow-diagram">
                {FLOW_STEPS.map((step, index) => (
                  <span key={step} className="ssh-flow-step">
                    {index > 0 && <span className="ssh-flow-connector" aria-hidden />}
                    <span className="ssh-flow-node">{step}</span>
                  </span>
                ))}
              </div>
              <p className="trust-diagram-note">
                No Zvia datastore sits in the middle — nothing is stored, synced, or uploaded.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-10">
          <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-status-healthy" aria-hidden />
                <div>
                  <p className="m-0 text-sm font-medium text-text">{point.title}</p>
                  <p className="m-0 mt-1 text-sm leading-relaxed text-text-secondary">
                    {point.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

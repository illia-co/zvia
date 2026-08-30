import { Reveal } from './Reveal'
import { WindowChrome } from './WindowChrome'

const SSH_BULLETS = [
  'SSH for shell access and remote commands',
  'SFTP for file transfer and browsing',
  'PTY for full interactive terminal sessions',
  'Standard Linux commands — no custom agent',
  'Works with any normal Ubuntu or Linux VPS'
]

const FLOW_STEPS = ['Your computer', 'Zvia', 'SSH', 'VPS'] as const

export function RealSSH() {
  return (
    <section id="ssh" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Real SSH
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Your computer, your server, standard SSH.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Zvia connects directly over SSH. No agent to install on the remote
            machine — just a normal Linux server.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="window-frame">
            <WindowChrome title="Zvia" />
            <div
              className="ssh-flow-body"
              role="img"
              aria-label="Connection flow: Zvia on your computer connects via SSH to a Linux VPS"
            >
              <div className="ssh-flow-diagram">
                {FLOW_STEPS.map((step, index) => (
                  <span key={step} className="ssh-flow-step">
                    {index > 0 && (
                      <span className="ssh-flow-connector" aria-hidden />
                    )}
                    <span className="ssh-flow-node">{step}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <ul className="ssh-capabilities">
            {SSH_BULLETS.map((item) => (
              <li key={item} className="ssh-capability">
                <span className="ssh-capability-marker" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

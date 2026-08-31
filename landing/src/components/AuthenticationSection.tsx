import { Reveal } from './Reveal'
import { WindowChrome } from './WindowChrome'

const AUTH_POINTS = [
  {
    title: 'SSH agent or key file',
    detail:
      'Use keys already loaded in your system SSH agent, or point Zvia at a private key file on disk.'
  },
  {
    title: 'Keys stay in the main process',
    detail:
      'Private keys and passphrases never reach the renderer. The UI talks to SSH through validated IPC only.'
  },
  {
    title: 'No server login passwords',
    detail:
      'Zvia does not store or use password authentication for remote servers — SSH key-based auth only.'
  },
  {
    title: 'Host key verification',
    detail:
      'Changed host keys are surfaced explicitly before Zvia reconnects to a server.'
  }
] as const

const KEY_FLOW = ['Agent / Keychain', 'Main process', 'SSH', 'Linux server'] as const

const PROCESS_LAYERS = [
  {
    label: 'Renderer',
    detail: 'UI · panels · terminal view',
    note: 'No private keys'
  },
  {
    label: 'Main process',
    detail: 'SSH client · credentials',
    note: 'Keys stay here'
  }
] as const

export function AuthenticationSection() {
  return (
    <section id="security" className="auth-section border-t border-divider py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Authentication
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Secure by design. No server passwords.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Zvia connects with standard SSH key authentication. Credentials stay
            in the main process and your OS credential store — never in the UI
            layer.
          </p>
        </Reveal>

        <Reveal className="mt-6">
          <div
            className="chain-diagram rounded-panel border border-divider bg-bg-secondary p-4"
            role="img"
            aria-label="Key flow: SSH keys from agent or keychain enter the main process, connect over SSH, and reach a Linux server."
          >
            {KEY_FLOW.map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="chain-arrow" aria-hidden>
                    →
                  </span>
                )}
                <span className="rounded-sm bg-bg px-2 py-1 text-text">{step}</span>
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-6">
          <div className="section-two-col">
            <ul className="m-0 list-none space-y-2 p-0">
              {AUTH_POINTS.map((point) => (
                <li key={point.title} className="flex gap-2">
                  <span
                    className="mt-2 size-1 shrink-0 rounded-full bg-text-tertiary"
                    aria-hidden
                  />
                  <span className="text-sm text-text-secondary">
                    <span className="font-medium text-text">{point.title}</span>
                    {' — '}
                    {point.detail}
                  </span>
                </li>
              ))}
            </ul>

            <div className="window-frame">
              <WindowChrome title="Zvia" />
              <div
                className="auth-process-body"
                role="img"
                aria-label="Electron process boundary: the renderer UI layer has no access to private keys. Credentials stay in the main process, which handles SSH connections."
              >
                <div className="auth-process-stack">
                  {PROCESS_LAYERS.map((layer, index) => (
                    <span key={layer.label} className="auth-process-step">
                      {index > 0 && (
                        <span className="auth-process-connector" aria-hidden>
                          <span className="auth-process-line" />
                          <span className="auth-process-connector-label">IPC</span>
                          <span className="auth-process-line" />
                        </span>
                      )}
                      <span
                        className={`auth-process-pane${
                          index > 0 ? ' auth-process-pane--secure' : ''
                        }`}
                      >
                        <span className="auth-process-label">{layer.label}</span>
                        <span className="auth-process-detail">{layer.detail}</span>
                        <span className="auth-process-note">{layer.note}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

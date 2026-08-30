import { TerminalPreview } from './TerminalPreview'
import { Reveal } from './Reveal'
import { WindowChrome } from './WindowChrome'

export function TerminalSection() {
  return (
    <section id="terminal" className="border-t border-divider bg-bg-secondary py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Terminal
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Sometimes you still want an SSH terminal.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            A full interactive SSH shell lives inside the workspace — same
            connection, same server context, no context switching.
          </p>
          <p className="mt-4 max-w-2xl text-sm text-text-secondary">
            Run commands, inspect output, and jump back to structured panels
            without losing your place on the server.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="window-frame">
            <WindowChrome ariaHidden />
            <TerminalPreview />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

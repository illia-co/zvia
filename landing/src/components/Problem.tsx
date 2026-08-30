import { useState } from 'react'
import { PROBLEM_COMMANDS, ZVIA_TOOL_GROUPS } from '../config'
import { Reveal } from './Reveal'
import { SegmentedControl } from './SegmentedControl'

type ProblemView = 'today' | 'with-zvia'

const VIEW_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'with-zvia' as const, label: 'With Zvia' }
]

export function Problem() {
  const [view, setView] = useState<ProblemView>('today')

  return (
    <section id="problem" className="border-t border-divider bg-bg-secondary py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Linux server administration is fragmented.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            You reach for a dozen commands and tools to understand and operate a
            single VPS or bare-metal host.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <SegmentedControl
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
            ariaLabel="Problem comparison"
          />
        </Reveal>

        <Reveal className="mt-8">
          {view === 'today' ? (
            <div role="tabpanel" aria-label="Today">
              <ul className="problem-grid m-0 list-none p-0 font-mono text-sm text-text-secondary">
                {PROBLEM_COMMANDS.map((cmd) => (
                  <li
                    key={cmd}
                    className="rounded-panel border border-divider bg-bg px-4 py-3"
                  >
                    {cmd}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div role="tabpanel" aria-label="With Zvia">
              <div className="zvia-groups">
                {ZVIA_TOOL_GROUPS.map((group) => (
                  <div key={group.label} className="zvia-group">
                    <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      {group.label}
                    </p>
                    <p className="m-0 mt-2 text-sm text-text">
                      {group.tools.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-lg font-medium text-text">
                One server. One workspace.
              </p>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  )
}

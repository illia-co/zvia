import { useEffect, useState } from 'react'
import { FEATURE_GROUPS } from '../config'
import { Reveal } from './Reveal'
import { SegmentedControl } from './SegmentedControl'
import { TerminalPreview } from './TerminalPreview'
import { WindowChrome } from './WindowChrome'

export function FeatureTabs() {
  const [activeGroupId, setActiveGroupId] = useState(FEATURE_GROUPS[0].id)
  const [activeToolId, setActiveToolId] = useState(FEATURE_GROUPS[0].tools[0].id)

  const activeGroup =
    FEATURE_GROUPS.find((group) => group.id === activeGroupId) ?? FEATURE_GROUPS[0]
  const activeTool =
    activeGroup.tools.find((tool) => tool.id === activeToolId) ?? activeGroup.tools[0]

  useEffect(() => {
    const group = FEATURE_GROUPS.find((g) => g.id === activeGroupId) ?? FEATURE_GROUPS[0]
    setActiveToolId(group.tools[0].id)
  }, [activeGroupId])

  const tabOptions = FEATURE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label
  }))

  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Tools
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Every tool, one server context.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Every view operates on the currently selected server. No fleet
            dashboards, no cross-server aggregation — just focused Linux server
            management.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              options={tabOptions}
              value={activeGroupId}
              onChange={setActiveGroupId}
              ariaLabel="Feature groups"
            />
          </div>
        </Reveal>

        <Reveal className="mt-8">
          <div
            key={activeGroupId}
            className="feature-panel feature-panel-enter section-two-col"
            role="tabpanel"
            aria-label={activeGroup.label}
          >
            <div>
              <h3 className="m-0 text-xl font-medium text-text md:text-2xl">
                {activeGroup.headline}
              </h3>
              <p className="mt-3 text-text-secondary">{activeGroup.description}</p>

              <ul
                className="feature-tool-list m-0 mt-6 list-none divide-y divide-divider p-0"
                role="listbox"
                aria-label="Tools"
              >
                {activeGroup.tools.map((tool) => {
                  const isActive = tool.id === activeToolId
                  return (
                    <li key={tool.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => setActiveToolId(tool.id)}
                        className={`feature-tool-row${isActive ? ' feature-tool-row--active' : ''}`}
                      >
                        <span className="text-sm font-medium text-text">{tool.label}</span>
                        <span className="mt-1 block text-sm text-text-secondary">
                          {tool.description}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="feature-visual">
              <div className="window-frame">
                <WindowChrome ariaHidden />
                <div className="feature-screenshot-frame">
                  {activeTool.visual === 'terminal' ? (
                    <TerminalPreview />
                  ) : activeTool.screenshot ? (
                    <img
                      key={activeTool.id}
                      src={activeTool.screenshot}
                      alt={`Zvia ${activeTool.label} panel`}
                      className="feature-screenshot-image"
                      width={1440}
                      height={900}
                      loading="lazy"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { FEATURE_TOOLS } from '../config'
import { Reveal } from './Reveal'
import { ToolDialog } from './ToolDialog'

export function FeatureGrid() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <section id="features" className="border-b border-divider py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Everything else
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            The rest of the toolbox.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Deployments is the reason you&apos;ll open Zvia. These are the reasons you&apos;ll
            keep using it — every tool you&apos;d expect, scoped to the server you selected.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="feature-tool-grid">
            {FEATURE_TOOLS.map((tool, index) => (
              <button
                key={tool.id}
                type="button"
                className="feature-tool-cell"
                onClick={() => setActiveIndex(index)}
                aria-haspopup="dialog"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="feature-tool-cell-label">
                    {tool.label}
                    <span className="feature-tool-cell-hint" aria-hidden>
                      ↗
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-text-tertiary">{tool.command}</span>
                </div>
                <p className="m-0 mt-0.5 text-[13px] text-text-secondary">{tool.detail}</p>
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      {activeIndex !== null && (
        <ToolDialog
          tools={FEATURE_TOOLS}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onNavigate={setActiveIndex}
        />
      )}
    </section>
  )
}

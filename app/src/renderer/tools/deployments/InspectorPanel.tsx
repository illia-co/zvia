import { cn } from '@renderer/lib/utils'

interface InspectorPanelProps {
  eyebrow: string
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  headerExtra?: React.ReactNode
}

export function InspectorPanel({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
  headerExtra
}: InspectorPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex items-start gap-2 border-b border-divider p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{eyebrow}</p>
          <h3 className="mt-1 truncate font-mono text-sm text-text">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>}
          {headerExtra}
        </div>
        <button
          type="button"
          aria-label="Close inspector"
          className={cn(
            'titlebar-no-drag shrink-0 rounded-panel px-2 py-1 text-lg leading-none text-text-secondary',
            'transition-colors duration-default hover:bg-bg-secondary hover:text-text'
          )}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  )
}

interface InspectorFieldProps {
  label: string
  value: string
  mono?: boolean
}

export function InspectorField({ label, value, mono }: InspectorFieldProps) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className={cn('min-w-0 flex-1 text-xs text-text', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

interface InspectorSectionProps {
  title: string
  children: React.ReactNode
}

export function InspectorSection({ title, children }: InspectorSectionProps) {
  return (
    <section className="mt-4 first:mt-0">
      <h4 className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">{title}</h4>
      {children}
    </section>
  )
}

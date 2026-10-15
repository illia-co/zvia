import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  error?: string | null
  className?: string
}

export function Field({ label, children, hint, error, className }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && !error && <span className="mt-1 block text-xs text-text-secondary">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-status-error">{error}</span>}
    </label>
  )
}

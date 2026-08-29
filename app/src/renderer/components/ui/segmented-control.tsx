import { cn } from '@renderer/lib/utils'

interface SegmentedControlOption<T extends string> {
  id: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (next: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
            value === option.id
              ? 'bg-bg-secondary text-text'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

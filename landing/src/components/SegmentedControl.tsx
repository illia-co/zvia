interface SegmentedControlOption<T extends string> {
  id: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (next: T) => void
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`segmented-control ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={`segmented-option${isActive ? ' segmented-option--active' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

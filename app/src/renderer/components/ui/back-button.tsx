import type { ButtonHTMLAttributes } from 'react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface BackButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Defaults to "Back"; pass a destination when the header has room for it. */
  label?: string
}

/**
 * Detail headers sit next to other ghost buttons, so the chevron and the hairline
 * outline are what make this read as navigation rather than one more action.
 */
export function BackButton({ label = 'Back', className, ...props }: BackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      className={cn('gap-1 border border-divider pl-1.5 pr-2.5', className)}
      {...props}
    >
      <span aria-hidden className="text-sm leading-none">
        ‹
      </span>
      {label}
    </Button>
  )
}

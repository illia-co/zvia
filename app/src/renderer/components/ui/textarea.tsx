import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none transition-colors duration-default placeholder:text-text-tertiary focus:border-text-tertiary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

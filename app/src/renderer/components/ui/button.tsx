import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center rounded-panel font-medium transition-colors duration-default disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' && 'px-2.5 py-1 text-xs',
          size === 'md' && 'px-3 py-1.5 text-sm',
          variant === 'default' && 'bg-text text-bg hover:opacity-90',
          variant === 'ghost' && 'text-text-secondary hover:bg-bg-secondary hover:text-text',
          variant === 'destructive' && 'bg-status-error text-bg hover:opacity-90',
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

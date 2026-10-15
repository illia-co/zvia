import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@renderer/lib/utils'

export const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-divider bg-bg outline-none transition-colors duration-default focus:border-text-tertiary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-text data-[state=checked]:bg-text data-[state=checked]:text-bg',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-[10px] leading-none">
      ✓
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'

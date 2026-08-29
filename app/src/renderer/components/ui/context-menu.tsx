import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export const ContextMenuGroup = ContextMenuPrimitive.Group
export const ContextMenuPortal = ContextMenuPrimitive.Portal

export const ContextMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        'z-50 min-w-40 rounded-panel border border-divider bg-bg-elevated p-1 shadow-panel outline-none',
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = 'ContextMenuContent'

export const ContextMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs text-text outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-disabled:cursor-not-allowed data-highlighted:bg-bg-secondary',
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = 'ContextMenuItem'

export const ContextMenuSeparator = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-divider', className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = 'ContextMenuSeparator'

export function ContextMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <ContextMenuPrimitive.Label
      className={cn('px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary', className)}
      {...props}
    />
  )
}

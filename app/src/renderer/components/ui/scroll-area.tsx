import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode
} from 'react'
import { cn } from '@renderer/lib/utils'

const ScrollAreaRoot = ScrollAreaPrimitive.Root
const ScrollAreaViewport = ScrollAreaPrimitive.Viewport
const ScrollAreaScrollbar = ScrollAreaPrimitive.Scrollbar
const ScrollAreaThumb = ScrollAreaPrimitive.Thumb
const ScrollAreaCorner = ScrollAreaPrimitive.Corner

export interface ScrollAreaProps extends ComponentPropsWithoutRef<typeof ScrollAreaRoot> {
  children: ReactNode
  viewportClassName?: string
  /** Show a horizontal scrollbar when content overflows. Default: vertical only. */
  horizontal?: boolean
}

export const ScrollArea = forwardRef<ComponentRef<typeof ScrollAreaRoot>, ScrollAreaProps>(
  (
    {
      children,
      className,
      viewportClassName,
      horizontal = false,
      type = 'hover',
      scrollHideDelay = 600,
      ...props
    },
    ref
  ) => (
    <ScrollAreaRoot
      ref={ref}
      type={type}
      scrollHideDelay={scrollHideDelay}
      className={cn('zvia-scroll-area', className)}
      {...props}
    >
      <ScrollAreaViewport className={cn('h-full w-full', viewportClassName)}>
        {children}
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical">
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
      {horizontal ? (
        <ScrollAreaScrollbar orientation="horizontal">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
      ) : null}
      {horizontal ? <ScrollAreaCorner /> : null}
    </ScrollAreaRoot>
  )
)
ScrollArea.displayName = 'ScrollArea'

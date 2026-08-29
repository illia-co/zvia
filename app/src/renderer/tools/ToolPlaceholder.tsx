import type { ToolId } from '@renderer/lib/tools'
import { getToolLabel } from '@renderer/lib/tools'

interface ToolPlaceholderProps {
  toolId: ToolId
  description?: string
}

export function ToolPlaceholder({ toolId, description }: ToolPlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">{getToolLabel(toolId)}</p>
      <p className="mt-2 max-w-sm text-xs text-text-secondary">
        {description ?? 'Coming soon.'}
      </p>
    </div>
  )
}

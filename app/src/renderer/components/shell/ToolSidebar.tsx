import type { ToolId } from '@renderer/lib/tools'
import { TOOLS } from '@renderer/lib/tools'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import { useServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'

export function ToolSidebar() {
  const { server, serverId } = useServerContext()
  const openTool = useWorkspaceStore((s) => s.openTool)
  const workspace = useWorkspaceStore((s) => (serverId ? s.getWorkspace(serverId) : null))
  const focusedPanelId = workspace?.focusedPanelId
  const focusedToolId = focusedPanelId ? workspace?.panels[focusedPanelId]?.toolId : null

  if (!server || !serverId) {
    return (
      <aside className="flex w-48 shrink-0 flex-col border-r border-divider bg-bg">
        <div className="px-3 py-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Tools
          </span>
          <p className="mt-4 text-xs text-text-secondary">Select a server to begin.</p>
        </div>
      </aside>
    )
  }

  const sections = TOOLS.reduce<Record<string, typeof TOOLS>>((acc, tool) => {
    const section = tool.section ?? 'General'
    acc[section] = [...(acc[section] ?? []), tool]
    return acc
  }, {})

  const handleOpen = (toolId: ToolId) => {
    openTool(serverId, toolId)
  }

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-divider bg-bg">
      <div className="border-b border-divider px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          {server.name}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-text-secondary">
          {server.username}@{server.hostname}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-2 py-2">
          {Object.entries(sections).map(([section, tools]) => (
            <div key={section} className="mb-3 last:mb-0">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {section}
              </p>
              <ul className="space-y-0.5">
                {tools.map((tool) => {
                  const isActive = focusedToolId === tool.id
                  return (
                    <li key={tool.id}>
                      <button
                        type="button"
                        onClick={() => handleOpen(tool.id)}
                        className={cn(
                          'w-full rounded-panel px-2 py-1.5 text-left text-sm transition-colors duration-default',
                          isActive
                            ? 'bg-bg-secondary text-text'
                            : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
                        )}
                      >
                        {tool.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}

import { useEffect, useState } from 'react'
import type { ToolId } from '@renderer/lib/tools'
import { setupScreenshotDemo } from '@renderer/screenshot/setup'
import { ServerProvider } from '@renderer/state/ServerContext'
import { useServerStore } from '@renderer/state/serverStore'
import { useShellKeyboard } from '@renderer/hooks/useShellKeyboard'
import { ServerSidebar } from './ServerSidebar'
import { ToolSidebar } from './ToolSidebar'
import { TitleBar } from './TitleBar'
import { Toolbar } from './Toolbar'
import { Workspace } from '@renderer/components/workspace/Workspace'
import { CommandPalette } from '@renderer/components/workspace/CommandPalette'
import { ConfirmCloseDialog } from '@renderer/components/workspace/ConfirmCloseDialog'
import { HostKeyDialog } from '@renderer/components/servers/HostKeyDialog'
import { AddServerDialog } from '@renderer/components/servers/AddServerDialog'
import { ServerProfileDialog } from '@renderer/components/servers/ServerProfileDialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'

function ShellKeyboard() {
  useShellKeyboard()
  return null
}

export function AppShell() {
  const initialize = useServerStore((s) => s.initialize)
  const actionError = useServerStore((s) => s.actionError)
  const clearActionError = useServerStore((s) => s.clearActionError)
  const selectedServerId = useServerStore((s) => s.selectedServerId)
  const connectionErrors = useServerStore((s) => s.connectionErrors)
  const connectionError = selectedServerId ? connectionErrors[selectedServerId] : undefined
  const [addServerOpen, setAddServerOpen] = useState(false)
  const [editServerId, setEditServerId] = useState<string | null>(null)

  useEffect(() => {
    if (window.relay.screenshot) {
      return window.relay.screenshot.onConfigure(({ tool }) => {
        setupScreenshotDemo(tool as ToolId)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.relay.screenshot?.ready()
          })
        })
      })
    }

    return initialize()
  }, [initialize])

  return (
    <ServerProvider>
      <ShellKeyboard />
      <div className="flex h-full flex-col bg-bg text-text">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <ServerSidebar
            onAddServer={() => setAddServerOpen(true)}
            onEditServer={(serverId) => setEditServerId(serverId)}
          />
          <ToolSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Toolbar />
            {(actionError || connectionError) && (
              <div className="border-b border-divider px-4 py-2">
                <ErrorSurface
                  error={connectionError ?? actionError!}
                  onDismiss={clearActionError}
                  onRetry={
                    selectedServerId
                      ? () => void useServerStore.getState().connect(selectedServerId)
                      : undefined
                  }
                  secondaryAction={
                    connectionError && selectedServerId
                      ? {
                          label: 'Edit credentials',
                          onClick: () => setEditServerId(selectedServerId)
                        }
                      : undefined
                  }
                />
              </div>
            )}
            <Workspace />
          </div>
        </div>
      </div>
      <HostKeyDialog />
      <AddServerDialog open={addServerOpen} onOpenChange={setAddServerOpen} />
      <ServerProfileDialog
        mode="edit"
        serverId={editServerId ?? undefined}
        open={editServerId !== null}
        onOpenChange={(open) => {
          if (!open) setEditServerId(null)
        }}
      />
      <CommandPalette />
      <ConfirmCloseDialog />
    </ServerProvider>
  )
}

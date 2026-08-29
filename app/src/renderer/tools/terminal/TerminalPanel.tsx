import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerId } from '@shared/server'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { usePanelId, usePanelVisibility } from '@renderer/state/PanelContext'
import { usePanelStateStore } from '@renderer/state/panelStateStore'
import { useServerStore } from '@renderer/state/serverStore'
import { useTerminalSessionStore } from '@renderer/state/terminalSessionStore'
import { useToolIntent } from '@renderer/state/navigationStore'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { cn } from '@renderer/lib/utils'
import { TerminalView } from './TerminalView'

interface TerminalSessionViewProps {
  serverId: ServerId
  panelId: string
  tabId: string
  prefill?: string
  command?: string
  isActive: boolean
  isWorkspaceVisible: boolean
  isConnected: boolean
}

function TerminalSessionView({
  serverId,
  panelId,
  tabId,
  prefill,
  command,
  isActive,
  isWorkspaceVisible,
  isConnected
}: TerminalSessionViewProps) {
  const markEnded = useTerminalSessionStore((s) => s.markEnded)
  const onSessionEnded = useCallback(() => {
    markEnded(panelId, tabId)
  }, [markEnded, panelId, tabId])

  return (
    <TerminalView
      serverId={serverId}
      sessionId={tabId}
      prefill={prefill}
      command={command}
      isActive={isActive}
      isWorkspaceVisible={isWorkspaceVisible}
      isConnected={isConnected}
      onSessionEnded={onSessionEnded}
    />
  )
}

export function TerminalPanel() {
  const panelId = usePanelId()
  const isWorkspaceVisible = usePanelVisibility()
  const registerPanelDirty = usePanelStateStore((s) => s.registerPanelDirty)
  const { serverId, connectionState } = useRequiredServerContext()
  const connect = useServerStore((s) => s.connect)

  const { tabs, activeTabId } = useTerminalSessionStore((s) => s.getPanelState(panelId))
  const addTab = useTerminalSessionStore((s) => s.addTab)
  const closeTab = useTerminalSessionStore((s) => s.closeTab)
  const setActiveTab = useTerminalSessionStore((s) => s.setActiveTab)
  const closeAllForPanel = useTerminalSessionStore((s) => s.closeAllForPanel)
  const terminalIntent = useToolIntent('terminal')

  const [prefillByTabId, setPrefillByTabId] = useState<Record<string, string>>({})
  const [commandByTabId, setCommandByTabId] = useState<Record<string, string>>({})

  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null)

  const isConnected = connectionState === 'connected'
  const activeSessionCount = tabs.filter((tab) => !tab.ended).length

  useEffect(() => {
    if (activeSessionCount > 0) {
      registerPanelDirty(panelId, { kind: 'terminal', sessionCount: activeSessionCount })
    } else {
      registerPanelDirty(panelId, null)
    }
    return () => registerPanelDirty(panelId, null)
  }, [activeSessionCount, panelId, registerPanelDirty])

  const isConnectionLost =
    connectionState === 'disconnected' ||
    connectionState === 'error' ||
    connectionState === 'reconnecting'

  const handleAddTab = useCallback(() => {
    addTab(panelId)
  }, [addTab, panelId])

  useEffect(() => {
    if (!terminalIntent) return
    const { prefill, command } = terminalIntent
    if (!prefill && !command) return

    const tabId = addTab(panelId)
    if (prefill) {
      setPrefillByTabId((current) => ({ ...current, [tabId]: prefill }))
    }
    if (command) {
      setCommandByTabId((current) => ({ ...current, [tabId]: command }))
    }
  }, [addTab, panelId, terminalIntent])

  const previousServerId = useRef(serverId)
  useEffect(() => {
    if (previousServerId.current !== serverId) {
      closeAllForPanel(panelId, previousServerId.current)
      previousServerId.current = serverId
    }
  }, [closeAllForPanel, panelId, serverId])

  const autoCreatedRef = useRef(false)
  useEffect(() => {
    if (!isConnected || tabs.length > 0) {
      if (!isConnected) {
        autoCreatedRef.current = false
      }
      return
    }
    if (autoCreatedRef.current) return
    autoCreatedRef.current = true
    addTab(panelId)
  }, [addTab, isConnected, panelId, tabs.length])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      closeTab(panelId, tabId, serverId)
    },
    [closeTab, panelId, serverId]
  )

  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId)
      if (tab && !tab.ended) {
        setPendingCloseTabId(tabId)
        return
      }
      handleCloseTab(tabId)
    },
    [handleCloseTab, tabs]
  )

  const confirmCloseTab = useCallback(() => {
    if (!pendingCloseTabId) return
    const tabId = pendingCloseTabId
    setPendingCloseTabId(null)
    handleCloseTab(tabId)
  }, [handleCloseTab, pendingCloseTabId])

  const handleReconnect = useCallback(() => {
    void connect(serverId)
  }, [connect, serverId])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1a1a1a] text-[#f2f2f2]">
      <div className="flex shrink-0 items-center gap-1 border-b border-[#2a2a2a] px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(panelId, tab.id)}
              className={cn(
                'group inline-flex max-w-[10rem] items-center gap-1.5 rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                activeTabId === tab.id
                  ? 'bg-[#2a2a2a] text-[#f2f2f2]'
                  : 'text-[#999999] hover:bg-[#242424] hover:text-[#f2f2f2]'
              )}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Close ${tab.title}`}
                className="rounded px-0.5 text-[#666666] hover:bg-[#333333] hover:text-[#f2f2f2]"
                onClick={(event) => {
                  event.stopPropagation()
                  requestCloseTab(tab.id)
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-[#999999] hover:bg-[#242424] hover:text-[#f2f2f2]"
          onClick={handleAddTab}
          disabled={!isConnected}
        >
          New
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <p className="text-sm text-[#cccccc]">
                {isConnected ? 'No terminal sessions' : 'Not connected'}
              </p>
              <p className="mt-2 text-xs text-[#777777]">
                {isConnected
                  ? 'Create a new terminal session to begin.'
                  : 'Connect to this server to open a terminal.'}
              </p>
              {!isConnected && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={handleReconnect}
                  disabled={connectionState === 'connecting' || connectionState === 'reconnecting'}
                >
                  {connectionState === 'connecting' || connectionState === 'reconnecting'
                    ? 'Connecting…'
                    : 'Connect'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'absolute inset-0 h-full min-h-0',
                activeTabId === tab.id
                  ? 'visible z-10'
                  : 'invisible pointer-events-none z-0'
              )}
            >
              <TerminalSessionView
                serverId={serverId}
                panelId={panelId}
                tabId={tab.id}
                prefill={prefillByTabId[tab.id]}
                command={commandByTabId[tab.id]}
                isActive={activeTabId === tab.id}
                isWorkspaceVisible={isWorkspaceVisible}
                isConnected={isConnected}
              />
            </div>
          ))
        )}

        {isConnectionLost && tabs.length > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a1a]/90">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-[#f2f2f2]">Connection lost</p>
              <p className="mt-2 text-xs text-[#999999]">
                Reconnect to resume terminal sessions. Ended sessions can be closed from the tab bar.
              </p>
              <Button size="sm" className="mt-4" onClick={handleReconnect}>
                {connectionState === 'reconnecting' ? 'Reconnecting…' : 'Reconnect'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={pendingCloseTabId !== null} onOpenChange={(open) => !open && setPendingCloseTabId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close terminal session?</DialogTitle>
            <DialogDescription>This will end the active session.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingCloseTabId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmCloseTab}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { getToolLabel } from '@renderer/lib/tools'
import { usePanelStateStore } from '@renderer/state/panelStateStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

function getCloseMessage(
  toolLabel: string,
  dirty: { kind: 'terminal' | 'files'; sessionCount?: number }
): { title: string; description: string } {
  if (dirty.kind === 'terminal') {
    const count = dirty.sessionCount ?? 1
    return {
      title: `Close ${toolLabel}?`,
      description: `This will end ${count} active session${count === 1 ? '' : 's'}.`
    }
  }

  return {
    title: `Close ${toolLabel}?`,
    description: 'You have unsaved changes.'
  }
}

export function ConfirmCloseDialog() {
  const pendingClose = useWorkspaceStore((s) => s.pendingPanelClose)
  const cancelClosePanel = useWorkspaceStore((s) => s.cancelClosePanel)
  const confirmClosePanel = useWorkspaceStore((s) => s.confirmClosePanel)
  const dirty = usePanelStateStore((s) =>
    pendingClose ? s.dirtyPanels[pendingClose.panelId] ?? null : null
  )
  const panel =
    pendingClose !== null
      ? useWorkspaceStore.getState().getWorkspace(pendingClose.serverId).panels[pendingClose.panelId]
      : null
  const toolLabel = panel ? getToolLabel(panel.toolId) : 'panel'
  const message = dirty ? getCloseMessage(toolLabel, dirty) : null

  return (
    <Dialog open={pendingClose !== null} onOpenChange={(open) => !open && cancelClosePanel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{message?.title ?? `Close ${toolLabel}?`}</DialogTitle>
          {message && <DialogDescription>{message.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={cancelClosePanel}>
            Cancel
          </Button>
          <Button onClick={confirmClosePanel}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

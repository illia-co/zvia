import { useState } from 'react'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface ElevationRequiredProps {
  serverId: ServerId
  command: string
  className?: string
  /**
   * Least-privilege sudoers line (with `<user>` already replaced) shown with
   * a copy button, so password-sudo users can unlock the GUI path via visudo.
   */
  sudoersEntry?: string
}

export function ElevationRequired({ serverId, command, className, sudoersEntry }: ElevationRequiredProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const [copied, setCopied] = useState(false)

  const copySudoers = async (): Promise<void> => {
    if (!sudoersEntry) return
    try {
      await navigator.clipboard.writeText(sudoersEntry)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable; the entry stays selectable as plain text.
    }
  }

  return (
    <div className={cn('rounded-panel bg-bg-secondary p-4', className)}>
      <p className="text-sm font-medium text-text">Elevated privileges required</p>
      <p className="mt-2 text-xs text-text-secondary">
        This action requires root access or passwordless sudo on the remote server.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-sm bg-bg p-2 font-mono text-[10px] text-text-secondary">
        {command}
      </pre>
      {sudoersEntry && (
        <div className="mt-3">
          <p className="text-xs text-text-secondary">
            To allow exactly these commands without a password, add this line via{' '}
            <span className="font-mono">visudo</span> on the server:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-sm bg-bg p-2 font-mono text-[10px] text-text-secondary">
            {sudoersEntry}
          </pre>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => void copySudoers()}>
            {copied ? 'Copied' : 'Copy sudoers line'}
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-1">
        <Button
          size="sm"
          onClick={() => openWithIntent(serverId, { tool: 'settings', tab: 'permissions' })}
        >
          Manage permissions
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'terminal', prefill: command })}
        >
          Continue in Terminal
        </Button>
      </div>
    </div>
  )
}

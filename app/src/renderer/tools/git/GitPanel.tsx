import { useCallback, useEffect, useState } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { Button } from '@renderer/components/ui/button'
import { GitUnavailable } from './GitUnavailable'
import { ReposTab } from './ReposTab'

export function GitPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const isConnected = connectionState === 'connected'

  const checkAvailability = useCallback(async () => {
    if (!isConnected) {
      setGitAvailable(null)
      return
    }
    setChecking(true)
    try {
      const available = await window.zvia.git.isAvailable({ serverId })
      setGitAvailable(available)
    } catch {
      setGitAvailable(false)
    } finally {
      setChecking(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    setGitAvailable(null)
    void checkAvailability()
  }, [checkAvailability, serverId])

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to manage Git repositories.
          </p>
        </div>
      </div>
    )
  }

  if (checking || gitAvailable === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-xs text-text-secondary">Checking Git availability…</p>
      </div>
    )
  }

  if (!gitAvailable) {
    return <GitUnavailable serverId={serverId} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-divider px-2 py-1.5">
        <span className="px-2.5 py-1 text-xs font-medium text-text">Repositories</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void checkAvailability()}
        >
          Recheck
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <ReposTab serverId={serverId} isConnected={isConnected} />
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import type { DockerVolume } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseRelayError } from '@renderer/lib/errors'

interface VolumesTabProps {
  serverId: ServerId
  isConnected: boolean
}

export function VolumesTab({ serverId, isConnected }: VolumesTabProps) {
  const [volumes, setVolumes] = useState<DockerVolume[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingVolume, setPendingVolume] = useState<DockerVolume | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadVolumes = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.relay.docker.listVolumes({ serverId })
      setVolumes(result)
    } catch (err) {
      setError(parseRelayError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void loadVolumes()
  }, [loadVolumes])

  const confirmRemove = async () => {
    if (!pendingVolume) return
    setActionLoading(true)
    setError(null)
    try {
      await window.relay.docker.removeVolume({
        serverId,
        volumeName: pendingVolume.name,
        force: true
      })
      setPendingVolume(null)
      await loadVolumes()
    } catch (err) {
      setError(parseRelayError(err).message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-divider px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => void loadVolumes()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && volumes.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading volumes…</p>
        ) : volumes.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">No volumes found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Mountpoint</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((volume) => (
                <tr key={volume.name} className="border-t border-divider">
                  <td className="px-3 py-2 font-medium text-text">{volume.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{volume.driver}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{volume.mountpoint}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-status-error hover:text-status-error"
                      onClick={() => setPendingVolume(volume)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={pendingVolume !== null} onOpenChange={(open) => !open && setPendingVolume(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove volume</DialogTitle>
            <DialogDescription>
              Remove volume <span className="font-mono">{pendingVolume?.name}</span>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingVolume(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => void confirmRemove()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

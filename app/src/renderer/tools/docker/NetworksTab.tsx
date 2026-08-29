import { useCallback, useEffect, useState } from 'react'
import type { DockerNetwork } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseRelayError } from '@renderer/lib/errors'

interface NetworksTabProps {
  serverId: ServerId
  isConnected: boolean
}

export function NetworksTab({ serverId, isConnected }: NetworksTabProps) {
  const [networks, setNetworks] = useState<DockerNetwork[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNetworks = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.relay.docker.listNetworks({ serverId })
      setNetworks(result)
    } catch (err) {
      setError(parseRelayError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void loadNetworks()
  }, [loadNetworks])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-divider px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => void loadNetworks()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && networks.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading networks…</p>
        ) : networks.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">No networks found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Containers</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((network) => (
                <tr key={network.id} className="border-t border-divider">
                  <td className="px-3 py-2 font-medium text-text">{network.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{network.driver}</td>
                  <td className="px-3 py-2 text-text-secondary">{network.scope}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{network.containers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

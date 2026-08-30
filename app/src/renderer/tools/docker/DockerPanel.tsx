import { useCallback, useEffect, useState } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { ContainersTab } from './ContainersTab'
import { DockerUnavailable } from './DockerUnavailable'
import { ImagesTab } from './ImagesTab'
import { NetworksTab } from './NetworksTab'
import { VolumesTab } from './VolumesTab'

type DockerTab = 'containers' | 'images' | 'volumes' | 'networks'

const TABS: { id: DockerTab; label: string }[] = [
  { id: 'containers', label: 'Containers' },
  { id: 'images', label: 'Images' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'networks', label: 'Networks' }
]

export function DockerPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const [activeTab, setActiveTab] = useState<DockerTab>('containers')
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const isConnected = connectionState === 'connected'

  const checkAvailability = useCallback(async () => {
    if (!isConnected) {
      setDockerAvailable(null)
      return
    }
    setChecking(true)
    try {
      const available = await window.zvia.docker.isAvailable({ serverId })
      setDockerAvailable(available)
    } catch {
      setDockerAvailable(false)
    } finally {
      setChecking(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    setDockerAvailable(null)
    void checkAvailability()
  }, [checkAvailability, serverId])

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to manage Docker resources.
          </p>
        </div>
      </div>
    )
  }

  if (checking || dockerAvailable === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-xs text-text-secondary">Checking Docker availability…</p>
      </div>
    )
  }

  if (!dockerAvailable) {
    return <DockerUnavailable serverId={serverId} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-divider px-2 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
              activeTab === tab.id
                ? 'bg-bg-secondary text-text'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
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
        {activeTab === 'containers' && (
          <ContainersTab serverId={serverId} isConnected={isConnected} />
        )}
        {activeTab === 'images' && <ImagesTab serverId={serverId} isConnected={isConnected} />}
        {activeTab === 'volumes' && <VolumesTab serverId={serverId} isConnected={isConnected} />}
        {activeTab === 'networks' && (
          <NetworksTab serverId={serverId} isConnected={isConnected} />
        )}
      </div>
    </div>
  )
}

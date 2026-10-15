import { useState } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useToolIntent } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { PermissionsTab } from './PermissionsTab'

type SettingsTab = 'permissions'

const TABS: { id: SettingsTab; label: string }[] = [{ id: 'permissions', label: 'Permissions' }]

export function SettingsPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const intent = useToolIntent('settings')
  const [activeTab, setActiveTab] = useState<SettingsTab>(intent?.tab ?? 'permissions')

  const isConnected = connectionState === 'connected'

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to manage its settings.
          </p>
        </div>
      </div>
    )
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
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'permissions' && (
          <PermissionsTab serverId={serverId} isConnected={isConnected} />
        )}
      </div>
    </div>
  )
}

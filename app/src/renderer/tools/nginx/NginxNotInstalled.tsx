import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface NginxNotInstalledProps {
  serverId: ServerId
}

export function NginxNotInstalled({ serverId }: NginxNotInstalledProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">nginx not found</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
        No nginx binary is on this server's PATH. Install it, or open a Terminal to check whether
        it lives somewhere unusual.
      </p>
      <Button
        size="sm"
        className="mt-5"
        onClick={() =>
          openWithIntent(serverId, { tool: 'terminal', prefill: 'command -v nginx' })
        }
      >
        Open Terminal
      </Button>
    </div>
  )
}

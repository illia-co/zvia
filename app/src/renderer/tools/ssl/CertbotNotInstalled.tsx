import type { ServerId } from '@shared/server'
import type { SslCertbotInfo } from '@shared/ssl'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface CertbotNotInstalledProps {
  serverId: ServerId
  certbot: SslCertbotInfo
  nginxInstalled: boolean
  actionLoading: boolean
  onInstall: () => void
}

export function CertbotNotInstalled({
  serverId,
  certbot,
  nginxInstalled,
  actionLoading,
  onInstall
}: CertbotNotInstalledProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">Certbot not found</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
        Relay uses Certbot with the nginx plugin to issue and renew Let&apos;s Encrypt certificates.
        Install it on the server before enabling HTTPS.
      </p>
      {certbot.installHint && (
        <pre className="mt-4 max-w-lg overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
          {certbot.installHint.command}
        </pre>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {certbot.installHint && (
          <Button size="sm" disabled={actionLoading} onClick={onInstall}>
            Install Certbot
          </Button>
        )}
        {!nginxInstalled && (
          <Button size="sm" variant="ghost" onClick={() => openWithIntent(serverId, { tool: 'nginx' })}>
            Open Nginx
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'terminal', prefill: 'command -v certbot' })}
        >
          Open Terminal
        </Button>
      </div>
    </div>
  )
}

interface SslUnsupportedProps {
  serverId: ServerId
  reason: string
  nginxInstalled: boolean
}

export function SslUnsupported({ serverId, reason, nginxInstalled }: SslUnsupportedProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">SSL unavailable</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">{reason}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {!nginxInstalled && (
          <Button size="sm" variant="ghost" onClick={() => openWithIntent(serverId, { tool: 'nginx' })}>
            Open Nginx
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'terminal' })}
        >
          Open Terminal
        </Button>
      </div>
    </div>
  )
}

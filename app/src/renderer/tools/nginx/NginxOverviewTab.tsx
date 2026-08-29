import type { NginxStatus } from '@shared/nginx'
import type { SslOverview } from '@shared/ssl'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface NginxOverviewTabProps {
  serverId: ServerId
  status: NginxStatus
  sslOverview: SslOverview | null
  onOpenService: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-40 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

export function NginxOverviewTab({
  serverId,
  status,
  sslOverview,
  onOpenService
}: NginxOverviewTabProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const httpsCerts =
    sslOverview?.certificates.filter((cert) =>
      cert.nginxSites.some((site) => site.listensHttps)
    ) ?? []

  return (
    <div className="h-full overflow-auto p-4">
      <dl className="mb-5">
        <Field label="Version" value={status.version ?? 'Unknown'} />
        <Field label="Main PID" value={status.mainPid === null ? '—' : String(status.mainPid)} />
        <Field label="Active since" value={status.activeSince ?? '—'} />
        <Field label="Unit file state" value={status.unitFileState ?? '—'} />
        <Field label="Config file" value={status.paths.confPath ?? 'Unknown'} />
        <Field label="Config root" value={status.paths.configRoot ?? 'Unknown'} />
        <Field label="Prefix" value={status.paths.prefix ?? 'Unknown'} />
        <Field label="Default access log" value={status.paths.accessLogPath ?? 'Unknown'} />
        <Field label="Default error log" value={status.paths.errorLogPath ?? 'Unknown'} />
      </dl>

      {sslOverview && (
        <div className="mb-5 rounded-panel bg-bg-secondary p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">HTTPS</p>
          {httpsCerts.length === 0 ? (
            <p className="mt-2 text-xs text-text-secondary">
              No TLS certificates linked to nginx sites were detected.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {httpsCerts.map((cert) => (
                <li key={cert.id} className="font-mono text-xs text-text">
                  {cert.primaryDomain}
                  {cert.daysRemaining !== null ? ` · ${cert.daysRemaining}d remaining` : ''}
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => openWithIntent(serverId, { tool: 'ssl' })}
          >
            Open in SSL
          </Button>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">
          Configuration test
        </p>
        {status.validation.state === 'unknown' ? (
          <p className="text-xs text-text-secondary">
            Not tested in this session. Run Test configuration to check the live config.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-text">
              {status.validation.state === 'valid'
                ? 'nginx -t reported a valid configuration.'
                : 'nginx -t reported a problem.'}
            </p>
            <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
              {status.validation.output || 'No output.'}
            </pre>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {status.systemdAvailable && (
          <Button size="sm" variant="ghost" onClick={onOpenService}>
            Open nginx.service in Services
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'ports', port: 80 })}
        >
          Open in Ports
        </Button>
      </div>

      {!status.systemdAvailable && (
        <p className="mt-4 text-xs leading-relaxed text-text-secondary">
          systemd is not available on this server, so state is derived from the running process
          list. Start, stop, restart and reload will not work without a service manager.
        </p>
      )}
    </div>
  )
}

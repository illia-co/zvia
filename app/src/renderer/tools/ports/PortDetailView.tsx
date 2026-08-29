import {
  firewallRuleCoversPort,
  type PortListener,
  type PortsSnapshot
} from '@shared/ports'
import type { SslCertificate } from '@shared/ssl'
import type { ServerId } from '@shared/server'
import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { exposureLabel, looksLikeNginx, verdictLabel } from './portLabels'
import type { PendingFirewallChange } from './FirewallRuleDialog'

interface PortDetailViewProps {
  serverId: ServerId
  listener: PortListener
  snapshot: PortsSnapshot
  /** Why Allow/Block are missing, or null when they are available. */
  firewallUnavailableReason: string | null
  actionLoading: boolean
  onRequestChange: (change: PendingFirewallChange) => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

export function PortDetailView({
  serverId,
  listener,
  snapshot,
  firewallUnavailableReason,
  actionLoading,
  onRequestChange
}: PortDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const openTool = useWorkspaceStore((state) => state.openTool)
  const [sslCert, setSslCert] = useState<SslCertificate | null>(null)

  const isSshPort = listener.protocol === 'tcp' && listener.port === snapshot.sshPort
  const isHttpPort = listener.protocol === 'tcp' && (listener.port === 80 || listener.port === 443)
  const showSslContext = isHttpPort && looksLikeNginx(listener)

  useEffect(() => {
    if (!showSslContext) {
      setSslCert(null)
      return
    }
    void window.relay.ssl
      .overview({ serverId })
      .then((overview) => {
        const match = overview.certificates.find((cert) =>
          cert.nginxSites.some((site) => site.ports.includes(listener.port))
        )
        setSslCert(match ?? null)
      })
      .catch(() => setSslCert(null))
  }, [listener.port, serverId, showSslContext])
  const matchingRules = snapshot.firewall.rules.filter((rule) =>
    firewallRuleCoversPort(rule, listener.port, listener.protocol)
  )
  const canEdit = snapshot.firewall.editable && !isSshPort

  return (
    <div className="h-full overflow-auto p-4">
      <dl className="mb-5">
        <Field label="Protocol" value={listener.protocol} />
        <Field label="Port" value={String(listener.port)} />
        <Field label="Bind address" value={listener.address} />
        <Field label="Exposure" value={exposureLabel(listener.exposure)} />
        <Field label="Process" value={listener.process || 'Not visible to this user'} />
        <Field label="PID" value={listener.pid === null ? '—' : String(listener.pid)} />
        <Field label="systemd unit" value={listener.unit ?? '—'} />
        <Field
          label="Container"
          value={
            listener.containerName ??
            (listener.containerId ? listener.containerId.slice(0, 12) : '—')
          }
        />
        <Field
          label="Firewall"
          value={`${verdictLabel(listener.firewall)} · ${snapshot.firewall.backend}`}
        />
      </dl>

      {showSslContext && (
        <div className="mb-5 rounded-panel bg-bg-secondary p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">SSL</p>
          {sslCert ? (
            <>
              <p className="mt-2 font-mono text-xs text-text">{sslCert.primaryDomain}</p>
              <p className="mt-1 text-[11px] text-text-secondary">
                {sslCert.issuer ?? 'Unknown issuer'}
                {sslCert.daysRemaining !== null ? ` · ${sslCert.daysRemaining}d remaining` : ''}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-text-secondary">
              No certificate linked to this nginx listener was detected.
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() =>
              openWithIntent(serverId, {
                tool: 'ssl',
                domain: sslCert?.primaryDomain
              })
            }
          >
            Open in SSL
          </Button>
        </div>
      )}

      {firewallUnavailableReason ? (
        <div className="mb-5 rounded-panel bg-bg-secondary p-3">
          <p className="text-xs text-text">This port cannot be opened or closed from Relay</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {firewallUnavailableReason}
          </p>
        </div>
      ) : isSshPort ? (
        <p className="mb-5 rounded-panel bg-bg-secondary p-3 text-xs leading-relaxed text-text-secondary">
          This is the SSH port for this connection. Relay refuses firewall changes here to avoid
          locking you out — make them from the Terminal, where you can verify access first.
        </p>
      ) : null}

      <div className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">
          Matching firewall rules
        </p>
        {snapshot.firewall.unavailableReason ? (
          <p className="text-xs text-text-secondary">
            {snapshot.firewall.backend === 'none'
              ? 'There is no firewall on this server, so nothing filters this port.'
              : 'Relay could not read the ruleset, so matching rules are unknown.'}
          </p>
        ) : matchingRules.length === 0 ? (
          <p className="text-xs text-text-secondary">
            No rule matches this port. The default incoming policy applies.
          </p>
        ) : (
          <ul className="space-y-1">
            {matchingRules.map((rule) => (
              <li
                key={rule.id || rule.raw}
                className="flex items-center gap-3 border-b border-divider py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">
                  {rule.raw}
                </span>
                {snapshot.firewall.editable && rule.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-status-error hover:text-status-error"
                    disabled={actionLoading}
                    onClick={() => onRequestChange({ kind: 'delete', rule })}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={() =>
                onRequestChange({
                  kind: 'allow',
                  port: listener.port,
                  protocol: listener.protocol
                })
              }
            >
              Allow {listener.port}/{listener.protocol}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() =>
                onRequestChange({
                  kind: 'deny',
                  port: listener.port,
                  protocol: listener.protocol
                })
              }
            >
              Block {listener.port}/{listener.protocol}
            </Button>
          </>
        )}

        {looksLikeNginx(listener) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openWithIntent(serverId, { tool: 'nginx' })}
          >
            Open in Nginx
          </Button>
        )}
        {listener.unit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              openWithIntent(serverId, {
                tool: 'services',
                unit: listener.unit as string,
                view: 'detail'
              })
            }
          >
            Open in Services
          </Button>
        )}
        {listener.containerId && (
          <Button size="sm" variant="ghost" onClick={() => openTool(serverId, 'docker')}>
            Open in Docker
          </Button>
        )}
      </div>
    </div>
  )
}

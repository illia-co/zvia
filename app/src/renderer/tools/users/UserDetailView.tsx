import { useCallback, useEffect, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import type { UserDetail } from '@shared/users'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseRelayError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className={cn('min-w-0 flex-1 text-xs text-text', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function accountStatusLabel(status: UserDetail['accountStatus']): string {
  switch (status) {
    case 'locked':
      return 'Locked'
    case 'password':
      return 'Password set'
    case 'no-password':
      return 'No password'
    default:
      return 'Unknown'
  }
}

export type UserDetailAction =
  | 'edit'
  | 'changeShell'
  | 'groups'
  | 'lock'
  | 'unlock'
  | 'setPassword'
  | 'grantSudo'
  | 'revokeSudo'
  | 'enableSsh'
  | 'delete'

interface UserDetailViewProps {
  serverId: ServerId
  username: string
  adminGroup: string | null
  refreshToken: number
  actionLoading: boolean
  onAction: (action: UserDetailAction) => void
}

export function UserDetailView({
  serverId,
  username,
  adminGroup,
  refreshToken,
  actionLoading,
  onAction
}: UserDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<RelayErrorPayload | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await window.relay.users.get({ serverId, username }))
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setLoading(false)
    }
  }, [serverId, username])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail, refreshToken])

  if (loading && !detail) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading user…</p>
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorSurface error={error} onDismiss={() => setError(null)} />
      </div>
    )
  }

  if (!detail) {
    return <p className="p-6 text-center text-xs text-text-secondary">User not found.</p>
  }

  const sshPath = detail.sshAccess?.authorizedKeysPath ?? `${detail.home}/.ssh/authorized_keys`
  const canModify = !detail.protected

  return (
    <div className="h-full overflow-auto p-4">
      <dl className="mb-5">
        <Field label="Username" value={detail.username} mono />
        <Field label="UID / GID" value={`${detail.uid} / ${detail.gid}`} mono />
        <Field label="Kind" value={detail.kind === 'human' ? 'Human' : 'System'} />
        <Field label="GECOS" value={detail.gecos || '—'} />
        <Field label="Home" value={detail.home} mono />
        <Field label="Shell" value={detail.shell} mono />
        <Field label="Account" value={accountStatusLabel(detail.accountStatus)} />
        <Field label="Admin" value={detail.isAdmin ? `Yes (${adminGroup ?? 'sudo'})` : 'No'} />
        <Field label="Last login" value={detail.lastLogin ?? '—'} />
        <Field label="Groups" value={detail.groups.length > 0 ? detail.groups.join(', ') : '—'} mono />
        {detail.protected && (
          <Field label="Protected" value={detail.protectedReason ?? 'Protected account'} />
        )}
        {detail.sshAccess && (
          <>
            <Field label="SSH keys" value={String(detail.sshAccess.keyCount)} />
            {detail.sshAccess.fingerprints.map((entry) => (
              <Field
                key={`${entry.type}:${entry.fingerprint}`}
                label={entry.type}
                value={entry.fingerprint}
                mono
              />
            ))}
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'terminal' })}
        >
          Open Terminal
        </Button>
        {detail.kind === 'human' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              openWithIntent(serverId, { tool: 'files', path: sshPath })
            }
          >
            SSH keys in Files
          </Button>
        )}
        {canModify && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction('edit')}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction('changeShell')}
            >
              Change shell
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction('groups')}
            >
              Groups
            </Button>
            {detail.accountStatus === 'locked' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction('unlock')}
              >
                Unlock
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction('lock')}
              >
                Lock
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction('setPassword')}
            >
              Reset password
            </Button>
            {detail.isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction('revokeSudo')}
              >
                Revoke sudo
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction('grantSudo')}
              >
                Grant sudo
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction('enableSsh')}
            >
              Enable SSH
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={actionLoading}
              onClick={() => onAction('delete')}
            >
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

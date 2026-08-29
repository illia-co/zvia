import { useEffect, useMemo, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { UserDetail, UserSummary } from '@shared/users'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { elevationCommand, parseRelayError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useToolIntent } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { CreateUserDialog } from './CreateUserDialog'
import { EditUserDialog } from './EditUserDialog'
import {
  ChangeShellDialog,
  ConfirmUserActionDialog,
  DeleteUserDialog,
  EnableSshDialog,
  GroupsDialog,
  PasswordDialog
} from './UserActionDialogs'
import { UserDetailView, type UserDetailAction } from './UserDetailView'
import { UsersTable } from './UsersTable'
import { useUsers } from './useUsers'

type UserFilter = 'all' | 'human' | 'system'

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'human', label: 'Human' },
  { id: 'system', label: 'System' }
]

function matchesFilter(user: UserSummary, filter: UserFilter): boolean {
  if (filter === 'all') return true
  return user.kind === filter
}

export function UsersPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const openTool = useWorkspaceStore((state) => state.openTool)
  const intent = useToolIntent('users')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null)
  const [pendingAction, setPendingAction] = useState<UserDetailAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<RelayErrorPayload | null>(null)
  const [detailRefreshToken, setDetailRefreshToken] = useState(0)

  const isConnected = connectionState === 'connected'
  const { listing, available, loaded, loading, error, clearError, reload } = useUsers({
    serverId,
    isConnected,
    polling: selectedUsername === null
  })

  useEffect(() => {
    setSelectedUsername(null)
    setDetailUser(null)
    setActionError(null)
  }, [serverId])

  useEffect(() => {
    if (!intent?.username) return
    setSelectedUsername(intent.username)
  }, [intent])

  useEffect(() => {
    if (!selectedUsername || !isConnected) {
      setDetailUser(null)
      return
    }
    void window.relay.users
      .get({ serverId, username: selectedUsername })
      .then(setDetailUser)
      .catch(() => setDetailUser(null))
  }, [isConnected, selectedUsername, serverId, detailRefreshToken, listing.users])

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = listing.users.filter((user) => {
      if (!matchesFilter(user, filter)) return false
      if (!query) return true
      return [user.username, user.gecos, user.home, user.shell, String(user.uid)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

    const connected = listing.connectedUsername
    if (!connected) return filtered

    const connectedIndex = filtered.findIndex((user) => user.username === connected)
    if (connectedIndex <= 0) return filtered

    const connectedUser = filtered[connectedIndex]
    return [connectedUser, ...filtered.filter((_, index) => index !== connectedIndex)]
  }, [filter, listing.connectedUsername, listing.users, search])

  const runAction = async (action: Parameters<typeof window.relay.users.action>[0]['action']) => {
    setSubmitting(true)
    setActionError(null)
    try {
      await window.relay.users.action({ serverId, action })
      setPendingAction(null)
      setCreateOpen(false)
      setDetailRefreshToken((token) => token + 1)
      await reload()
    } catch (err) {
      setActionError(parseRelayError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDetailAction = (action: UserDetailAction): void => {
    if (action === 'lock' || action === 'unlock' || action === 'grantSudo' || action === 'revokeSudo') {
      setPendingAction(action)
      return
    }
    setPendingAction(action)
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to manage Linux users.
          </p>
        </div>
      </div>
    )
  }

  if (available === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-xs text-text-secondary">Checking for user management…</p>
      </div>
    )
  }

  if (!available) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-text">User management unavailable</p>
          <p className="mt-2 text-xs text-text-secondary">
            getent is not available on this server, so Relay cannot enumerate local users.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => openTool(serverId, 'terminal')}
          >
            Open Terminal
          </Button>
        </div>
      </div>
    )
  }

  const elevation = actionError ? elevationCommand(actionError) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedUsername ? (
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelectedUsername(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">{selectedUsername}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className="min-w-[140px] flex-1 rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none focus:border-text-tertiary"
          />
          <div className="flex items-center gap-1">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                  filter === option.id
                    ? 'bg-bg-secondary text-text'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
            New User
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
            Refresh
          </Button>
        </div>
      )}

      {(error || actionError) && (
        <div className="border-b border-divider p-3">
          {elevation && actionError ? (
            <ElevationRequired serverId={serverId} command={elevation} />
          ) : (
            <ErrorSurface
              error={actionError ?? error ?? ''}
              onDismiss={() => {
                setActionError(null)
                clearError()
              }}
            />
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {selectedUsername ? (
          <UserDetailView
            serverId={serverId}
            username={selectedUsername}
            adminGroup={listing.adminGroup}
            refreshToken={detailRefreshToken}
            actionLoading={submitting}
            onAction={handleDetailAction}
          />
        ) : (
          <UsersTable
            users={visibleUsers}
            loading={loading && !loaded}
            connectedUsername={listing.connectedUsername}
            onSelect={(user) => setSelectedUsername(user.username)}
          />
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        adminGroup={listing.adminGroup}
        submitting={submitting}
        onClose={() => setCreateOpen(false)}
        onSubmit={(values) =>
          void runAction({
            type: 'create',
            username: values.username,
            shell: values.shell,
            gecos: values.gecos || undefined,
            groups: values.groups.length > 0 ? values.groups : undefined,
            password: values.password || undefined,
            sudo: values.sudo,
            home: values.createHome
          })
        }
      />

      <EditUserDialog
        open={pendingAction === 'edit'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onSubmit={(values) =>
          void runAction({
            type: 'changeShell',
            username: detailUser?.username ?? '',
            shell: values.shell
          })
        }
      />

      <ChangeShellDialog
        open={pendingAction === 'changeShell'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={(shell) =>
          void runAction({
            type: 'changeShell',
            username: detailUser?.username ?? '',
            shell
          })
        }
      />

      <GroupsDialog
        open={pendingAction === 'groups'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={(addGroups, removeGroups) => {
          void (async () => {
            setSubmitting(true)
            setActionError(null)
            try {
              if (addGroups.length > 0) {
                await window.relay.users.action({
                  serverId,
                  action: {
                    type: 'addGroups',
                    username: detailUser?.username ?? '',
                    groups: addGroups
                  }
                })
              }
              if (removeGroups.length > 0) {
                await window.relay.users.action({
                  serverId,
                  action: {
                    type: 'removeGroups',
                    username: detailUser?.username ?? '',
                    groups: removeGroups
                  }
                })
              }
              setPendingAction(null)
              setDetailRefreshToken((token) => token + 1)
              await reload()
            } catch (err) {
              setActionError(parseRelayError(err))
            } finally {
              setSubmitting(false)
            }
          })()
        }}
      />

      <PasswordDialog
        open={pendingAction === 'setPassword'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={(password) =>
          void runAction({
            type: 'setPassword',
            username: detailUser?.username ?? '',
            password
          })
        }
      />

      <EnableSshDialog
        open={pendingAction === 'enableSsh'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={(publicKey) =>
          void runAction({
            type: 'enableSsh',
            username: detailUser?.username ?? '',
            publicKey: publicKey || undefined
          })
        }
      />

      <DeleteUserDialog
        open={pendingAction === 'delete'}
        user={detailUser}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={(removeHome) => {
          void (async () => {
            await runAction({
              type: 'delete',
              username: detailUser?.username ?? '',
              removeHome
            })
            setSelectedUsername(null)
          })()
        }}
      />

      <ConfirmUserActionDialog
        open={pendingAction === 'lock'}
        title="Lock user"
        description={`Lock the account for ${detailUser?.username}?`}
        command={`usermod -L ${detailUser?.username ?? ''}`}
        confirmLabel="Lock"
        destructive
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          void runAction({ type: 'lock', username: detailUser?.username ?? '' })
        }
      />

      <ConfirmUserActionDialog
        open={pendingAction === 'unlock'}
        title="Unlock user"
        description={`Unlock the account for ${detailUser?.username}?`}
        command={`usermod -U ${detailUser?.username ?? ''}`}
        confirmLabel="Unlock"
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          void runAction({ type: 'unlock', username: detailUser?.username ?? '' })
        }
      />

      <ConfirmUserActionDialog
        open={pendingAction === 'grantSudo'}
        title="Grant sudo"
        description={`Add ${detailUser?.username} to ${listing.adminGroup ?? 'sudo'}?`}
        command={`usermod -aG ${listing.adminGroup ?? 'sudo'} ${detailUser?.username ?? ''}`}
        confirmLabel="Grant sudo"
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          void runAction({ type: 'grantSudo', username: detailUser?.username ?? '' })
        }
      />

      <ConfirmUserActionDialog
        open={pendingAction === 'revokeSudo'}
        title="Revoke sudo"
        description={`Remove ${detailUser?.username} from ${listing.adminGroup ?? 'sudo'}?`}
        command={`gpasswd -d ${detailUser?.username ?? ''} ${listing.adminGroup ?? 'sudo'}`}
        confirmLabel="Revoke sudo"
        destructive
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          void runAction({ type: 'revokeSudo', username: detailUser?.username ?? '' })
        }
      />
    </div>
  )
}

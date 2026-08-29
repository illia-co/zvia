import type { UserSummary } from '@shared/users'
import { cn } from '@renderer/lib/utils'

function accountStatusLabel(status: UserSummary['accountStatus']): string {
  switch (status) {
    case 'locked':
      return 'Locked'
    case 'password':
      return 'Password'
    case 'no-password':
      return 'No password'
    default:
      return 'Unknown'
  }
}

function kindLabel(kind: UserSummary['kind']): string {
  return kind === 'human' ? 'Human' : 'System'
}

const ROW_LABEL_CLASS =
  'shrink-0 text-[10px] uppercase leading-none tracking-wider text-text-tertiary'

interface UsersTableProps {
  users: UserSummary[]
  loading: boolean
  connectedUsername: string
  onSelect: (user: UserSummary) => void
}

export function UsersTable({ users, loading, connectedUsername, onSelect }: UsersTableProps) {
  if (loading && users.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading users…</p>
  }

  if (users.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">No users match.</p>
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          <th className="px-3 py-2 font-medium">User</th>
          <th className="px-3 py-2 font-medium">UID</th>
          <th className="px-3 py-2 font-medium">Kind</th>
          <th className="px-3 py-2 font-medium">Account</th>
          <th className="px-3 py-2 font-medium">Admin</th>
          <th className="px-3 py-2 font-medium">Last login</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const isConnected = connectedUsername.length > 0 && user.username === connectedUsername
          return (
            <tr key={user.username} className="border-t border-divider">
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-left"
                  onClick={() => onSelect(user)}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      isConnected ? 'bg-status-healthy' : 'bg-text-tertiary'
                    )}
                    aria-hidden
                  />
                  <span className="font-medium text-text hover:underline">{user.username}</span>
                  {user.protected && <span className={ROW_LABEL_CLASS}>Protected</span>}
                </button>
              </td>
              <td className="px-3 py-2 font-mono text-text-secondary">{user.uid}</td>
              <td className="px-3 py-2 text-text-secondary">{kindLabel(user.kind)}</td>
              <td className="px-3 py-2 text-text-secondary">{accountStatusLabel(user.accountStatus)}</td>
              <td className="px-3 py-2 text-text-secondary">{user.isAdmin ? 'Yes' : '—'}</td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-text-secondary">
                {user.lastLogin ?? '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

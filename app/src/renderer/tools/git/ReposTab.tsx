import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitRepo, GitSummary } from '@shared/git'
import type { ServerId } from '@shared/server'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useNavigationStore, useToolIntent } from '@renderer/state/navigationStore'
import { parseZviaError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { RepoDetailView } from './RepoDetailView'

interface ReposTabProps {
  serverId: ServerId
  isConnected: boolean
}

interface RepoRow extends GitRepo {
  summary: GitSummary | null
}

function repoStateColor(row: RepoRow): string {
  if (!row.summary) return 'bg-text-tertiary'
  const { ahead, behind, dirty } = row.summary
  if ((ahead ?? 0) > 0 && (behind ?? 0) > 0) return 'bg-status-error'
  if (dirty || (behind ?? 0) > 0) return 'bg-status-warning'
  return 'bg-status-healthy'
}

function syncLabel(summary: GitSummary | null): string {
  if (!summary) return '—'
  const { ahead, behind, upstream } = summary
  if (!upstream) return 'no upstream'
  if ((ahead ?? 0) === 0 && (behind ?? 0) === 0) return 'up to date'
  const parts: string[] = []
  if ((ahead ?? 0) > 0) parts.push(`↑${ahead}`)
  if ((behind ?? 0) > 0) parts.push(`↓${behind}`)
  return parts.join(' ')
}

export function ReposTab({ serverId, isConnected }: ReposTabProps) {
  const [repos, setRepos] = useState<RepoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<RepoRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addPath, setAddPath] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const intent = useToolIntent('git')

  const loadRepos = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const found = await window.zvia.git.listRepos({ serverId })
      const rows = await Promise.all(
        found.map(async (repo): Promise<RepoRow> => {
          try {
            const summary = await window.zvia.git.summary({ serverId, path: repo.path })
            return { ...repo, summary }
          } catch {
            return { ...repo, summary: null }
          }
        })
      )
      setRepos(rows)
      setSelectedRepo((current) =>
        current ? (rows.find((row) => row.path === current.path) ?? null) : null
      )
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void loadRepos()
  }, [loadRepos])

  useEffect(() => {
    if (!isConnected || selectedRepo) {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
      return
    }
    refreshTimer.current = setInterval(() => {
      void loadRepos()
    }, 30000)
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [isConnected, selectedRepo, loadRepos])

  useEffect(() => {
    if (!intent?.path || repos.length === 0) return
    const match = repos.find((repo) => repo.path === intent.path)
    if (match) setSelectedRepo(match)
  }, [intent, repos])

  const runSyncAction = async (repo: GitRepo, action: 'fetch' | 'pull' | 'push'): Promise<void> => {
    setActionLoading(true)
    setError(null)
    try {
      const request = { serverId, path: repo.path }
      if (action === 'fetch') await window.zvia.git.fetch(request)
      if (action === 'pull') await window.zvia.git.pull(request)
      if (action === 'push') await window.zvia.git.push(request)
      await loadRepos()
    } catch (err) {
      const payload = parseZviaError(err)
      setError(payload.details ? `${payload.message}\n${payload.details}` : payload.message)
    } finally {
      setActionLoading(false)
    }
  }

  const confirmAdd = async (): Promise<void> => {
    const path = addPath.trim()
    if (!path) return
    setAddLoading(true)
    setError(null)
    try {
      await window.zvia.git.addRepo({ serverId, path })
      setAddOpen(false)
      setAddPath('')
      await loadRepos()
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setAddLoading(false)
    }
  }

  const openInFiles = (path: string): void => {
    openWithIntent(serverId, { tool: 'files', path })
  }

  const openInTerminal = (path: string): void => {
    openWithIntent(serverId, { tool: 'terminal', prefill: `cd '${path.replace(/'/g, `'\\''`)}' && ` })
  }

  if (selectedRepo) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelectedRepo(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">
            {selectedRepo.path}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <RepoDetailView
            serverId={serverId}
            repo={selectedRepo}
            onChanged={() => void loadRepos()}
            onOpenInFiles={() => openInFiles(selectedRepo.path)}
            onOpenInTerminal={() => openInTerminal(selectedRepo.path)}
          />
        </div>
      </div>
    )
  }

  const query = filter.trim().toLowerCase()
  const visible = query
    ? repos.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) || repo.path.toLowerCase().includes(query)
      )
    : repos

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter repositories…"
          className="min-w-0 flex-1"
        />
        <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          Add path
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void loadRepos()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && repos.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading repositories…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">
            {repos.length === 0
              ? 'No git repositories found.'
              : 'No repositories match the filter.'}
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">Repository</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Changes</th>
                <th className="px-3 py-2 font-medium">Sync</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((repo) => (
                <tr
                  key={repo.path}
                  className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
                  onClick={() => setSelectedRepo(repo)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('size-1.5 rounded-full', repoStateColor(repo))}
                        aria-hidden
                      />
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-medium text-text group-hover:underline">
                          {repo.name}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-text-tertiary">
                          {repo.path}
                          {repo.bare ? ' · bare' : ''}
                          {repo.source === 'manual' ? ' · manual' : ''}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {repo.summary?.branch ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {repo.summary
                      ? repo.summary.staged.length + repo.summary.unstaged.length + repo.summary.untracked.length === 0
                        ? 'clean'
                        : `+${repo.summary.staged.length} ~${repo.summary.unstaged.length} ?${repo.summary.untracked.length}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {syncLabel(repo.summary)}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => void runSyncAction(repo, 'fetch')}
                      >
                        Fetch
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading || repo.bare}
                        onClick={() => void runSyncAction(repo, 'pull')}
                      >
                        Pull
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => void runSyncAction(repo, 'push')}
                      >
                        Push
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openInFiles(repo.path)}>
                        Files
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add repository path</DialogTitle>
            <DialogDescription>
              Track a repository the automatic scan missed. The path must be a git work tree or
              bare repository on this server.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={addPath}
            onChange={(event) => setAddPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirmAdd()
            }}
            placeholder="/srv/my-app"
            className="w-full font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={addLoading || !addPath.trim()} onClick={() => void confirmAdd()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

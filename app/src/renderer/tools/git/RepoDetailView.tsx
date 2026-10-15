import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitPullStrategy, GitRepo, GitSummary } from '@shared/git'
import type { ServerId } from '@shared/server'
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
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'
import { parseZviaError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { CommitGraph, GRAPH_ROW_HEIGHT } from './CommitGraph'
import { layoutCommitGraph } from './gitGraph'

interface RepoDetailViewProps {
  serverId: ServerId
  repo: GitRepo
  onChanged: () => void
  onOpenInFiles: () => void
  onOpenInTerminal: () => void
}

type DetailTab = 'status' | 'history' | 'branches'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'history', label: 'History' },
  { id: 'branches', label: 'Branches' }
]

interface ActionError {
  title: string
  body: string | null
}

function toActionError(err: unknown): ActionError {
  const payload = parseZviaError(err)
  // COMMAND_ERROR humanizes to a generic sentence; keep the service message
  // (it carries what/where hints for pull conflicts and auth guidance).
  if (payload.code === 'COMMAND_ERROR') {
    return { title: payload.message, body: payload.details ?? null }
  }
  return { title: payload.message, body: payload.details ?? null }
}

export function RepoDetailView({ serverId, repo, onChanged, onOpenInFiles, onOpenInTerminal }: RepoDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('status')
  const [summary, setSummary] = useState<GitSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ActionError | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingPushForce, setPendingPushForce] = useState(false)
  const [branchInput, setBranchInput] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [stashMessage, setStashMessage] = useState('')
  const [pendingStashDrop, setPendingStashDrop] = useState<number | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await window.zvia.git.summary({ serverId, path: repo.path }))
    } catch (err) {
      setError(toActionError(err))
    } finally {
      setLoading(false)
    }
  }, [serverId, repo.path])

  useEffect(() => {
    setSummary(null)
    setActiveTab('status')
    void loadSummary()
  }, [loadSummary])

  const runAndReload = async (fn: () => Promise<void>): Promise<void> => {
    setActionLoading(true)
    setError(null)
    try {
      await fn()
      await loadSummary()
      onChanged()
    } catch (err) {
      setError(toActionError(err))
    } finally {
      setActionLoading(false)
    }
  }

  const pull = (strategy: GitPullStrategy): Promise<void> =>
    runAndReload(() => window.zvia.git.pull({ serverId, path: repo.path, strategy }))

  const push = (force: boolean): Promise<void> =>
    runAndReload(() => window.zvia.git.push({ serverId, path: repo.path, force }))

  const checkout = (branch: string): Promise<void> =>
    runAndReload(() => window.zvia.git.checkout({ serverId, path: repo.path, branch }))

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-divider px-3 py-2">
        <ServerScopeNotice />
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" disabled={actionLoading} onClick={() => void runAndReload(() => window.zvia.git.fetch({ serverId, path: repo.path }))}>
            Fetch
          </Button>
          <Button size="sm" variant="ghost" disabled={actionLoading || repo.bare} onClick={() => void pull('ff-only')}>
            Pull
          </Button>
          <Button size="sm" variant="ghost" disabled={actionLoading || repo.bare} onClick={() => void pull('rebase')}>
            Pull (rebase)
          </Button>
          <Button size="sm" variant="ghost" disabled={actionLoading} onClick={() => void push(false)}>
            Push
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-status-error hover:text-status-error"
            disabled={actionLoading}
            onClick={() => setPendingPushForce(true)}
          >
            Force push
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenInFiles}>
            Files
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenInTerminal}>
            Terminal
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={loading}
            onClick={() => void loadSummary()}
          >
            Refresh
          </Button>
        </div>
      </div>

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

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface
            error={{ code: 'INTERNAL_ERROR', message: error.title }}
            onDismiss={() => setError(null)}
          />
          {error.body && (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-bg p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
              {error.body}
            </pre>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && !summary ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading repository…</p>
        ) : !summary ? (
          <p className="p-6 text-center text-xs text-text-secondary">
            Could not load this repository.
          </p>
        ) : (
          <>
            {activeTab === 'status' && (
              <StatusTab
                serverId={serverId}
                repo={repo}
                summary={summary}
                actionLoading={actionLoading}
                branchInput={branchInput}
                setBranchInput={setBranchInput}
                stashMessage={stashMessage}
                setStashMessage={setStashMessage}
                onCheckout={(branch) => void checkout(branch)}
                onStashPushMessage={() =>
                  void runAndReload(() =>
                    window.zvia.git.stash({
                      serverId,
                      path: repo.path,
                      action: 'push',
                      ...(stashMessage.trim() ? { message: stashMessage.trim() } : {})
                    })
                  ).then(() => setStashMessage(''))
                }
                onStashPop={(index) =>
                  void runAndReload(() =>
                    window.zvia.git.stash({ serverId, path: repo.path, action: 'pop', index })
                  )
                }
                onStashApply={(index) =>
                  void runAndReload(() =>
                    window.zvia.git.stash({ serverId, path: repo.path, action: 'apply', index })
                  )
                }
                onStashDrop={(index) => setPendingStashDrop(index)}
              />
            )}
            {activeTab === 'history' && <HistoryTab summary={summary} />}
            {activeTab === 'branches' && (
              <BranchesTab
                summary={summary}
                actionLoading={actionLoading}
                createOpen={createOpen}
                setCreateOpen={setCreateOpen}
                newBranch={newBranch}
                setNewBranch={setNewBranch}
                onCheckout={(branch) => void checkout(branch)}
                onCreate={() =>
                  void (async () => {
                    const branch = newBranch.trim()
                    if (!branch) return
                    setCreateOpen(false)
                    setNewBranch('')
                    await runAndReload(() =>
                      window.zvia.git.createBranch({ serverId, path: repo.path, branch })
                    )
                  })()
                }
              />
            )}
          </>
        )}
      </div>

      <Dialog open={pendingPushForce} onOpenChange={setPendingPushForce}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force push?</DialogTitle>
            <DialogDescription>
              Rewrites history on the remote. Other clones of this repository can break. Are you
              sure?
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
            git push --force-with-lease
          </pre>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-text-tertiary">
            Runs on the remote server as {repo.path}
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingPushForce(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => {
                setPendingPushForce(false)
                void push(true)
              }}
            >
              Force push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingStashDrop !== null}
        onOpenChange={(open) => !open && setPendingStashDrop(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop stash?</DialogTitle>
            <DialogDescription>
              The stashed changes will be permanently deleted. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingStashDrop(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => {
                const index = pendingStashDrop
                setPendingStashDrop(null)
                if (index !== null) {
                  void runAndReload(() =>
                    window.zvia.git.stash({ serverId, path: repo.path, action: 'drop', index })
                  )
                }
              }}
            >
              Drop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
      {children}
    </h3>
  )
}

interface StatusTabProps {
  serverId: ServerId
  repo: GitRepo
  summary: GitSummary
  actionLoading: boolean
  branchInput: string
  setBranchInput: (value: string) => void
  stashMessage: string
  setStashMessage: (value: string) => void
  onCheckout: (branch: string) => void
  onStashPop: (index: number) => void
  onStashApply: (index: number) => void
  onStashDrop: (index: number) => void
  onStashPushMessage: () => void
}

function StatusTab(props: StatusTabProps) {
  const { summary } = props
  const changeCount = summary.staged.length + summary.unstaged.length + summary.untracked.length

  return (
    <div className="pb-6">
      <div className="border-b border-divider px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-text-secondary">
            Branch <span className="font-mono text-text">{summary.branch ?? '—'}</span>
          </span>
          {summary.upstream && (
            <span className="font-mono text-text-secondary">→ {summary.upstream}</span>
          )}
          {summary.upstream && (
            <span className="font-mono text-text-secondary">
              ↑{summary.ahead ?? 0} ↓{summary.behind ?? 0}
            </span>
          )}
          <span className="text-text-secondary">
            {changeCount === 0 ? 'Working tree clean' : `${changeCount} changed file(s)`}
            {summary.stashes.length > 0 ? ` · ${summary.stashes.length} stashe(s)` : ''}
          </span>
        </div>
      </div>

      <SectionTitle>Staged</SectionTitle>
      {summary.staged.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">Nothing staged.</p>
      ) : (
        <ul>
          {summary.staged.map((change) => (
            <li
              key={`s-${change.path}`}
              className="flex gap-2 border-t border-divider px-3 py-1.5 font-mono text-xs"
            >
              <span className="w-6 shrink-0 text-status-healthy">{change.status}</span>
              <span className="truncate text-text-secondary">{change.path}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Unstaged</SectionTitle>
      {summary.unstaged.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">Nothing modified.</p>
      ) : (
        <ul>
          {summary.unstaged.map((change) => (
            <li
              key={`u-${change.path}`}
              className="flex gap-2 border-t border-divider px-3 py-1.5 font-mono text-xs"
            >
              <span className="w-6 shrink-0 text-status-warning">{change.status}</span>
              <span className="truncate text-text-secondary">{change.path}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Untracked</SectionTitle>
      {summary.untracked.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">No untracked files.</p>
      ) : (
        <ul>
          {summary.untracked.map((path) => (
            <li
              key={`t-${path}`}
              className="border-t border-divider px-3 py-1.5 font-mono text-xs text-text-secondary"
            >
              ?? {path}
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Stash</SectionTitle>
      <div className="flex max-w-sm gap-2 px-3 py-1">
        <Input
          value={props.stashMessage}
          onChange={(event) => props.setStashMessage(event.target.value)}
          placeholder="Stash message (optional)…"
          className="min-w-0 flex-1"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={props.actionLoading || changeCount === 0}
          onClick={() => props.onStashPushMessage()}
        >
          Stash
        </Button>
      </div>
      {summary.stashes.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">No stashes.</p>
      ) : (
        <ul>
          {summary.stashes.map((stash) => (
            <li
              key={stash.index}
              className="flex items-center gap-2 border-t border-divider px-3 py-1.5 text-xs"
            >
              <span className="font-mono text-text-tertiary">stash@{'{'}{stash.index}{'}'}</span>
              <span className="min-w-0 flex-1 truncate text-text-secondary">{stash.message}</span>
              <Button size="sm" variant="ghost" disabled={props.actionLoading} onClick={() => props.onStashPop(stash.index)}>
                Pop
              </Button>
              <Button size="sm" variant="ghost" disabled={props.actionLoading} onClick={() => props.onStashApply(stash.index)}>
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-status-error hover:text-status-error"
                disabled={props.actionLoading}
                onClick={() => props.onStashDrop(stash.index)}
              >
                Drop
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Switch branch</SectionTitle>
      <div className="flex max-w-sm gap-2 px-3 py-1">
        <Input
          value={props.branchInput}
          onChange={(event) => props.setBranchInput(event.target.value)}
          placeholder="Branch name…"
          list="git-branches"
          className="min-w-0 flex-1 font-mono"
        />
        <datalist id="git-branches">
          {summary.branches.map((branch) => (
            <option key={branch.name} value={branch.name} />
          ))}
        </datalist>
        <Button
          size="sm"
          variant="ghost"
          disabled={props.actionLoading || !props.branchInput.trim()}
          onClick={() => {
            props.onCheckout(props.branchInput.trim())
            props.setBranchInput('')
          }}
        >
          Switch
        </Button>
      </div>
    </div>
  )
}

interface RefChip {
  label: string
  kind: 'head' | 'branch' | 'tag'
}

/** Splits `git log %D` output (`HEAD -> main, origin/main, tag: v1.2`) into chips. */
function parseRefChips(decorations: string): RefChip[] {
  if (!decorations.trim()) return []
  return decorations
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): RefChip => {
      if (part.startsWith('HEAD -> ') || part === 'HEAD') {
        return { label: part, kind: 'head' }
      }
      if (part.startsWith('tag: ')) {
        return { label: part.slice('tag: '.length), kind: 'tag' }
      }
      return { label: part, kind: 'branch' }
    })
}

function HistoryTab({ summary }: { summary: GitSummary }) {
  const graphRows = useMemo(() => layoutCommitGraph(summary.log), [summary.log])

  if (summary.log.length === 0) {
    return (
      <div className="pb-6">
        <SectionTitle>History</SectionTitle>
        <p className="px-3 py-1 text-xs text-text-tertiary">No commits yet.</p>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <SectionTitle>History</SectionTitle>
      <div className="flex gap-2 px-3">
        <CommitGraph
          rows={graphRows}
          highlights={
            new Set(
              summary.log
                .map((entry, index) =>
                  parseRefChips(entry.decorations).some((chip) => chip.kind === 'head')
                    ? index
                    : -1
                )
                .filter((index) => index !== -1)
            )
          }
        />
        <ul className="min-w-0 flex-1">
          {summary.log.map((entry) => {
            const chips = parseRefChips(entry.decorations)
            return (
              <li
                key={entry.hash}
                className="flex items-center border-t border-divider py-1 first:border-t-0"
                style={{ height: GRAPH_ROW_HEIGHT }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {chips.map((chip) => (
                      <span
                        key={chip.label}
                        className={cn(
                          'shrink-0 rounded-sm bg-bg-secondary px-1 py-px font-mono text-[10px]',
                          chip.kind === 'head' && 'text-status-healthy',
                          chip.kind === 'tag' && 'text-status-warning',
                          chip.kind === 'branch' && 'text-text-secondary'
                        )}
                      >
                        {chip.label}
                      </span>
                    ))}
                    <span className="min-w-0 flex-1 truncate text-xs text-text">
                      {entry.subject}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-text-tertiary">
                    {entry.shortHash} · {entry.author} · {entry.date}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

interface BranchesTabProps {
  summary: GitSummary
  actionLoading: boolean
  createOpen: boolean
  setCreateOpen: (open: boolean) => void
  newBranch: string
  setNewBranch: (value: string) => void
  onCheckout: (branch: string) => void
  onCreate: () => void
}

function BranchesTab(props: BranchesTabProps) {
  const { summary } = props
  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Branches
        </h3>
        <Button size="sm" variant="ghost" onClick={() => props.setCreateOpen(true)}>
          New branch
        </Button>
      </div>
      {summary.branches.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">No branches.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="px-3 py-2 font-medium">Branch</th>
              <th className="px-3 py-2 font-medium">Upstream</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {summary.branches.map((branch) => (
              <tr key={branch.name} className="border-t border-divider">
                <td className="px-3 py-2 font-mono text-text">
                  {branch.current && <span className="mr-1.5 text-status-healthy">*</span>}
                  {branch.name}
                </td>
                <td className="px-3 py-2 font-mono text-text-secondary">
                  {branch.upstream ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {!branch.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={props.actionLoading}
                      onClick={() => props.onCheckout(branch.name)}
                    >
                      Switch
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SectionTitle>Remotes</SectionTitle>
      {summary.remotes.length === 0 ? (
        <p className="px-3 py-1 text-xs text-text-tertiary">No remotes configured.</p>
      ) : (
        <ul>
          {summary.remotes.map((remote) => (
            <li key={remote.name} className="border-t border-divider px-3 py-1.5 text-xs">
              <span className="font-mono text-text">{remote.name}</span>
              <span className="block truncate font-mono text-[10px] text-text-tertiary">
                {remote.fetchUrl}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={props.createOpen} onOpenChange={props.setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New branch</DialogTitle>
            <DialogDescription>
              Created from the current HEAD. Switch to it afterwards with Switch.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={props.newBranch}
            onChange={(event) => props.setNewBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') props.onCreate()
            }}
            placeholder="feature/my-change"
            className="w-full font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => props.setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!props.newBranch.trim()} onClick={props.onCreate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

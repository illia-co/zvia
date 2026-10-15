import { posix } from 'node:path'
import type { ServerId } from '@shared/server'
import type {
  GitPullStrategy,
  GitRepo,
  GitStashAction,
  GitSummary
} from '@shared/git'
import { CommandError, GitUnavailableError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { getServerConnection, shellQuote } from './ServiceBase'
import {
  GIT_FIELD_SEP,
  conflictedPaths,
  isAuthFailure,
  isNonFastForward,
  parseAheadBehind,
  parseBranches,
  parseLogRecords,
  parsePorcelainStatus,
  parseRemotes,
  parseStashList
} from './gitParsers'

const SCAN_ROOTS = ['~', '/opt', '/srv', '/var/www', '/home']
const SCAN_MAX_DEPTH = 4
const SCAN_TIMEOUT_MS = 30000

const AUTH_GUIDANCE =
  'The server has no SSH key accepted by this remote. Generate one on the server ' +
  '(ssh-keygen -t ed25519), add the public key to the git host, then verify with ' +
  '`ssh -T git@<host>` in the Terminal tool and retry.'

const basename = (path: string): string => posix.basename(path) || path

export class GitService {
  private availabilityCache = new Map<string, { available: boolean; checkedAt: number }>()
  private manualRepos = new Map<ServerId, Set<string>>()

  private getConnection(serverId: ServerId) {
    return getServerConnection(serverId)
  }

  private async exec(serverId: ServerId, command: string, timeoutMs = 20000) {
    return this.getConnection(serverId).exec(command, timeoutMs)
  }

  private gitDir(path: string): string {
    return `git -C ${shellQuote(path)}`
  }

  async isAvailable(serverId: ServerId): Promise<boolean> {
    const cached = this.availabilityCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < 5000) {
      return cached.available
    }
    try {
      const result = await this.exec(serverId, 'git --version 2>/dev/null', 10000)
      const available = result.exitCode === 0 && /git version/i.test(result.stdout)
      this.availabilityCache.set(serverId, { available, checkedAt: Date.now() })
      return available
    } catch {
      this.availabilityCache.set(serverId, { available: false, checkedAt: Date.now() })
      return false
    }
  }

  private async ensureAvailable(serverId: ServerId): Promise<void> {
    if (await this.isAvailable(serverId)) return
    throw new GitUnavailableError(
      'Git is not installed or not on PATH for this SSH user.',
      'Install git on the server (e.g. `apt-get install -y git`) and retry.'
    )
  }

  /**
   * Verifies a path is a git repo work tree (or bare dir). Rejects everything
   * else so renderer input can never turn into arbitrary `git -C` targets.
   */
  private async assertRepo(serverId: ServerId, path: string): Promise<{ bare: boolean }> {
    await this.ensureAvailable(serverId)
    const result = await this.exec(
      serverId,
      `${this.gitDir(path)} rev-parse --is-bare-repository 2>&1`,
      15000
    )
    const output = (result.stdout || result.stderr).trim()
    if (result.exitCode !== 0 || !/^(true|false)$/.test(output)) {
      throw new ValidationError('Invalid repo path: not a git repository on this server', path)
    }
    return { bare: output === 'true' }
  }

  async listRepos(serverId: ServerId): Promise<GitRepo[]> {
    await this.ensureAvailable(serverId)
    const roots = SCAN_ROOTS.map((root) => shellQuote(root)).join(' ')
    const findCommand = [
      `for root in ${roots}; do`,
      `  eval_dir=$(eval echo "$root");`,
      `  [ -d "$eval_dir" ] || continue;`,
      `  find "$eval_dir" -maxdepth ${SCAN_MAX_DEPTH} -name HEAD -path '*/.git/HEAD' 2>/dev/null;`,
      `  find "$eval_dir" -maxdepth 2 -name HEAD -maxdepth 2 2>/dev/null | grep -v '/\\.git/' || true;`,
      `done`
    ].join(' ')
    const result = await this.exec(serverId, findCommand, SCAN_TIMEOUT_MS)
    const candidates = new Set<string>()
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // `.../.git/HEAD` → work tree; bare `.../HEAD` → repo dir itself.
      if (trimmed.endsWith('/.git/HEAD')) {
        candidates.add(trimmed.slice(0, -'/.git/HEAD'.length) || '/')
      } else if (trimmed.endsWith('/HEAD')) {
        candidates.add(trimmed.slice(0, -'/HEAD'.length) || '/')
      }
    }
    for (const manual of this.manualRepos.get(serverId) ?? []) {
      candidates.add(manual)
    }

    const repos: GitRepo[] = []
    const manual = this.manualRepos.get(serverId) ?? new Set<string>()
    for (const candidate of candidates) {
      try {
        const { bare } = await this.assertRepo(serverId, candidate)
        repos.push({
          path: candidate,
          name: basename(candidate),
          bare,
          source: manual.has(candidate) ? 'manual' : 'scan'
        })
      } catch {
        // Not a repo (stale manual entry, permission denied, transient) — skip.
      }
    }
    repos.sort((a, b) => a.path.localeCompare(b.path))
    return repos
  }

  async addRepo(serverId: ServerId, path: string): Promise<GitRepo> {
    const { bare } = await this.assertRepo(serverId, path)
    let manual = this.manualRepos.get(serverId)
    if (!manual) {
      manual = new Set<string>()
      this.manualRepos.set(serverId, manual)
    }
    manual.add(path)
    return { path, name: basename(path), bare, source: 'manual' }
  }

  async removeRepo(serverId: ServerId, path: string): Promise<void> {
    // Only forgets manually added paths; scanned repos reappear on next scan.
    this.manualRepos.get(serverId)?.delete(path)
    await this.ensureAvailable(serverId)
  }

  async summary(serverId: ServerId, path: string): Promise<GitSummary> {
    const { bare } = await this.assertRepo(serverId, path)
    const g = this.gitDir(path)
    const command = [
      `echo '---ZVIA:GIT:STATUS---'; ${g} status --porcelain=v1 -b -uall 2>&1`,
      `echo '---ZVIA:GIT:STASH---'; ${g} stash list 2>&1`,
      `echo '---ZVIA:GIT:BRANCH---'; ${g} branch -vv --no-color 2>&1`,
      `echo '---ZVIA:GIT:REMOTE---'; ${g} remote -v 2>&1`,
      `echo '---ZVIA:GIT:COUNT---'; ${g} rev-list --left-right --count 'HEAD...@{upstream}' 2>/dev/null`,
      `echo '---ZVIA:GIT:LOG---'; ${g} log --format='%H${GIT_FIELD_SEP}%h${GIT_FIELD_SEP}%an${GIT_FIELD_SEP}%ad${GIT_FIELD_SEP}%D${GIT_FIELD_SEP}%s${GIT_FIELD_SEP}%P' --date=iso -n 50 2>&1`
    ].join('; ')

    const result = await this.exec(serverId, command, 20000)
    const markers = [
      '---ZVIA:GIT:STATUS---',
      '---ZVIA:GIT:STASH---',
      '---ZVIA:GIT:BRANCH---',
      '---ZVIA:GIT:REMOTE---',
      '---ZVIA:GIT:COUNT---',
      '---ZVIA:GIT:LOG---'
    ]
    const sections: Record<string, string> = {}
    for (let i = 0; i < markers.length; i++) {
      const startIndex = result.stdout.indexOf(markers[i])
      if (startIndex === -1) {
        sections[markers[i]] = ''
        continue
      }
      const from = startIndex + markers[i].length
      const endIndex = i + 1 < markers.length ? result.stdout.indexOf(markers[i + 1], from) : -1
      sections[markers[i]] = endIndex === -1 ? result.stdout.slice(from) : result.stdout.slice(from, endIndex)
    }
    const section = (name: string): string => sections[name] ?? ''
    const status = parsePorcelainStatus(section('---ZVIA:GIT:STATUS---'))
    const stashes = parseStashList(section('---ZVIA:GIT:STASH---'))
    const branches = parseBranches(section('---ZVIA:GIT:BRANCH---'))
    const remotes = parseRemotes(section('---ZVIA:GIT:REMOTE---'))
    const count = parseAheadBehind(section('---ZVIA:GIT:COUNT---'))
    const log = parseLogRecords(section('---ZVIA:GIT:LOG---'))

    const dirty =
      status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0
    return {
      path,
      branch: bare ? null : status.branch,
      upstream: status.upstream,
      ahead: count?.ahead ?? status.ahead,
      behind: count?.behind ?? status.behind,
      dirty: dirty || stashes.length > 0,
      staged: status.staged,
      unstaged: status.unstaged,
      untracked: status.untracked,
      stashes,
      branches,
      remotes,
      log
    }
  }

  private authOrCommandError(operation: string, output: string): CommandError {
    if (isAuthFailure(output)) {
      return new CommandError(`${operation} failed: no SSH key accepted by the remote`, `${output}\n\n${AUTH_GUIDANCE}`)
    }
    return new CommandError(`${operation} failed`, output)
  }

  async fetch(serverId: ServerId, path: string): Promise<void> {
    await this.assertRepo(serverId, path)
    const result = await this.exec(serverId, `${this.gitDir(path)} fetch --prune 2>&1`, 120000)
    if (result.exitCode !== 0) {
      throw this.authOrCommandError('Fetch', result.stdout.trim())
    }
  }

  async pull(serverId: ServerId, path: string, strategy: GitPullStrategy = 'ff-only'): Promise<void> {
    const { bare } = await this.assertRepo(serverId, path)
    if (bare) {
      throw new ValidationError('Cannot pull into a bare repository', path)
    }
    const flag = strategy === 'rebase' ? '--rebase' : '--ff-only'
    const result = await this.exec(
      serverId,
      `${this.gitDir(path)} pull ${flag} 2>&1`,
      120000
    )
    if (result.exitCode === 0) return
    const output = result.stdout.trim()
    if (isAuthFailure(output)) {
      throw this.authOrCommandError('Pull', output)
    }
    // Non-fast-forward or conflicts: attach formatted hints (what/where/next).
    const summary = await this.summary(serverId, path).catch(() => null)
    const conflicted = summary ? conflictedPaths(summary.staged, summary.unstaged) : []
    const hints = [
      output,
      '',
      isNonFastForward(output)
        ? `Local ${summary?.branch ?? 'branch'} and ${summary?.upstream ?? 'upstream'} have diverged.`
        : 'The pull did not complete cleanly.',
      conflicted.length > 0
        ? `Conflicted files:\n${conflicted.map((file) => `  - ${file}`).join('\n')}`
        : summary && (summary.staged.length > 0 || summary.unstaged.length > 0)
          ? 'Uncommitted changes are blocking the pull. Stash or commit them first.'
          : null,
      'Resolve in the Terminal tool:',
      '  git status            # what and where',
      '  git stash push -m wip # park local changes (optional)',
      '  git pull --rebase     # replay local commits on top',
      '  # fix conflicts, then: git add <files> && git rebase --continue'
    ]
      .filter((line): line is string => line !== null)
      .join('\n')
    throw new CommandError('Pull did not complete', hints)
  }

  async push(serverId: ServerId, path: string, force = false): Promise<void> {
    await this.assertRepo(serverId, path)
    const flag = force ? '--force-with-lease' : ''
    const result = await this.exec(
      serverId,
      `${this.gitDir(path)} push ${flag} 2>&1`.trim(),
      120000
    )
    if (result.exitCode !== 0) {
      throw this.authOrCommandError('Push', result.stdout.trim())
    }
  }

  async checkout(serverId: ServerId, path: string, branch: string): Promise<void> {
    const { bare } = await this.assertRepo(serverId, path)
    if (bare) {
      throw new ValidationError('Cannot check out a branch in a bare repository', path)
    }
    const summary = await this.summary(serverId, path)
    if (summary.staged.length > 0 || summary.unstaged.length > 0) {
      throw new ValidationError(
        'Uncommitted changes would be overwritten by checkout',
        'Stash or commit the changes listed in the Status tab first.'
      )
    }
    const exists = summary.branches.some((entry) => entry.name === branch)
    const args = exists ? `switch ${shellQuote(branch)}` : `switch -c ${shellQuote(branch)}`
    const result = await this.exec(serverId, `${this.gitDir(path)} ${args} 2>&1`, 30000)
    if (result.exitCode !== 0) {
      throw new CommandError('Checkout failed', result.stdout.trim())
    }
  }

  async createBranch(serverId: ServerId, path: string, branch: string, startPoint?: string): Promise<void> {
    await this.assertRepo(serverId, path)
    const args =
      startPoint !== undefined
        ? `branch ${shellQuote(branch)} ${shellQuote(startPoint)}`
        : `branch ${shellQuote(branch)}`
    const result = await this.exec(serverId, `${this.gitDir(path)} ${args} 2>&1`, 30000)
    if (result.exitCode !== 0) {
      throw new CommandError('Create branch failed', result.stdout.trim())
    }
  }

  async stash(serverId: ServerId, path: string, action: GitStashAction, message?: string, index?: number): Promise<void> {
    await this.assertRepo(serverId, path)
    const ref = index !== undefined ? `stash@{${index}}` : ''
    let args: string
    if (action === 'pop') args = `stash pop ${ref}`.trim()
    else if (action === 'apply') args = `stash apply ${ref}`.trim()
    else if (index !== undefined) args = `stash drop ${shellQuote(ref)}`
    else args = message ? `stash push -m ${shellQuote(message)}` : 'stash push'
    const result = await this.exec(serverId, `${this.gitDir(path)} ${args} 2>&1`, 30000)
    if (result.exitCode !== 0) {
      throw new CommandError(`Stash ${action} failed`, result.stdout.trim())
    }
  }

  stopAllForServer(serverId: ServerId): void {
    this.availabilityCache.delete(serverId)
    this.manualRepos.delete(serverId)
  }
}

export const gitService = new GitService()
connectionManager.registerTeardown((serverId) => gitService.stopAllForServer(serverId))

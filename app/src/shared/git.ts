/** Shared Git domain model. All paths are absolute server-side paths. */

export interface GitRepo {
  /** Absolute path of the work tree (or the `.git` dir for bare repos). */
  path: string
  /** Last path segment, e.g. `zvia` for `/srv/zvia`. */
  name: string
  /** True for bare repos (`--is-bare-repository`). */
  bare: boolean
  /** How the repo was found: auto-scan or added manually. */
  source: 'scan' | 'manual'
}

export interface GitFileChange {
  /** Porcelain XY status, e.g. `M `, ` M`, `??`. */
  status: string
  path: string
}

export interface GitBranchInfo {
  name: string
  current: boolean
  upstream: string | null
}

export interface GitStashEntry {
  index: number
  message: string
}

export interface GitRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface GitLogEntry {
  hash: string
  shortHash: string
  author: string
  date: string
  subject: string
  /** Decorations like `HEAD -> main, origin/main`. Empty when none. */
  decorations: string
  /** Parent commit hashes (space-separated `%P`). Empty for root commits. */
  parents: string[]
}

export interface GitSummary {
  path: string
  branch: string | null
  upstream: string | null
  /** Commits ahead/behind the upstream. Null when no upstream. */
  ahead: number | null
  behind: number | null
  /** True when anything is staged/unstaged/untracked or stash exists. */
  dirty: boolean
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
  /** `git stash list` entries. */
  stashes: GitStashEntry[]
  branches: GitBranchInfo[]
  remotes: GitRemote[]
  /** Recent commits, newest first. */
  log: GitLogEntry[]
}

export type GitPullStrategy = 'ff-only' | 'rebase'

export type GitStashAction = 'push' | 'pop' | 'apply' | 'drop'

import type {
  GitBranchInfo,
  GitFileChange,
  GitLogEntry,
  GitRemote,
  GitStashEntry
} from '@shared/git'

/** Unit separator used in `git log --format` templates. Never appears in hashes. */
export const GIT_FIELD_SEP = ''

/**
 * Parses `git status --porcelain=v1 -b` output.
 * First line is the branch header (`## main...origin/main [ahead 1]`).
 */
export function parsePorcelainStatus(
  stdout: string
): { branch: string | null; upstream: string | null; ahead: number | null; behind: number | null; staged: GitFileChange[]; unstaged: GitFileChange[]; untracked: string[] } {
  let branch: string | null = null
  let upstream: string | null = null
  let ahead: number | null = null
  let behind: number | null = null
  const staged: GitFileChange[] = []
  const unstaged: GitFileChange[] = []
  const untracked: string[] = []

  for (const rawLine of stdout.split('\n')) {
    if (!rawLine) continue
    if (rawLine.startsWith('## ')) {
      const header = rawLine.slice(3)
      // `main...origin/main [ahead 2, behind 1]`, `main`, `HEAD (no branch)`.
      const branchMatch = /^(?:Initial commit on )?([^\s.]+?)(?:\.\.\.(\S+?))?(?:\s+\[(.+)\])?$/.exec(
        header
      )
      if (branchMatch) {
        branch = branchMatch[1] === 'HEAD' ? null : branchMatch[1]
        upstream = branchMatch[2] ?? null
        const tracking = branchMatch[3] ?? ''
        const aheadMatch = /ahead (\d+)/.exec(tracking)
        const behindMatch = /behind (\d+)/.exec(tracking)
        ahead = aheadMatch ? Number.parseInt(aheadMatch[1], 10) : upstream ? 0 : null
        behind = behindMatch ? Number.parseInt(behindMatch[1], 10) : upstream ? 0 : null
      }
      continue
    }
    if (rawLine.length < 4) continue
    const x = rawLine[0]
    const y = rawLine[1]
    // Renames carry `old -> new`; keep the display path intact.
    const path = rawLine.slice(3).trim()
    if (x === '?' && y === '?') {
      untracked.push(path.replace(/^"|"$/g, ''))
      continue
    }
    if (x !== ' ' && x !== '?') staged.push({ status: `${x} `, path })
    if (y !== ' ' && y !== '?') unstaged.push({ status: ` ${y}`, path })
  }

  return { branch, upstream, ahead, behind, staged, unstaged, untracked }
}

/** Parses `git stash list` (`stash@{0}: WIP on main: abc1234 msg`). */
export function parseStashList(stdout: string): GitStashEntry[] {
  const entries: GitStashEntry[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^stash@\{(\d+)\}:\s*(.+)$/.exec(line)
    if (!match) continue
    entries.push({ index: Number.parseInt(match[1], 10), message: match[2] })
  }
  return entries
}

/** Parses `git branch -vv --no-color` output. Current branch has `* ` prefix. */
export function parseBranches(stdout: string): GitBranchInfo[] {
  const branches: GitBranchInfo[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line) continue
    const current = line.startsWith('* ')
    const rest = (current ? line.slice(2) : line).trim()
    const nameMatch = /^(\S+)\s+/.exec(rest)
    if (!nameMatch) continue
    const name = nameMatch[1]
    if (name === '(HEAD' || name === '(no') continue
    const upstreamMatch = /\[([^\]:]+)(?::[^\]]*)?\]/.exec(rest)
    branches.push({ name, current, upstream: upstreamMatch ? upstreamMatch[1] : null })
  }
  return branches
}

/** Parses `git remote -v` (`origin\tgit@host:x.git (fetch)`). */
export function parseRemotes(stdout: string): GitRemote[] {
  const byName = new Map<string, GitRemote>()
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line)
    if (!match) continue
    const existing = byName.get(match[1]) ?? { name: match[1], fetchUrl: '', pushUrl: '' }
    if (match[3] === 'fetch') existing.fetchUrl = match[2]
    else existing.pushUrl = match[2]
    byName.set(match[1], existing)
  }
  return [...byName.values()]
}

/**
 * Parses unit-separator-delimited `git log` records:
 * `%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1f%P` with `--date=iso`.
 * The trailing `%P` field holds space-separated parent hashes (empty for roots).
 * Records without it (6 fields) are accepted with `parents: []`.
 */
export function parseLogRecords(stdout: string): GitLogEntry[] {
  const entries: GitLogEntry[] = []
  for (const rawLine of stdout.split('\n')) {
    if (!rawLine) continue
    const fields = rawLine.split(GIT_FIELD_SEP)
    if (fields.length < 6) continue
    const parentsField = fields[6] ?? ''
    entries.push({
      hash: fields[0],
      shortHash: fields[1],
      author: fields[2],
      date: fields[3],
      decorations: fields[4],
      subject: fields[5],
      parents: parentsField.split(' ').map((parent) => parent.trim()).filter(Boolean)
    })
  }
  return entries
}

/** Ahead/behind from `git rev-list --left-right --count HEAD...@{upstream}`. */
export function parseAheadBehind(stdout: string): { ahead: number; behind: number } | null {
  const match = /^\s*(\d+)\s+(\d+)/.exec(stdout.trim())
  if (!match) return null
  return { ahead: Number.parseInt(match[1], 10), behind: Number.parseInt(match[2], 10) }
}

/** True when stderr indicates missing SSH credentials for the remote. */
export function isAuthFailure(output: string): boolean {
  return /permission denied \(publickey\)|authentication failed|could not read from remote|host key verification failed|permission denied \(password\)/i.test(
    output
  )
}

/** True when pull failed because the branches diverged (non-fast-forward). */
export function isNonFastForward(output: string): boolean {
  return /non-fast-forward|need to merge|divergent branches|have diverged|non fast-forward/i.test(
    output
  )
}

/** Names of conflicted files from `git status --porcelain` (UD/DU/AA/DD/UU). */
export function conflictedPaths(
  staged: GitFileChange[],
  unstaged: GitFileChange[]
): string[] {
  const conflicted = new Set<string>()
  for (const change of [...staged, ...unstaged]) {
    const code = change.status.replace(/ /g, '')
    if (code === 'UD' || code === 'DU' || code === 'AA' || code === 'DD' || code === 'UU') {
      conflicted.add(change.path)
    }
  }
  return [...conflicted]
}

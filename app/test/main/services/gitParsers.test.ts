import { describe, expect, it } from 'vitest'
import {
  conflictedPaths,
  GIT_FIELD_SEP,
  isAuthFailure,
  isNonFastForward,
  parseAheadBehind,
  parseBranches,
  parseLogRecords,
  parsePorcelainStatus,
  parseRemotes,
  parseStashList
} from '@main/services/gitParsers'

const PORCELAIN = [
  '## main...origin/main [ahead 2, behind 1]',
  'M  staged-file.ts',
  ' M unstaged-file.ts',
  '?? new-file.ts',
  'UU conflicted.ts'
].join('\n')

describe('parsePorcelainStatus', () => {
  it('extracts branch, upstream, ahead/behind and change buckets', () => {
    const result = parsePorcelainStatus(PORCELAIN)
    expect(result.branch).toBe('main')
    expect(result.upstream).toBe('origin/main')
    expect(result.ahead).toBe(2)
    expect(result.behind).toBe(1)
    expect(result.staged).toHaveLength(2)
    expect(result.unstaged).toHaveLength(2)
    expect(result.untracked).toEqual(['new-file.ts'])
  })

  it('handles repos without upstream', () => {
    const result = parsePorcelainStatus('## main\n M a.ts')
    expect(result.branch).toBe('main')
    expect(result.upstream).toBeNull()
    expect(result.ahead).toBeNull()
  })
})

describe('parseStashList', () => {
  it('parses stash entries with indices', () => {
    const result = parseStashList('stash@{0}: WIP on main: abc1234 my work\nstash@{1}: On main: other')
    expect(result).toEqual([
      { index: 0, message: 'WIP on main: abc1234 my work' },
      { index: 1, message: 'On main: other' }
    ])
  })
})

describe('parseBranches', () => {
  it('marks current branch and upstreams', () => {
    const result = parseBranches('* main abc1234 [origin/main] msg\n  feature def5678 msg')
    expect(result).toEqual([
      { name: 'main', current: true, upstream: 'origin/main' },
      { name: 'feature', current: false, upstream: null }
    ])
  })
})

describe('parseRemotes', () => {
  it('merges fetch/push urls per remote', () => {
    const result = parseRemotes(
      'origin\tgit@github.com:acme/app.git (fetch)\norigin\tgit@github.com:acme/app.git (push)'
    )
    expect(result).toEqual([
      { name: 'origin', fetchUrl: 'git@github.com:acme/app.git', pushUrl: 'git@github.com:acme/app.git' }
    ])
  })
})

describe('parseLogRecords', () => {
  const record = (...fields: string[]): string => fields.join(GIT_FIELD_SEP)

  it('splits unit-separator fields including parents', () => {
    const result = parseLogRecords(
      record('abc123', 'abc1234', 'Jane', '2026-01-01', 'HEAD -> main', 'Init', 'parent1')
    )
    expect(result).toEqual([
      {
        hash: 'abc123',
        shortHash: 'abc1234',
        author: 'Jane',
        date: '2026-01-01',
        decorations: 'HEAD -> main',
        subject: 'Init',
        parents: ['parent1']
      }
    ])
  })

  it('parses merge commits with two parents and roots with none', () => {
    const lines = [
      record('m1', 'm1short', 'Jane', '2026-01-03', '', 'Merge branch', 'p1 p2'),
      record('r1', 'r1short', 'Jane', '2026-01-01', '', 'Root', '')
    ].join('\n')
    const result = parseLogRecords(lines)
    expect(result[0].parents).toEqual(['p1', 'p2'])
    expect(result[1].parents).toEqual([])
  })

  it('accepts legacy six-field records without parents', () => {
    const result = parseLogRecords(
      record('abc123', 'abc1234', 'Jane', '2026-01-01', 'HEAD -> main', 'Init')
    )
    expect(result[0].parents).toEqual([])
  })
})

describe('parseAheadBehind', () => {
  it('parses rev-list counts', () => {
    expect(parseAheadBehind('2\t1\n')).toEqual({ ahead: 2, behind: 1 })
    expect(parseAheadBehind('')).toBeNull()
  })
})

describe('auth and divergence detection', () => {
  it('detects SSH auth failures', () => {
    expect(isAuthFailure('git@github.com: Permission denied (publickey).')).toBe(true)
    expect(isAuthFailure('Everything up-to-date')).toBe(false)
  })

  it('detects non-fast-forward pulls', () => {
    expect(isNonFastForward('rejected: non-fast-forward')).toBe(true)
    expect(isNonFastForward('Already up to date.')).toBe(false)
  })

  it('collects conflicted paths', () => {
    expect(
      conflictedPaths([{ status: 'UU', path: 'a.ts' }], [{ status: ' M', path: 'b.ts' }])
    ).toEqual(['a.ts'])
  })
})

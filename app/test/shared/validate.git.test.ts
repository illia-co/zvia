import { describe, expect, it } from 'vitest'
import {
  validateGitCheckoutRequest,
  validateGitCreateBranchRequest,
  validateGitPullRequest,
  validateGitPushRequest,
  validateGitRepoRequest,
  validateGitStashRequest,
  validatePermissionsSetChoicesRequest
} from '@shared/validate'

describe('validateGitRepoRequest', () => {
  it('accepts absolute paths', () => {
    expect(validateGitRepoRequest({ serverId: 's1', path: '/srv/app' })).toMatchObject({
      serverId: 's1',
      path: '/srv/app'
    })
  })

  it('rejects relative and parent-segment paths', () => {
    expect(() => validateGitRepoRequest({ serverId: 's1', path: 'srv/app' })).toThrow()
    expect(() => validateGitRepoRequest({ serverId: 's1', path: '/srv/../etc' })).toThrow()
  })
})

describe('validateGitPullRequest', () => {
  it('defaults strategy and accepts rebase', () => {
    expect(validateGitPullRequest({ serverId: 's1', path: '/srv/app' }).strategy).toBeUndefined()
    expect(
      validateGitPullRequest({ serverId: 's1', path: '/srv/app', strategy: 'rebase' }).strategy
    ).toBe('rebase')
  })

  it('rejects unknown strategies', () => {
    expect(() =>
      validateGitPullRequest({ serverId: 's1', path: '/srv/app', strategy: 'merge' })
    ).toThrow()
  })
})

describe('validateGitPushRequest', () => {
  it('accepts opt-in force only', () => {
    expect(validateGitPushRequest({ serverId: 's1', path: '/srv/app' }).force).toBeUndefined()
    expect(validateGitPushRequest({ serverId: 's1', path: '/srv/app', force: true }).force).toBe(
      true
    )
  })
})

describe('validateGitCheckoutRequest', () => {
  it('rejects invalid branch names', () => {
    expect(() =>
      validateGitCheckoutRequest({ serverId: 's1', path: '/srv/app', branch: 'a b' })
    ).toThrow()
    expect(() =>
      validateGitCheckoutRequest({ serverId: 's1', path: '/srv/app', branch: 'a..b' })
    ).toThrow()
  })
})

describe('validateGitCreateBranchRequest', () => {
  it('accepts optional start point', () => {
    const request = validateGitCreateBranchRequest({
      serverId: 's1',
      path: '/srv/app',
      branch: 'feature/x',
      startPoint: 'main'
    })
    expect(request.startPoint).toBe('main')
  })
})

describe('validateGitStashRequest', () => {
  it('accepts push/pop/apply/drop with index and message', () => {
    expect(
      validateGitStashRequest({ serverId: 's1', path: '/srv/app', action: 'push', message: 'wip' })
    ).toMatchObject({ action: 'push', message: 'wip' })
    expect(
      validateGitStashRequest({ serverId: 's1', path: '/srv/app', action: 'pop', index: 0 })
    ).toMatchObject({ action: 'pop', index: 0 })
  })

  it('rejects unknown actions and negative indices', () => {
    expect(() =>
      validateGitStashRequest({ serverId: 's1', path: '/srv/app', action: 'clear' })
    ).toThrow()
    expect(() =>
      validateGitStashRequest({ serverId: 's1', path: '/srv/app', action: 'pop', index: -1 })
    ).toThrow()
  })
})

describe('validatePermissionsSetChoicesRequest', () => {
  it('accepts capability ids and unit names', () => {
    expect(
      validatePermissionsSetChoicesRequest({
        serverId: 's1',
        enabled: ['nginx.reload'],
        units: ['nginx.service']
      })
    ).toMatchObject({ serverId: 's1', enabled: ['nginx.reload'], units: ['nginx.service'] })
  })

  it('accepts missing units', () => {
    expect(
      validatePermissionsSetChoicesRequest({ serverId: 's1', enabled: [] })
    ).toMatchObject({ serverId: 's1', enabled: [] })
  })

  it('rejects non-arrays and bad unit names', () => {
    expect(() =>
      validatePermissionsSetChoicesRequest({ serverId: 's1', enabled: 'x' })
    ).toThrow()
    expect(() =>
      validatePermissionsSetChoicesRequest({ serverId: 's1', enabled: [], units: ['a b'] })
    ).toThrow()
  })
})

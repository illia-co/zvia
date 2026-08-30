import { describe, expect, it } from 'vitest'
import { ValidationError } from '@shared/errors'
import { validateUsersActionRequest } from '@shared/validate'

const SERVER_ID = 'production-abc123'

function actionRequest(action: Record<string, unknown>) {
  return { serverId: SERVER_ID, action }
}

describe('validateUsersActionRequest', () => {
  it('rejects shell flag injection in create', () => {
    expect(() =>
      validateUsersActionRequest(
        actionRequest({
          type: 'create',
          username: 'deploy',
          shell: '-G wheel'
        })
      )
    ).toThrow(ValidationError)
  })

  it('rejects shell flag injection in changeShell', () => {
    expect(() =>
      validateUsersActionRequest(
        actionRequest({
          type: 'changeShell',
          username: 'deploy',
          shell: '-G wheel'
        })
      )
    ).toThrow(ValidationError)
  })

  it('rejects group flag injection in addGroups', () => {
    expect(() =>
      validateUsersActionRequest(
        actionRequest({
          type: 'addGroups',
          username: 'deploy',
          groups: ['-aG']
        })
      )
    ).toThrow(ValidationError)
  })

  it('rejects usernames that look like flags', () => {
    expect(() =>
      validateUsersActionRequest(
        actionRequest({
          type: 'lock',
          username: '-evil'
        })
      )
    ).toThrow(ValidationError)
  })

  it('accepts valid create action', () => {
    const result = validateUsersActionRequest(
      actionRequest({
        type: 'create',
        username: 'deploy',
        shell: '/bin/bash',
        groups: ['sudo']
      })
    )
    expect(result.action).toEqual({
      type: 'create',
      username: 'deploy',
      shell: '/bin/bash',
      groups: ['sudo']
    })
  })

  it('accepts valid changeShell action', () => {
    const result = validateUsersActionRequest(
      actionRequest({
        type: 'changeShell',
        username: 'deploy',
        shell: '/bin/bash'
      })
    )
    expect(result.action).toEqual({
      type: 'changeShell',
      username: 'deploy',
      shell: '/bin/bash'
    })
  })

  it('accepts valid addGroups action', () => {
    const result = validateUsersActionRequest(
      actionRequest({
        type: 'addGroups',
        username: 'deploy',
        groups: ['sudo']
      })
    )
    expect(result.action).toEqual({
      type: 'addGroups',
      username: 'deploy',
      groups: ['sudo']
    })
  })
})

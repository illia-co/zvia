import { describe, expect, it } from 'vitest'
import { getPasswordPolicyIssues } from './userPassword'

describe('getPasswordPolicyIssues', () => {
  it('accepts a strong password', () => {
    expect(getPasswordPolicyIssues('Relay-Admin-42', 'deploy')).toEqual([])
  })

  it('rejects passwords that match or contain the username', () => {
    expect(getPasswordPolicyIssues('test', 'test')).toContain('Password cannot match the username.')
    expect(getPasswordPolicyIssues('test-user-1', 'test')).toContain(
      'Password cannot contain the username.'
    )
  })

  it('rejects short simple passwords', () => {
    expect(getPasswordPolicyIssues('abc')).toContain('Use at least 8 characters.')
    expect(getPasswordPolicyIssues('abcdefgh')).toContain(
      'Use a mix of uppercase, lowercase, and numbers.'
    )
  })
})

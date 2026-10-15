import { describe, expect, it } from 'vitest'
import { AuthenticationError, ConnectionError } from '@shared/errors'
import { isAuthFailureMessage, toConnectionOrAuthError } from '@main/ssh/authErrors'

describe('isAuthFailureMessage', () => {
  it('detects ssh2 auth rejections', () => {
    expect(isAuthFailureMessage('All configured authentication methods failed')).toBe(true)
    expect(isAuthFailureMessage('Authentication failed')).toBe(true)
    expect(isAuthFailureMessage('Cannot decrypt private key: wrong passphrase')).toBe(true)
  })

  it('ignores network errors', () => {
    expect(isAuthFailureMessage('Connection timed out')).toBe(false)
    expect(isAuthFailureMessage('ECONNREFUSED')).toBe(false)
  })
})

describe('toConnectionOrAuthError', () => {
  it('maps ssh2 auth failures to AuthenticationError with details', () => {
    const mapped = toConnectionOrAuthError(
      new Error('All configured authentication methods failed')
    )
    expect(mapped).toBeInstanceOf(AuthenticationError)
    expect(mapped.code).toBe('AUTHENTICATION_ERROR')
    expect(mapped.details).toBe('All configured authentication methods failed')
  })

  it('preserves AuthenticationError as-is', () => {
    const original = new AuthenticationError('no agent')
    expect(toConnectionOrAuthError(original)).toBe(original)
  })

  it('wraps generic failures as ConnectionError', () => {
    const mapped = toConnectionOrAuthError(new Error('ECONNREFUSED'))
    expect(mapped).toBeInstanceOf(ConnectionError)
  })
})

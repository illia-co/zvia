import { describe, expect, it } from 'vitest'
import { validatePassphraseResponseRequest } from '@shared/validate'

describe('validatePassphraseResponseRequest', () => {
  it('accepts a passphrase submission', () => {
    expect(
      validatePassphraseResponseRequest({ serverId: 'srv-1', passphrase: 'secret' })
    ).toEqual({ serverId: 'srv-1', passphrase: 'secret' })
  })

  it('accepts a cancellation', () => {
    expect(validatePassphraseResponseRequest({ serverId: 'srv-1', cancel: true })).toEqual({
      serverId: 'srv-1',
      cancel: true
    })
  })

  it('rejects empty and oversized passphrases', () => {
    expect(() =>
      validatePassphraseResponseRequest({ serverId: 'srv-1', passphrase: '' })
    ).toThrow()
    expect(() =>
      validatePassphraseResponseRequest({ serverId: 'srv-1', passphrase: 'x'.repeat(1025) })
    ).toThrow()
    expect(() => validatePassphraseResponseRequest({ serverId: 'srv-1' })).toThrow()
  })
})

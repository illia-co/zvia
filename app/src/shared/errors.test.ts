import { describe, expect, it } from 'vitest'
import { extractRelayIpcPayload, parseIpcError, RELAY_IPC_ERROR_PREFIX } from './errors'

describe('parseIpcError', () => {
  it('extracts relay payloads wrapped by Electron invoke errors', () => {
    const payload = {
      code: 'COMMAND_ERROR' as const,
      message: 'User test was created, but password was not set.',
      details: 'password policy'
    }
    const error = new Error(
      `Error invoking remote method 'users:action': Error: ${RELAY_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`
    )

    expect(parseIpcError(error)).toEqual(payload)
  })

  it('extracts relay payloads embedded in plain strings', () => {
    const payload = {
      code: 'VALIDATION_ERROR' as const,
      message: 'Invalid username'
    }
    const message = `Something failed: ${RELAY_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`

    expect(extractRelayIpcPayload(message)).toEqual(payload)
    expect(parseIpcError(message)).toEqual(payload)
  })
})

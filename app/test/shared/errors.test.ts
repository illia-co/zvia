import { describe, expect, it } from 'vitest'
import { extractZviaIpcPayload, parseIpcError, ZVIA_IPC_ERROR_PREFIX } from '@shared/errors'

describe('parseIpcError', () => {
  it('extracts zvia payloads wrapped by Electron invoke errors', () => {
    const payload = {
      code: 'COMMAND_ERROR' as const,
      message: 'User test was created, but password was not set.',
      details: 'password policy'
    }
    const error = new Error(
      `Error invoking remote method 'users:action': Error: ${ZVIA_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`
    )

    expect(parseIpcError(error)).toEqual(payload)
  })

  it('extracts zvia payloads embedded in plain strings', () => {
    const payload = {
      code: 'VALIDATION_ERROR' as const,
      message: 'Invalid username'
    }
    const message = `Something failed: ${ZVIA_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`

    expect(extractZviaIpcPayload(message)).toEqual(payload)
    expect(parseIpcError(message)).toEqual(payload)
  })
})

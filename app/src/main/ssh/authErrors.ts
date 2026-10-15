import { AuthenticationError, ConnectionError } from '@shared/errors'

const AUTH_FAILURE_PATTERN =
  /all configured authentication methods failed|authentication failed|no authentication methods|bad decrypt|incorrect passphrase|encrypted.*private key|private key.*passphrase|passphrase.*required/i

export function isAuthFailureMessage(message: string): boolean {
  return AUTH_FAILURE_PATTERN.test(message)
}

/**
 * ssh2 surfaces key/agent rejections as plain Errors. Map them to
 * AuthenticationError (with the raw message as details) so the renderer
 * shows "Authentication failed" instead of the generic network banner.
 */
export function toConnectionOrAuthError(error: unknown): ConnectionError | AuthenticationError {
  if (error instanceof AuthenticationError) return error
  const message = error instanceof Error ? error.message : 'Connection failed'
  if (isAuthFailureMessage(message)) {
    return new AuthenticationError('SSH authentication failed', message)
  }
  return error instanceof ConnectionError ? error : new ConnectionError(message)
}

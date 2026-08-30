import { parseIpcError, type RelayErrorPayload } from '@shared/errors'

export function parseRelayError(error: unknown): RelayErrorPayload {
  return parseIpcError(error)
}

/**
 * `PrivilegeRequiredError` serializes as a permission error whose details carry
 * the exact command that needs elevation. Returns that command when the payload
 * came from a privilege check, otherwise null.
 */
export function elevationCommand(error: RelayErrorPayload): string | null {
  if (error.code !== 'PERMISSION_ERROR') return null
  if (!error.details) return null
  if (!/elevated privileges/i.test(error.message)) return null
  return error.details
}

export function humanizeError(error: RelayErrorPayload): string {
  switch (error.code) {
    case 'CONNECTION_ERROR':
      return 'Could not connect to this server. Check the hostname, port, and network.'
    case 'AUTHENTICATION_ERROR':
      return 'Authentication failed. Check your SSH key, passphrase, or agent and try again.'
    case 'PERMISSION_ERROR':
      return 'Permission denied. Your account may not have access to this resource.'
    case 'SFTP_ERROR':
      return 'File operation failed over SFTP.'
    case 'COMMAND_ERROR':
      if (/was created, but/i.test(error.message)) {
        return error.message
      }
      return 'The remote command failed.'
    case 'DOCKER_UNAVAILABLE_ERROR':
      return 'Docker is not available on this server.'
    case 'VALIDATION_ERROR':
      return 'The request was invalid.'
    case 'NOT_FOUND':
      return 'The requested resource was not found.'
    default:
      return error.message || 'Something went wrong.'
  }
}

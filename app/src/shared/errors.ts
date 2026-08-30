export type RelayErrorCode =
  | 'CONNECTION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'SFTP_ERROR'
  | 'COMMAND_ERROR'
  | 'DOCKER_UNAVAILABLE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

export interface RelayErrorPayload {
  code: RelayErrorCode
  message: string
  details?: string
}

export class RelayError extends Error {
  readonly code: RelayErrorCode
  readonly details?: string

  constructor(code: RelayErrorCode, message: string, details?: string) {
    super(message)
    this.name = 'RelayError'
    this.code = code
    this.details = details
  }

  toPayload(): RelayErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

export class ConnectionError extends RelayError {
  constructor(message: string, details?: string) {
    super('CONNECTION_ERROR', message, details)
    this.name = 'ConnectionError'
  }
}

export class AuthenticationError extends RelayError {
  constructor(message: string, details?: string) {
    super('AUTHENTICATION_ERROR', message, details)
    this.name = 'AuthenticationError'
  }
}

export class PermissionError extends RelayError {
  constructor(message: string, details?: string) {
    super('PERMISSION_ERROR', message, details)
    this.name = 'PermissionError'
  }
}

export class PrivilegeRequiredError extends RelayError {
  readonly command: string

  constructor(message: string, command: string) {
    super('PERMISSION_ERROR', message, command)
    this.name = 'PrivilegeRequiredError'
    this.command = command
  }
}

export class SFTPError extends RelayError {
  constructor(message: string, details?: string) {
    super('SFTP_ERROR', message, details)
    this.name = 'SFTPError'
  }
}

export class CommandError extends RelayError {
  constructor(message: string, details?: string) {
    super('COMMAND_ERROR', message, details)
    this.name = 'CommandError'
  }
}

export class DockerUnavailableError extends RelayError {
  constructor(message: string, details?: string) {
    super('DOCKER_UNAVAILABLE_ERROR', message, details)
    this.name = 'DockerUnavailableError'
  }
}

export class ValidationError extends RelayError {
  constructor(message: string, details?: string) {
    super('VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export function isRelayErrorPayload(value: unknown): value is RelayErrorPayload {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.code === 'string' && typeof record.message === 'string'
}

export function serializeError(error: unknown): RelayErrorPayload {
  if (error instanceof PrivilegeRequiredError) {
    return {
      code: error.code,
      message: error.message,
      details: error.command
    }
  }
  if (error instanceof RelayError) {
    return error.toPayload()
  }
  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message
    }
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }
}

export const RELAY_IPC_ERROR_PREFIX = 'RELAY_IPC_ERROR:'

export function extractRelayIpcPayload(message: string): RelayErrorPayload | null {
  const relayIndex = message.indexOf(RELAY_IPC_ERROR_PREFIX)
  if (relayIndex === -1) return null

  try {
    const parsed = JSON.parse(
      message.slice(relayIndex + RELAY_IPC_ERROR_PREFIX.length)
    ) as unknown
    return isRelayErrorPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function formatIpcError(payload: RelayErrorPayload): Error {
  return new Error(`${RELAY_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`)
}

export function parseIpcError(error: unknown): RelayErrorPayload {
  if (isRelayErrorPayload(error)) {
    return error
  }

  if (error instanceof Error) {
    const embedded = extractRelayIpcPayload(error.message)
    if (embedded) return embedded

    return {
      code: 'INTERNAL_ERROR',
      message: error.message
    }
  }

  if (typeof error === 'string') {
    const embedded = extractRelayIpcPayload(error)
    if (embedded) return embedded
    return { code: 'INTERNAL_ERROR', message: error }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }
}

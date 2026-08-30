export type ZviaErrorCode =
  | 'CONNECTION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'SFTP_ERROR'
  | 'COMMAND_ERROR'
  | 'DOCKER_UNAVAILABLE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

export interface ZviaErrorPayload {
  code: ZviaErrorCode
  message: string
  details?: string
}

export class ZviaError extends Error {
  readonly code: ZviaErrorCode
  readonly details?: string

  constructor(code: ZviaErrorCode, message: string, details?: string) {
    super(message)
    this.name = 'ZviaError'
    this.code = code
    this.details = details
  }

  toPayload(): ZviaErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

export class ConnectionError extends ZviaError {
  constructor(message: string, details?: string) {
    super('CONNECTION_ERROR', message, details)
    this.name = 'ConnectionError'
  }
}

export class AuthenticationError extends ZviaError {
  constructor(message: string, details?: string) {
    super('AUTHENTICATION_ERROR', message, details)
    this.name = 'AuthenticationError'
  }
}

export class PermissionError extends ZviaError {
  constructor(message: string, details?: string) {
    super('PERMISSION_ERROR', message, details)
    this.name = 'PermissionError'
  }
}

export class PrivilegeRequiredError extends ZviaError {
  readonly command: string

  constructor(message: string, command: string) {
    super('PERMISSION_ERROR', message, command)
    this.name = 'PrivilegeRequiredError'
    this.command = command
  }
}

export class SFTPError extends ZviaError {
  constructor(message: string, details?: string) {
    super('SFTP_ERROR', message, details)
    this.name = 'SFTPError'
  }
}

export class CommandError extends ZviaError {
  constructor(message: string, details?: string) {
    super('COMMAND_ERROR', message, details)
    this.name = 'CommandError'
  }
}

export class DockerUnavailableError extends ZviaError {
  constructor(message: string, details?: string) {
    super('DOCKER_UNAVAILABLE_ERROR', message, details)
    this.name = 'DockerUnavailableError'
  }
}

export class ValidationError extends ZviaError {
  constructor(message: string, details?: string) {
    super('VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export function isZviaErrorPayload(value: unknown): value is ZviaErrorPayload {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.code === 'string' && typeof record.message === 'string'
}

export function serializeError(error: unknown): ZviaErrorPayload {
  if (error instanceof PrivilegeRequiredError) {
    return {
      code: error.code,
      message: error.message,
      details: error.command
    }
  }
  if (error instanceof ZviaError) {
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

export const ZVIA_IPC_ERROR_PREFIX = 'ZVIA_IPC_ERROR:'

export function extractZviaIpcPayload(message: string): ZviaErrorPayload | null {
  const zviaIndex = message.indexOf(ZVIA_IPC_ERROR_PREFIX)
  if (zviaIndex === -1) return null

  try {
    const parsed = JSON.parse(
      message.slice(zviaIndex + ZVIA_IPC_ERROR_PREFIX.length)
    ) as unknown
    return isZviaErrorPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function formatIpcError(payload: ZviaErrorPayload): Error {
  return new Error(`${ZVIA_IPC_ERROR_PREFIX}${JSON.stringify(payload)}`)
}

export function parseIpcError(error: unknown): ZviaErrorPayload {
  if (isZviaErrorPayload(error)) {
    return error
  }

  if (error instanceof Error) {
    const embedded = extractZviaIpcPayload(error.message)
    if (embedded) return embedded

    return {
      code: 'INTERNAL_ERROR',
      message: error.message
    }
  }

  if (typeof error === 'string') {
    const embedded = extractZviaIpcPayload(error)
    if (embedded) return embedded
    return { code: 'INTERNAL_ERROR', message: error }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }
}

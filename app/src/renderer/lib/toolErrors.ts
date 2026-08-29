import { elevationCommand, parseRelayError } from './errors'

export interface ToolError {
  message: string
  elevation: string | null
}

/**
 * Keeps service-authored messages verbatim. Tool services return precise text
 * (SSH lockout refusals, nginx test failures) that the generic humanizer would
 * flatten into "The request was invalid".
 */
export function describeToolError(error: unknown): ToolError {
  const payload = parseRelayError(error)
  const elevation = elevationCommand(payload)
  const message =
    payload.details && payload.code === 'VALIDATION_ERROR'
      ? `${payload.message} ${payload.details}`
      : payload.message
  return { message, elevation }
}

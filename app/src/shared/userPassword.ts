export const LINUX_PASSWORD_HINTS = [
  'At least 8 characters',
  'Must not match or contain the username',
  'Include uppercase, lowercase, and numbers (or use a 12+ character passphrase)',
  'Avoid common words and simple patterns',
  'Leave empty to create the account without a login password'
] as const

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwerty',
  'letmein',
  'welcome',
  'admin123'
])

export function getPasswordPolicyIssues(password: string, username?: string): string[] {
  if (!password) return []

  const issues: string[] = []
  const normalizedPassword = password.toLowerCase()
  const normalizedUsername = username?.trim().toLowerCase()

  if (password.length < 8) {
    issues.push('Use at least 8 characters.')
  }

  if (normalizedUsername && normalizedUsername.length >= 2) {
    if (normalizedPassword === normalizedUsername) {
      issues.push('Password cannot match the username.')
    } else if (normalizedPassword.includes(normalizedUsername)) {
      issues.push('Password cannot contain the username.')
    }
  }

  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const characterClasses = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  if (password.length < 12 && characterClasses < 3) {
    issues.push('Use a mix of uppercase, lowercase, and numbers.')
  }

  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    issues.push('Avoid common passwords.')
  }

  return issues
}

export function assertPasswordPolicy(password: string, username?: string): void {
  const issues = getPasswordPolicyIssues(password, username)
  if (issues.length > 0) {
    throw new Error(issues[0])
  }
}

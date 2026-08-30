import { LINUX_PASSWORD_HINTS, getPasswordPolicyIssues } from '@shared/userPassword'

interface PasswordFieldHintsProps {
  username?: string
  password?: string
}

export function PasswordFieldHints({ username, password = '' }: PasswordFieldHintsProps) {
  const issues = getPasswordPolicyIssues(password, username)

  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-1 text-[11px] leading-relaxed text-text-tertiary">
        {LINUX_PASSWORD_HINTS.map((hint) => (
          <li key={hint}>• {hint}</li>
        ))}
      </ul>
      {password && issues.length > 0 && (
        <ul className="space-y-1 text-[11px] leading-relaxed text-status-warning">
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

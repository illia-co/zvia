import { describe, expect, it } from 'vitest'
import { buildJournalctlCommand } from './LogService'

describe('buildJournalctlCommand', () => {
  it('builds a live follow command with default tail size', () => {
    expect(buildJournalctlCommand({ mode: 'live', lines: 500 })).toBe(
      'journalctl -f -o json --no-pager -n 500'
    )
  })

  it('builds a recent snapshot command without follow', () => {
    expect(buildJournalctlCommand({ mode: 'recent', lines: 1000 })).toBe(
      'journalctl -o json --no-pager -n 1000'
    )
  })

  it('includes time range, priority, and unit filters', () => {
    const command = buildJournalctlCommand({
      mode: 'live',
      lines: 500,
      timeRange: '1h',
      priority: '3',
      unit: 'nginx.service'
    })

    expect(command).toBe(
      "journalctl -f -o json --no-pager -n 500 --since '1 hour ago' -p 3 -u nginx.service"
    )
  })

  it('combines pid and unit filters', () => {
    const command = buildJournalctlCommand({
      mode: 'live',
      lines: 500,
      pid: 1421,
      unit: 'nginx.service'
    })

    expect(command).toBe(
      'journalctl _PID=1421 -f -o json --no-pager -n 500 -u nginx.service'
    )
  })

  it('applies time range in recent mode', () => {
    const command = buildJournalctlCommand({
      mode: 'recent',
      lines: 200,
      timeRange: 'today'
    })

    expect(command).toBe("journalctl -o json --no-pager -n 200 --since today")
  })

  it('filters by process id', () => {
    const command = buildJournalctlCommand({
      mode: 'live',
      lines: 500,
      pid: 2847
    })

    expect(command).toBe('journalctl _PID=2847 -f -o json --no-pager -n 500')
  })

  it('shell-quotes filter values that need escaping', () => {
    const command = buildJournalctlCommand({
      mode: 'live',
      lines: 500,
      timeRange: 'today',
      unit: "my unit's service"
    })

    expect(command).toContain('--since today')
    expect(command).toContain("-u 'my unit'\\''s service'")
  })
})

import { describe, expect, it } from 'vitest'
import { isEmptyCrontabMessage } from '@main/services/CronService'

describe('isEmptyCrontabMessage', () => {
  it('recognises the real Ubuntu 24.04 message for an absent crontab', () => {
    // Verbatim stderr of `crontab -l` and `sudo -n crontab -u root -l`,
    // both of which exit 1 when the crontab is simply empty.
    expect(isEmptyCrontabMessage('no crontab for illia-co')).toBe(true)
    expect(isEmptyCrontabMessage('no crontab for root')).toBe(true)
  })

  it('does not swallow genuine read failures', () => {
    expect(isEmptyCrontabMessage('sudo: a password is required')).toBe(false)
    expect(isEmptyCrontabMessage('must be privileged to use -u')).toBe(false)
    expect(isEmptyCrontabMessage('/var/spool/cron/crontabs/root: Permission denied')).toBe(false)
    expect(isEmptyCrontabMessage('')).toBe(false)
  })
})

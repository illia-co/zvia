import { describe, expect, it } from 'vitest'
import {
  cronJobFilePath,
  describeCron,
  describeCronEditability,
  parseCronLine,
  parseCrontab,
  validateCronExpression,
  type CronSource
} from '@shared/cron'

const USER_CRONTAB = [
  '# Zvia test crontab',
  'SHELL=/bin/sh',
  'PATH=/usr/bin:/bin',
  '',
  '*/5 * * * * /usr/local/bin/backup.sh --quiet',
  '0 3 * * 1 /usr/bin/logrotate   /etc/logrotate.conf',
  '@reboot /opt/app/start.sh',
  '99 * * * * /bin/broken'
].join('\n')

const SYSTEM_CRONTAB = [
  'SHELL=/bin/sh',
  'PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin',
  '',
  '17 *	* * *	root    cd / && run-parts --report /etc/cron.hourly',
  '25 6	* * *	root	test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily'
].join('\n')

describe('parseCronLine', () => {
  it('ignores comments, blank lines, and environment assignments', () => {
    expect(parseCronLine('')).toBeNull()
    expect(parseCronLine('   ')).toBeNull()
    expect(parseCronLine('# a comment')).toBeNull()
    expect(parseCronLine('MAILTO=root')).toBeNull()
  })

  it('parses a five-field user crontab line', () => {
    expect(parseCronLine('*/5 * * * * /usr/local/bin/backup.sh --quiet')).toEqual({
      schedule: '*/5 * * * *',
      command: '/usr/local/bin/backup.sh --quiet',
      user: undefined
    })
  })

  it('preserves command spacing verbatim', () => {
    const parsed = parseCronLine('0 3 * * 1 /usr/bin/logrotate   /etc/logrotate.conf')
    expect(parsed?.command).toBe('/usr/bin/logrotate   /etc/logrotate.conf')
  })

  it('parses special schedules', () => {
    expect(parseCronLine('@reboot /opt/app/start.sh')).toEqual({
      schedule: '@reboot',
      command: '/opt/app/start.sh',
      user: undefined
    })
    expect(parseCronLine('@nonsense /opt/app/start.sh')).toBeNull()
  })

  it('parses the user field for system crontabs', () => {
    expect(
      parseCronLine('17 *\t* * *\troot    cd / && run-parts --report /etc/cron.hourly', {
        hasUserField: true
      })
    ).toEqual({
      schedule: '17 * * * *',
      command: 'cd / && run-parts --report /etc/cron.hourly',
      user: 'root'
    })
  })

  it('rejects lines without a command', () => {
    expect(parseCronLine('*/5 * * * *')).toBeNull()
    expect(parseCronLine('0 3 * * 1 root', { hasUserField: true })).toBeNull()
  })
})

describe('parseCrontab', () => {
  it('records source, line numbers, and validity for a user crontab', () => {
    const jobs = parseCrontab(USER_CRONTAB, {
      source: 'user-crontab',
      sourcePath: 'crontab:user',
      defaultUser: 'ubuntu',
      target: 'user'
    })

    expect(jobs).toHaveLength(4)
    expect(jobs[0]).toMatchObject({
      id: 'user-crontab:crontab:user:5',
      schedule: '*/5 * * * *',
      command: '/usr/local/bin/backup.sh --quiet',
      user: 'ubuntu',
      source: 'user-crontab',
      lineNumber: 5,
      valid: true,
      target: 'user'
    })
    expect(jobs[0].description).toBe('Every 5 minutes')
    expect(jobs[2].schedule).toBe('@reboot')
    expect(jobs[3]).toMatchObject({ schedule: '99 * * * *', valid: false })
  })

  it('reads the user field from /etc/crontab entries', () => {
    const jobs = parseCrontab(SYSTEM_CRONTAB, {
      source: 'system-crontab',
      sourcePath: '/etc/crontab',
      hasUserField: true
    })

    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({
      user: 'root',
      sourcePath: '/etc/crontab',
      lineNumber: 4,
      target: undefined
    })
    expect(jobs[1].command).toBe(
      'test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily'
    )
  })
})

/**
 * Verbatim `/etc/crontab` from Ubuntu 24.04.4 LTS, tabs included. Real Debian
 * crontabs mix spaces and tabs inside the schedule and around the user field.
 */
const UBUNTU_2404_ETC_CRONTAB = [
  '# /etc/crontab: system-wide crontab',
  "# Unlike any other crontab you don't have to run the `crontab'",
  '# command to install the new version when you edit this file',
  '# and files in /etc/cron.d. These files also have username fields,',
  '# that none of the other crontabs do.',
  '',
  'SHELL=/bin/sh',
  '# You can also override PATH, but by default, newer versions inherit it from the environment',
  '#PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  '',
  '# Example of job definition:',
  '# .---------------- minute (0 - 59)',
  '# |  .------------- hour (0 - 23)',
  '# |  |  .---------- day of month (1 - 31)',
  '# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...',
  '# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat',
  '# |  |  |  |  |',
  '# *  *  *  *  * user-name command to be executed',
  '17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly',
  '25 6\t* * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }',
  '47 6\t* * 7\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }',
  '52 6\t1 * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }',
  '#'
].join('\n')

/** Verbatim `/etc/cron.d/e2scrub_all` from Ubuntu 24.04.4 LTS. */
const UBUNTU_2404_CRON_D_E2SCRUB = [
  '30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/aarch64-linux-gnu/e2fsprogs/e2scrub_all_cron',
  '10 3 * * * root test -e /run/systemd/system || SERVICE_MODE=1 /sbin/e2scrub_all -A -r'
].join('\n')

describe('parseCrontab against real Ubuntu 24.04 sources', () => {
  it('parses /etc/crontab without tripping on tabs, comments or SHELL=', () => {
    const jobs = parseCrontab(UBUNTU_2404_ETC_CRONTAB, {
      source: 'system-crontab',
      sourcePath: '/etc/crontab',
      hasUserField: true
    })

    expect(jobs).toHaveLength(4)
    expect(jobs.every((job) => job.user === 'root')).toBe(true)
    expect(jobs.every((job) => job.valid)).toBe(true)
    expect(jobs.map((job) => job.lineNumber)).toEqual([19, 20, 21, 22])
    expect(jobs.map((job) => job.schedule)).toEqual([
      '17 * * * *',
      '25 6 * * *',
      '47 6 * * 7',
      '52 6 1 * *'
    ])
    expect(jobs.map((job) => job.description)).toEqual([
      'Every hour at minute 17',
      'Every day at 06:25',
      'Every week on Sunday at 06:47',
      'Every month on day 1 at 06:52'
    ])
    expect(jobs[0].command).toBe('cd / && run-parts --report /etc/cron.hourly')
    expect(jobs[1].command).toBe(
      'test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }'
    )
  })

  it('parses a /etc/cron.d drop-in with a user field', () => {
    const jobs = parseCrontab(UBUNTU_2404_CRON_D_E2SCRUB, {
      source: 'cron.d',
      sourcePath: '/etc/cron.d/e2scrub_all',
      hasUserField: true
    })

    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({
      schedule: '30 3 * * 0',
      user: 'root',
      source: 'cron.d',
      sourcePath: '/etc/cron.d/e2scrub_all',
      lineNumber: 1,
      valid: true
    })
    expect(jobs[0].description).toBe('Every week on Sunday at 03:30')
    expect(jobs[0].command).toBe(
      'test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/aarch64-linux-gnu/e2fsprogs/e2scrub_all_cron'
    )
    expect(jobs[1].description).toBe('Every day at 03:10')
  })
})

describe('validateCronExpression', () => {
  it('accepts common expressions', () => {
    for (const expression of [
      '* * * * *',
      '*/5 * * * *',
      '0 3 * * 1',
      '0 0 1 1 *',
      '15,45 2-4 * * MON-FRI',
      '0 0 * JAN,jul *',
      '0 0 * * 7',
      '@reboot',
      '@DAILY'
    ]) {
      expect(validateCronExpression(expression), expression).toEqual({ valid: true })
    }
  })

  it('rejects malformed expressions', () => {
    expect(validateCronExpression('')).toMatchObject({ valid: false })
    expect(validateCronExpression('* * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('* * * * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('60 * * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('* 24 * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('* * 0 * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('* * * 13 *')).toMatchObject({ valid: false })
    expect(validateCronExpression('* * * * 8')).toMatchObject({ valid: false })
    expect(validateCronExpression('5-1 * * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('*/0 * * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('1,,2 * * * *')).toMatchObject({ valid: false })
    expect(validateCronExpression('@weekley')).toMatchObject({ valid: false })
  })

  it('names the offending field', () => {
    expect(validateCronExpression('* 24 * * *').error).toContain('hour')
  })
})

describe('describeCron', () => {
  it('describes special schedules', () => {
    expect(describeCron('@reboot')).toBe('At system boot')
    expect(describeCron('@daily')).toBe('Every day at 00:00')
    expect(describeCron('@midnight')).toBe('Every day at 00:00')
    expect(describeCron('@hourly')).toBe('Every hour at minute 0')
  })

  it('describes interval schedules', () => {
    expect(describeCron('* * * * *')).toBe('Every minute')
    expect(describeCron('*/5 * * * *')).toBe('Every 5 minutes')
    expect(describeCron('0 */6 * * *')).toBe('Every 6 hours at minute 0')
    expect(describeCron('30 * * * *')).toBe('Every hour at minute 30')
  })

  it('describes calendar schedules', () => {
    expect(describeCron('30 3 * * *')).toBe('Every day at 03:30')
    expect(describeCron('0 12 * * 1')).toBe('Every week on Monday at 12:00')
    expect(describeCron('0 12 * * 1-5')).toBe('Every week on Monday to Friday at 12:00')
    expect(describeCron('0 12 * * 1,3')).toBe('Every week on Monday and Wednesday at 12:00')
    expect(describeCron('0 4 1 * *')).toBe('Every month on day 1 at 04:00')
    expect(describeCron('0 0 1 1 *')).toBe('Every year on January 1 at 00:00')
  })

  it('falls back to the raw expression when it cannot be described', () => {
    expect(describeCron('0 0 1,15 * 3')).toBe('0 0 1,15 * 3')
    expect(describeCron('99 * * * *')).toBe('99 * * * *')
  })
})

describe('cronJobFilePath', () => {
  const base = {
    id: 'x',
    raw: '',
    schedule: '@daily',
    command: '/usr/bin/true',
    source: 'cron.d' as CronSource,
    sourcePath: '/etc/cron.d/certbot',
    lineNumber: 1,
    description: '',
    valid: true
  }

  it('uses the source file for file-backed cron sources', () => {
    expect(cronJobFilePath(base)).toBe('/etc/cron.d/certbot')
    expect(cronJobFilePath({ ...base, source: 'system-crontab', sourcePath: '/etc/crontab' })).toBe(
      '/etc/crontab'
    )
  })

  it('uses the script itself for run-parts entries', () => {
    expect(
      cronJobFilePath({
        ...base,
        source: 'periodic',
        sourcePath: '/etc/cron.daily',
        command: '/etc/cron.daily/apt-compat'
      })
    ).toBe('/etc/cron.daily/apt-compat')
  })

  it('returns null for crontabs that only exist behind crontab -l', () => {
    expect(
      cronJobFilePath({ ...base, source: 'user-crontab', sourcePath: 'crontab:user' })
    ).toBeNull()
    expect(
      cronJobFilePath({ ...base, source: 'root-crontab', sourcePath: 'crontab:root' })
    ).toBeNull()
  })
})

describe('describeCronEditability', () => {
  it('stays silent when a crontab can be written', () => {
    expect(
      describeCronEditability({
        jobs: [],
        crontabAvailable: true,
        canEditUser: true,
        canEditRoot: false
      })
    ).toBeNull()
  })

  it('explains a missing crontab command', () => {
    const reason = describeCronEditability({
      jobs: [],
      crontabAvailable: false,
      canEditUser: false,
      canEditRoot: false
    })
    expect(reason).toContain('crontab command is not available')
  })

  it('explains an unwritable crontab', () => {
    const reason = describeCronEditability({
      jobs: [],
      crontabAvailable: true,
      canEditUser: false,
      canEditRoot: false
    })
    expect(reason).toContain('cannot create or edit scheduled jobs')
  })
})

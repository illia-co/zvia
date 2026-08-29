import { describe, expect, it } from 'vitest'
import {
  buildUnitDetail,
  mergeUnits,
  parseJournalOutput,
  parseListUnitsJson,
  parseListUnitsPlain,
  parseShowProperties,
  parseUnitFilePaths,
  parseUnitFileStates
} from './systemdParsers'

const LIST_UNITS_JSON = JSON.stringify([
  {
    unit: 'ssh.service',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    description: 'OpenBSD Secure Shell server'
  },
  {
    unit: 'nginx.service',
    load: 'loaded',
    active: 'failed',
    sub: 'failed',
    description: 'A high performance web server'
  },
  {
    unit: 'not-a-unit',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    description: 'ignored'
  }
])

const LIST_UNITS_PLAIN = [
  'ssh.service                loaded active   running OpenBSD Secure Shell server',
  '● nginx.service            loaded failed   failed  A high performance web server',
  'xrdp.service               loaded active   running xrdp daemon',
  'systemd-tmpfiles-clean.service loaded inactive dead  Cleanup of Temporary Directories',
  '',
  '4 loaded units listed.'
].join('\n')

const LIST_UNIT_FILES = [
  'cron.service                           enabled         enabled',
  'nginx.service                           disabled        enabled',
  'ssh.service                             enabled         enabled',
  'systemd-tmpfiles-clean.service           static          -',
  '',
  '4 unit files listed.'
].join('\n')

const SHOW_OUTPUT = [
  'Id=nginx.service',
  'Description=A high performance web server and a reverse proxy server',
  'LoadState=loaded',
  'ActiveState=active',
  'SubState=running',
  'MainPID=1421',
  'ActiveEnterTimestamp=Tue 2026-08-25 09:12:03 UTC',
  'UnitFileState=enabled',
  'FragmentPath=/lib/systemd/system/nginx.service'
].join('\n')

describe('parseListUnitsJson', () => {
  it('parses JSON output and drops non-unit rows', () => {
    const rows = parseListUnitsJson(LIST_UNITS_JSON)
    expect(rows).toEqual([
      {
        unit: 'ssh.service',
        load: 'loaded',
        active: 'active',
        sub: 'running',
        description: 'OpenBSD Secure Shell server'
      },
      {
        unit: 'nginx.service',
        load: 'loaded',
        active: 'failed',
        sub: 'failed',
        description: 'A high performance web server'
      }
    ])
  })

  it('returns null when the output is not JSON', () => {
    expect(parseListUnitsJson('Unknown option --output=json')).toBeNull()
    expect(parseListUnitsJson('[not json')).toBeNull()
    expect(parseListUnitsJson('')).toBeNull()
  })
})

describe('parseListUnitsPlain', () => {
  it('parses the plain fallback and strips failure markers', () => {
    const rows = parseListUnitsPlain(LIST_UNITS_PLAIN)

    expect(rows).toHaveLength(4)
    expect(rows[1]).toEqual({
      unit: 'nginx.service',
      load: 'loaded',
      active: 'failed',
      sub: 'failed',
      description: 'A high performance web server'
    })
    expect(rows.map((row) => row.unit)).not.toContain('4')
  })

  it('does not truncate unit names that start with a marker-like character', () => {
    expect(parseListUnitsPlain(LIST_UNITS_PLAIN).map((row) => row.unit)).toContain('xrdp.service')
  })

  it('handles the ASCII fallback marker', () => {
    const rows = parseListUnitsPlain('* nginx.service loaded failed failed Web server')
    expect(rows[0]?.unit).toBe('nginx.service')
  })
})

describe('parseUnitFileStates', () => {
  it('maps unit names to their unit file state', () => {
    const states = parseUnitFileStates(LIST_UNIT_FILES)

    expect(states.get('ssh.service')).toBe('enabled')
    expect(states.get('nginx.service')).toBe('disabled')
    expect(states.get('systemd-tmpfiles-clean.service')).toBe('static')
    expect(states.size).toBe(4)
  })
})

describe('parseShowProperties and buildUnitDetail', () => {
  it('parses key=value properties into a unit detail', () => {
    const detail = buildUnitDetail('nginx.service', parseShowProperties(SHOW_OUTPUT))

    expect(detail).toEqual({
      unit: 'nginx.service',
      description: 'A high performance web server and a reverse proxy server',
      loadState: 'loaded',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled',
      mainPid: 1421,
      activeEnterTimestamp: 'Tue 2026-08-25 09:12:03 UTC',
      fragmentPath: '/lib/systemd/system/nginx.service'
    })
  })

  it('falls back to the requested unit and a zero PID', () => {
    const detail = buildUnitDetail('missing.service', parseShowProperties(''))

    expect(detail.unit).toBe('missing.service')
    expect(detail.mainPid).toBe(0)
    expect(detail.activeState).toBe('')
  })
})

describe('mergeUnits', () => {
  it('merges unit file states and sorts by unit name', () => {
    const rows = parseListUnitsJson(LIST_UNITS_JSON) ?? []
    const units = mergeUnits(rows, parseUnitFileStates(LIST_UNIT_FILES))

    expect(units.map((unit) => unit.unit)).toEqual(['nginx.service', 'ssh.service'])
    expect(units[0]).toMatchObject({
      unit: 'nginx.service',
      activeState: 'failed',
      unitFileState: 'disabled'
    })
    expect(units[1].unitFileState).toBe('enabled')
  })

  it('leaves the unit file state empty when it is unknown', () => {
    const units = mergeUnits(
      [{ unit: 'custom.service', load: 'loaded', active: 'active', sub: 'running', description: '' }],
      new Map()
    )
    expect(units[0].unitFileState).toBe('')
  })
})

describe('parseJournalOutput', () => {
  it('splits journal output into non-empty lines', () => {
    expect(parseJournalOutput('line one\r\n\nline two\n')).toEqual(['line one', 'line two'])
  })
})

/** Verbatim `systemctl list-units --type=service --all --no-pager --output=json` (systemd 255). */
const REAL_LIST_UNITS_JSON = JSON.stringify([
  {
    unit: 'apt-daily.service',
    load: 'loaded',
    active: 'inactive',
    sub: 'dead',
    description: 'Daily apt download activities'
  },
  {
    unit: 'connman.service',
    load: 'not-found',
    active: 'inactive',
    sub: 'dead',
    description: 'connman.service'
  },
  {
    unit: 'cron.service',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    description: 'Regular background program processing daemon'
  },
  {
    unit: 'ssh.service',
    load: 'loaded',
    active: 'inactive',
    sub: 'dead',
    description: 'OpenBSD Secure Shell server'
  }
])

/** Verbatim `systemctl list-unit-files --type=service --no-pager --plain --no-legend` (systemd 255). */
const REAL_LIST_UNIT_FILES = [
  'apt-daily.service                            static          -',
  'auditd.service                               masked-runtime  enabled',
  'autovt@.service                              alias           -',
  'console-getty.service                        enabled-runtime disabled',
  'cron.service                                 enabled         enabled',
  'ssh.service                                  disabled        enabled',
  'xfs_healer@-.service                         masked-runtime  enabled'
].join('\n')

describe('systemd parsers against real systemd 255 output', () => {
  it('parses the lowercase JSON field names systemd 255 emits', () => {
    const rows = parseListUnitsJson(REAL_LIST_UNITS_JSON)

    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(4)
    expect(rows?.[1]).toEqual({
      unit: 'connman.service',
      load: 'not-found',
      active: 'inactive',
      sub: 'dead',
      description: 'connman.service'
    })
  })

  it('parses list-unit-files states including templates and runtime states', () => {
    const states = parseUnitFileStates(REAL_LIST_UNIT_FILES)

    expect(states.get('cron.service')).toBe('enabled')
    expect(states.get('ssh.service')).toBe('disabled')
    expect(states.get('auditd.service')).toBe('masked-runtime')
    expect(states.get('console-getty.service')).toBe('enabled-runtime')
    expect(states.get('autovt@.service')).toBe('alias')
    expect(states.get('xfs_healer@-.service')).toBe('masked-runtime')
    expect(states.size).toBe(7)
  })

  it('merges real list-units and list-unit-files output', () => {
    const rows = parseListUnitsJson(REAL_LIST_UNITS_JSON) ?? []
    const units = mergeUnits(rows, parseUnitFileStates(REAL_LIST_UNIT_FILES))

    expect(units.map((unit) => unit.unit)).toEqual([
      'apt-daily.service',
      'connman.service',
      'cron.service',
      'ssh.service'
    ])
    expect(units[2]).toMatchObject({
      unit: 'cron.service',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled'
    })
  })

  it('builds a unit detail from real systemctl show output, including an empty timestamp', () => {
    const stdout = [
      'MainPID=0',
      'Id=ssh.service',
      'Description=OpenBSD Secure Shell server',
      'LoadState=loaded',
      'ActiveState=inactive',
      'SubState=dead',
      'FragmentPath=/usr/lib/systemd/system/ssh.service',
      'UnitFileState=disabled',
      'ActiveEnterTimestamp='
    ].join('\n')

    expect(buildUnitDetail('ssh.service', parseShowProperties(stdout))).toEqual({
      unit: 'ssh.service',
      description: 'OpenBSD Secure Shell server',
      loadState: 'loaded',
      activeState: 'inactive',
      subState: 'dead',
      unitFileState: 'disabled',
      mainPid: 0,
      activeEnterTimestamp: '',
      fragmentPath: '/usr/lib/systemd/system/ssh.service'
    })
  })
})

const SYSTEMCTL_CAT = [
  '# /lib/systemd/system/ssh.service',
  '[Unit]',
  'Description=OpenBSD Secure Shell server',
  '# Restarting is handled by the socket unit',
  'After=network.target auditd.service',
  '',
  '[Service]',
  'ExecStart=/usr/sbin/sshd -D $SSHD_OPTS',
  '',
  '# /etc/systemd/system/ssh.service.d/override.conf',
  '[Service]',
  'Restart=always'
].join('\n')

describe('parseUnitFilePaths', () => {
  it('collects the fragment and every drop-in systemctl cat printed', () => {
    expect(parseUnitFilePaths(SYSTEMCTL_CAT)).toEqual([
      '/lib/systemd/system/ssh.service',
      '/etc/systemd/system/ssh.service.d/override.conf'
    ])
  })

  it('ignores comments that are not bare absolute paths', () => {
    expect(parseUnitFilePaths('# Restarting is handled elsewhere\n# see /etc/foo for details')).toEqual(
      []
    )
  })

  it('does not repeat a path systemd printed twice', () => {
    expect(parseUnitFilePaths('# /etc/a.conf\nX=1\n# /etc/a.conf\nY=2')).toEqual(['/etc/a.conf'])
  })

  it('tolerates CRLF output', () => {
    expect(parseUnitFilePaths('# /lib/systemd/system/cron.service\r\n[Unit]\r\n')).toEqual([
      '/lib/systemd/system/cron.service'
    ])
  })
})

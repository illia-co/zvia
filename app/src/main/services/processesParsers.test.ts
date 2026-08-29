import { describe, expect, it } from 'vitest'
import {
  buildProcessDetail,
  filterPortsForPid,
  isProtectedProcess,
  parseProcStatus,
  parsePsOutput,
  parseSshPids,
  splitDetailSections
} from './processesParsers'

const PS_OUTPUT = [
  '    PID USER      %CPU %MEM   RSS STAT ELAPSED COMMAND         COMMAND',
  '   1421 www-data   2.5  1.2  9876 Ssl   86400 nginx           nginx: master process /usr/sbin/nginx -g daemon off;',
  '   1425 www-data   1.8  0.8  6543 S     86400 nginx           nginx: worker process',
  '    800 root       0.1  0.2  4321 Ss   172800 sshd            sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups',
  '   2103 ubuntu     0.0  0.1  2048 Ss     3600 bash            -bash',
  '      2 root       0.0  0.0     0 S    172800 [kthreadd]',
  '      1 root       0.0  0.0  1024 Ss   172800 systemd         /sbin/init'
].join('\n')

const DETAIL_OUTPUT = [
  '---RELAY:STATUS---',
  'Name:\tnginx',
  'State:\tS (sleeping)',
  'Pid:\t1421',
  'PPid:\t1',
  'Uid:\t33\t33\t33\t33',
  '---RELAY:CMDLINE---',
  'nginx: master process /usr/sbin/nginx -g daemon off;',
  '---RELAY:EXE---',
  '/usr/sbin/nginx',
  '---RELAY:CWD---',
  '/var/cache/nginx',
  '---RELAY:CGROUP---',
  '0::/system.slice/nginx.service',
  '---RELAY:SS---',
  'tcp   LISTEN 0      511          0.0.0.0:80        0.0.0.0:*    users:(("nginx",pid=1421,fd=6))',
  'tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=800,fd=3))',
  '---RELAY:DOCKER---',
  '---RELAY:UNIT---',
  'active',
  '---RELAY:SSH-PIDS---',
  '800',
  '2102'
].join('\n')

describe('parsePsOutput', () => {
  it('parses ps snapshot and converts RSS to bytes', () => {
    const rows = parsePsOutput(PS_OUTPUT)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({
      pid: 1421,
      user: 'www-data',
      cpuPercent: 2.5,
      memoryPercent: 1.2,
      rssBytes: 9876 * 1024,
      stat: 'Ssl',
      elapsedSeconds: 86400,
      comm: 'nginx',
      args: 'nginx: master process /usr/sbin/nginx -g daemon off;'
    })
  })
})

describe('parseProcStatus', () => {
  it('extracts status fields', () => {
    expect(
      parseProcStatus(
        ['Name:\tnginx', 'State:\tS (sleeping)', 'PPid:\t1', 'Uid:\t33\t33\t33\t33'].join('\n')
      )
    ).toEqual({
      name: 'nginx',
      state: 'sleeping',
      ppid: 1,
      uid: 33
    })
  })
})

describe('isProtectedProcess', () => {
  it('protects init, kernel threads, and sshd', () => {
    const sshPids = new Set([800])
    expect(isProtectedProcess(1, 'systemd', sshPids).protected).toBe(true)
    expect(isProtectedProcess(2, '[kthreadd]', sshPids).protected).toBe(true)
    expect(isProtectedProcess(800, 'sshd', sshPids).protected).toBe(true)
    expect(isProtectedProcess(1421, 'nginx', sshPids).protected).toBe(false)
  })
})

describe('parseSshPids', () => {
  it('collects pid lines', () => {
    expect(parseSshPids('800\n2102\n\n')).toEqual([800, 2102])
  })
})

describe('filterPortsForPid', () => {
  it('returns listeners owned by the pid', () => {
    const ss = [
      'tcp   LISTEN 0      511          0.0.0.0:80        0.0.0.0:*    users:(("nginx",pid=1421,fd=6))',
      'tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=800,fd=3))'
    ].join('\n')
    expect(filterPortsForPid(ss, 1421)).toEqual([
      { protocol: 'tcp', address: '0.0.0.0', port: 80 }
    ])
  })
})

describe('buildProcessDetail', () => {
  it('merges summary with proc and attribution data', () => {
    const [summary] = parsePsOutput(PS_OUTPUT)
    const sections = splitDetailSections(DETAIL_OUTPUT)
    const detail = buildProcessDetail(summary, sections, 'nginx.service')

    expect(detail).toMatchObject({
      pid: 1421,
      ppid: 1,
      uid: 33,
      state: 'sleeping',
      exe: '/usr/sbin/nginx',
      cwd: '/var/cache/nginx',
      unit: 'nginx.service',
      unitActiveState: 'active',
      cgroupUnit: 'nginx.service',
      listeningPorts: [{ protocol: 'tcp', address: '0.0.0.0', port: 80 }],
      protected: false
    })
  })
})

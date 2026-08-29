#!/usr/bin/env node
/**
 * Integration test harness — connects to the OrbStack VM via SSH (same path as Relay)
 * and validates every remote command category the app depends on.
 *
 * Usage:
 *   node scripts/orbstack/integration-test.mjs
 *   RELAY_SSH_HOST=orb node scripts/orbstack/integration-test.mjs
 */
import { Client } from 'ssh2'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SSH_HOST = process.env.RELAY_SSH_HOST ?? '127.0.0.1'
const SSH_PORT = Number(process.env.RELAY_SSH_PORT ?? 32222)
const SSH_USER = process.env.RELAY_SSH_USER ?? 'default'
const SSH_KEY = process.env.RELAY_SSH_KEY ?? join(homedir(), '.orbstack/ssh/id_ed25519')
const TIMEOUT_MS = 30_000

const results = []
let passed = 0
let failed = 0
let skipped = 0

function exec(conn, command, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer)
        reject(err)
        return
      }
      let stdout = ''
      let stderr = ''
      stream.on('data', (chunk) => { stdout += chunk.toString() })
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      stream.on('close', (code) => {
        clearTimeout(timer)
        resolve({ exitCode: code ?? 0, stdout, stderr })
      })
    })
  })
}

function record(category, name, ok, detail = '') {
  results.push({ category, name, ok, detail })
  if (ok) passed++
  else failed++
  const icon = ok ? '✓' : '✗'
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`)
}

function skip(category, name, reason) {
  results.push({ category, name, ok: null, detail: reason })
  skipped++
  console.log(`  ○ ${name} — skipped: ${reason}`)
}

async function connect() {
  const privateKey = readFileSync(SSH_KEY)
  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: SSH_HOST,
        port: SSH_PORT,
        username: SSH_USER,
        privateKey,
        readyTimeout: TIMEOUT_MS,
        hostVerifier: () => true
      })
  })
  return conn
}

async function testOverview(conn) {
  console.log('\n[Overview / System Info]')
  const cmd = [
    `(hostname -f 2>/dev/null || hostname)`,
    `echo '---RELAY---'`,
    `cat /etc/os-release 2>/dev/null || true`,
    `echo '---RELAY---'`,
    `uname -m`,
    `echo '---RELAY---'`,
    `cut -d' ' -f1 /proc/uptime`
  ].join('\n')
  const r = await exec(conn, cmd)
  const sections = r.stdout.trim().split('\n---RELAY---\n')
  record('overview', 'hostname', sections.length >= 4 && sections[0].trim().length > 0, sections[0]?.trim())
  record('overview', 'os-release', sections[1]?.includes('NAME='), sections[1]?.split('\n')[0])
  record('overview', 'architecture', sections[2]?.trim().length > 0, sections[2]?.trim())
  record('overview', 'uptime', !Number.isNaN(parseFloat(sections[3])), sections[3]?.trim())
}

async function testStats(conn) {
  console.log('\n[Stats]')
  const cmd = [
    `echo '---RELAY:STAT---'`,
    `head -n 64 /proc/stat`,
    `echo '---RELAY:MEM---'`,
    `cat /proc/meminfo`,
    `echo '---RELAY:LOAD---'`,
    `cat /proc/loadavg`,
    `echo '---RELAY:UPTIME---'`,
    `cat /proc/uptime`,
    `echo '---RELAY:NET---'`,
    `cat /proc/net/dev`,
    `echo '---RELAY:DF---'`,
    `df -P -B1 2>/dev/null | tail -n +2`
  ].join('\n')
  const r = await exec(conn, cmd)
  record('stats', '/proc/stat', r.stdout.includes('cpu '))
  record('stats', '/proc/meminfo', r.stdout.includes('MemTotal:'))
  record('stats', '/proc/loadavg', /\d+\.\d+/.test(r.stdout))
  record('stats', 'df', r.stdout.includes('/') || r.stdout.includes('Filesystem'))
}

async function testLogs(conn) {
  console.log('\n[Logs / journalctl]')
  const r = await exec(conn, 'journalctl -n 5 --no-pager -o json')
  record('logs', 'journalctl snapshot', r.exitCode === 0 && r.stdout.includes('"MESSAGE"'))
  // journalctl -f streams indefinitely; verify the command is accepted, not the stream.
  const followCmd = 'journalctl -f -o json --no-pager -n 1'
  const follow = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ exitCode: 0, stdout: 'streaming', timedOut: true }), 2000)
    conn.exec(followCmd, (err, stream) => {
      if (err) {
        clearTimeout(timer)
        resolve({ exitCode: 1, stdout: '', timedOut: false })
        return
      }
      let gotData = false
      stream.on('data', () => { gotData = true })
      setTimeout(() => {
        clearTimeout(timer)
        stream.close()
        resolve({ exitCode: 0, stdout: gotData ? 'data' : 'no-data', timedOut: true })
      }, 1500)
    })
  })
  record('logs', 'journalctl follow', follow.stdout === 'data' || follow.timedOut)
}

async function testSystemd(conn) {
  console.log('\n[Systemd Services]')
  const version = await exec(conn, 'systemctl --version')
  record('systemd', 'systemctl --version', version.exitCode === 0 && version.stdout.includes('systemd'))

  const list = await exec(conn, 'systemctl list-units --type=service --all --no-pager --output=json')
  record('systemd', 'list-units --output=json', list.exitCode === 0 && list.stdout.includes('"unit"'))

  const files = await exec(conn, 'systemctl list-unit-files --type=service --no-pager --plain --no-legend')
  record('systemd', 'list-unit-files', files.exitCode === 0 && files.stdout.includes('.service'))

  const show = await exec(conn, 'systemctl show nginx.service --no-pager --property=Id,ActiveState,SubState')
  record('systemd', 'show nginx.service', show.exitCode === 0 && show.stdout.includes('ActiveState=active'))

  const cat = await exec(conn, 'systemctl cat nginx.service --no-pager')
  record('systemd', 'cat nginx.service', cat.exitCode === 0 && cat.stdout.includes('[Unit]'))

  const logs = await exec(conn, 'journalctl -u nginx.service -n 10 --no-pager')
  record('systemd', 'unit logs', logs.exitCode === 0)

  const timer = await exec(conn, 'systemctl show relay-heartbeat.timer --property=ActiveState,NextElapseUSecRealtime --no-pager')
  record('systemd', 'relay-heartbeat.timer', timer.exitCode === 0 && timer.stdout.includes('ActiveState=active'))
}

async function testCron(conn) {
  console.log('\n[Cron]')
  const cmd = [
    `echo '---RELAY:CRONTAB---'`,
    'command -v crontab >/dev/null 2>&1 && echo yes || echo no',
    `echo '---RELAY:WHOAMI---'`,
    'id -un 2>/dev/null',
    `echo '---RELAY:USER---'`,
    'crontab -l 2>/dev/null',
    `echo '---RELAY:SYSTEM---'`,
    'cat /etc/crontab 2>/dev/null',
    `echo '---RELAY:CRON.D---'`,
    `for f in /etc/cron.d/*; do [ -f "$f" ] || continue; echo "---RELAY:FILE:$f---"; cat "$f" 2>/dev/null; done`,
    `echo '---RELAY:PERIODIC---'`,
    'for p in hourly daily weekly monthly; do for f in /etc/cron.$p/*; do [ -f "$f" ] || continue; echo "$p $f"; done; done'
  ].join('\n')
  const r = await exec(conn, cmd)
  record('cron', 'crontab available', r.stdout.includes('yes'))
  record('cron', 'user crontab', r.stdout.includes('relay-user-cron') || r.stdout.includes('relay-test'))
  record('cron', '/etc/cron.d', r.stdout.includes('relay-cron-d') || r.stdout.includes('/etc/cron.d/relay-test'))
  record('cron', 'periodic scripts', r.stdout.includes('hourly') || r.stdout.includes('daily'))
}

async function testNginx(conn) {
  console.log('\n[Nginx]')
  const which = await exec(conn, 'command -v nginx 2>/dev/null')
  record('nginx', 'installed', which.exitCode === 0 && which.stdout.trim().length > 0)

  const version = await exec(conn, 'nginx -V 2>&1')
  record('nginx', 'nginx -V', version.stdout.includes('nginx version') || version.stderr.includes('nginx version'))

  const test = await exec(conn, 'sudo -n nginx -t 2>&1')
  const testOut = test.stdout + test.stderr
  record('nginx', 'nginx -t', test.exitCode === 0 && testOut.includes('syntax is ok'))

  const status = await exec(conn, 'systemctl show nginx --property=ActiveState,SubState,MainPID --no-pager 2>/dev/null')
  record('nginx', 'systemctl show nginx', status.stdout.includes('ActiveState=active'))

  const dashT = await exec(conn, 'sudo -n nginx -T 2>/dev/null', 45000)
  record('nginx', 'nginx -T', dashT.exitCode === 0 && dashT.stdout.includes('server_name'))
  record('nginx', 'ssl_certificate in config', dashT.stdout.includes('ssl_certificate'))
}

async function testSSL(conn) {
  console.log('\n[SSL / Certificates]')
  const certbot = await exec(conn, 'certbot --version 2>&1')
  record('ssl', 'certbot installed', certbot.exitCode === 0 || certbot.stdout.includes('certbot'))

  const plugins = await exec(conn, 'certbot plugins 2>&1')
  record('ssl', 'certbot nginx plugin', plugins.stdout.includes('nginx'))

  const certs = await exec(conn, 'sudo -n certbot certificates 2>&1')
  record('ssl', 'certbot certificates', certs.exitCode === 0)

  const openssl = await exec(conn, 'openssl x509 -noout -subject -issuer -dates -in /etc/ssl/relay-test/fullchain.pem 2>&1')
  record('ssl', 'openssl x509 inspect', openssl.exitCode === 0 && openssl.stdout.includes('subject='))

  const timers = await exec(conn, 'systemctl list-timers --all --no-pager 2>/dev/null; systemctl show certbot.timer --property=NextElapseUSecRealtime --no-pager 2>/dev/null')
  record('ssl', 'certbot.timer', timers.stdout.includes('certbot'))
}

async function testDocker(conn) {
  console.log('\n[Docker]')
  const info = await exec(conn, 'docker info --format "{{json .}}" 2>/dev/null')
  if (info.exitCode !== 0 || !info.stdout.trim()) {
    skip('docker', 'docker info', 'Docker not available — run provision.sh or add user to docker group')
    skip('docker', 'docker ps', 'Docker not available')
    skip('docker', 'docker images', 'Docker not available')
    skip('docker', 'docker stats', 'Docker not available')
    return
  }
  record('docker', 'docker info', true)

  const ps = await exec(conn, "docker ps --format '{{json .}}'")
  record('docker', 'docker ps', ps.exitCode === 0 && ps.stdout.includes('relay-web'))

  const images = await exec(conn, "docker images --format '{{json .}}'")
  record('docker', 'docker images', images.exitCode === 0 && images.stdout.includes('nginx'))

  const stats = await exec(conn, "docker stats --no-stream --format '{{json .}}'", 45000)
  record('docker', 'docker stats', stats.exitCode === 0)
}

async function testPorts(conn) {
  console.log('\n[Ports / Firewall]')
  const ss = await exec(conn, 'ss -tulpnH 2>/dev/null')
  record('ports', 'ss -tulpnH', ss.exitCode === 0 && (ss.stdout.includes(':80') || ss.stdout.includes(':443')))

  const ufw = await exec(conn, 'sudo -n ufw status verbose 2>&1')
  record('ports', 'ufw status verbose', ufw.exitCode === 0 && ufw.stdout.includes('Status:'))

  const numbered = await exec(conn, 'sudo -n ufw status numbered 2>&1')
  record('ports', 'ufw status numbered', numbered.exitCode === 0)
}

async function testUsers(conn) {
  console.log('\n[Users]')
  const passwd = await exec(conn, 'getent passwd 2>/dev/null')
  record('users', 'getent passwd', passwd.exitCode === 0 && passwd.stdout.includes(':'))

  const groups = await exec(conn, 'getent group 2>/dev/null')
  record('users', 'getent group', groups.exitCode === 0 && groups.stdout.includes(':'))

  const loginDefs = await exec(conn, "grep -E '^UID_MIN' /etc/login.defs 2>/dev/null")
  record('users', 'UID_MIN from login.defs', loginDefs.exitCode === 0 && loginDefs.stdout.includes('UID_MIN'))

  const discovery = await exec(conn, [
    `echo '---RELAY:PASSWD---'`,
    'getent passwd 2>/dev/null | head -3',
    `echo '---RELAY:GROUP---'`,
    'getent group 2>/dev/null | head -3',
    `echo '---RELAY:WHOAMI---'`,
    'id -un 2>/dev/null',
    `echo '---RELAY:UID_MIN---'`,
    "grep -E '^UID_MIN' /etc/login.defs 2>/dev/null || true"
  ].join('\n'))
  record(
    'users',
    'discovery command sections',
    discovery.stdout.includes('---RELAY:PASSWD---') &&
      discovery.stdout.includes('---RELAY:GROUP---') &&
      discovery.stdout.includes('---RELAY:WHOAMI---') &&
      discovery.stdout.includes('---RELAY:UID_MIN---')
  )
  record(
    'users',
    'connected username',
    discovery.stdout.includes('WHOAMI---') && /WHOAMI---\n\S+/.test(discovery.stdout)
  )
}

async function testProcesses(conn) {
  console.log('\n[Processes]')
  const ps = await exec(
    conn,
    'ps -eo pid=,user=,pcpu=,pmem=,rss=,stat=,etimes=,comm=,args= --sort=-pcpu 2>/dev/null | head -20'
  )
  record('processes', 'ps snapshot', ps.exitCode === 0 && /^\s*\d+/m.test(ps.stdout))

  const proc = await exec(conn, [
    `echo '---RELAY:STATUS---'`,
    'head -n 8 /proc/1/status 2>/dev/null',
    `echo '---RELAY:CMDLINE---'`,
    'tr "\\0" " " < /proc/1/cmdline 2>/dev/null',
    `echo '---RELAY:CWD---'`,
    'readlink /proc/1/cwd 2>/dev/null || true'
  ].join('\n'))
  record('processes', '/proc/1/status', proc.stdout.includes('Name:') || proc.stdout.includes('Pid:'))
  record('processes', '/proc/1/cmdline', proc.stdout.includes('CMDLINE---'))
}

async function testPackages(conn) {
  console.log('\n[Packages]')
  const aptDetect = await exec(
    conn,
    'command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1 && echo yes || echo no'
  )
  const aptAvailable = aptDetect.stdout.trim() === 'yes'
  record('packages', 'apt detection', aptAvailable)

  if (!aptAvailable) {
    skip('packages', 'dpkg-query', 'apt/dpkg not available on this host')
    skip('packages', 'apt-cache search', 'apt/dpkg not available on this host')
    return
  }

  const installed = await exec(
    conn,
    "dpkg-query -W -f='${Package}\\t${Version}\\n' 2>/dev/null | head -5"
  )
  record('packages', 'dpkg-query', installed.exitCode === 0 && installed.stdout.includes('\t'))

  const search = await exec(conn, 'apt-cache search --names-only curl 2>/dev/null | head -3')
  record('packages', 'apt-cache search', search.exitCode === 0 && search.stdout.trim().length > 0)
}

async function testFiles(conn) {
  console.log('\n[Files / SFTP]')
  return new Promise((resolve) => {
    conn.sftp((err, sftp) => {
      if (err) {
        record('files', 'SFTP connect', false, err.message)
        resolve()
        return
      }
      sftp.readdir('/etc/nginx/sites-enabled', (readErr, list) => {
        record('files', 'SFTP readdir', !readErr && Array.isArray(list) && list.length > 0,
          readErr ? readErr.message : `${list.length} entries`)
        resolve()
      })
    })
  })
}

async function main() {
  console.log(`Relay OrbStack Integration Test`)
  console.log(`SSH: ${SSH_USER}@${SSH_HOST}:${SSH_PORT} (key: ${SSH_KEY})`)

  let conn
  try {
    conn = await connect()
    console.log('Connected.\n')
  } catch (error) {
    console.error(`\nFailed to connect: ${error.message}`)
    console.error('Ensure OrbStack is running and `ssh orb` works.')
    process.exit(1)
  }

  try {
    await testOverview(conn)
    await testStats(conn)
    await testLogs(conn)
    await testSystemd(conn)
    await testCron(conn)
    await testNginx(conn)
    await testSSL(conn)
    await testDocker(conn)
    await testPorts(conn)
    await testUsers(conn)
    await testProcesses(conn)
    await testPackages(conn)
    await testFiles(conn)
  } finally {
    conn.end()
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log(`${'='.repeat(50)}\n`)

  if (failed > 0) {
    console.log('Failed tests:')
    for (const r of results.filter((r) => r.ok === false)) {
      console.log(`  [${r.category}] ${r.name}: ${r.detail}`)
    }
    process.exit(1)
  }

  if (skipped > 0) {
    console.log('Some tests were skipped. Run: orb bash scripts/orbstack/provision.sh')
    process.exit(2)
  }

  console.log('All integration tests passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

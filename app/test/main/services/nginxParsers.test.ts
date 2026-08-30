import { describe, expect, it } from 'vitest'
import {
  isInsideDirectory,
  parseNginxLogPaths,
  parseNginxMainPid,
  parseNginxPaths,
  parseNginxTestOutput,
  parseNginxVersion,
  parseSystemctlProperties
} from '@main/services/nginxParsers'

const NGINX_V_OUTPUT = [
  'nginx version: nginx/1.24.0 (Ubuntu)',
  'built with OpenSSL 3.0.2 15 Mar 2022',
  'TLS SNI support enabled',
  "configure arguments: --with-cc-opt='-g -O2 -ffile-prefix-map=/build' --prefix=/usr/share/nginx --conf-path=/etc/nginx/nginx.conf --http-log-path=/var/log/nginx/access.log --error-log-path=/var/log/nginx/error.log --lock-path=/var/lock/nginx.lock --with-http_ssl_module"
].join('\n')

const NGINX_T_OUTPUT = [
  '# configuration file /etc/nginx/nginx.conf:',
  'user www-data;',
  'worker_processes auto;',
  'error_log /var/log/nginx/error.log;',
  'http {',
  '    access_log /var/log/nginx/access.log main;',
  '    # access_log /var/log/nginx/commented.log;',
  '    access_log off;',
  '    error_log syslog:server=127.0.0.1 warn;',
  '}',
  '# configuration file /etc/nginx/sites-enabled/example:',
  'server {',
  '    access_log /var/log/nginx/example.access.log;',
  '    error_log logs/example.error.log;',
  '}'
].join('\n')

describe('parseNginxVersion', () => {
  it('extracts the version from nginx -v output', () => {
    expect(parseNginxVersion('nginx version: nginx/1.18.0')).toBe('1.18.0')
    expect(parseNginxVersion(NGINX_V_OUTPUT)).toBe('1.24.0')
  })

  it('returns null when nginx is not present', () => {
    expect(parseNginxVersion('bash: nginx: command not found')).toBeNull()
  })
})

describe('parseNginxPaths', () => {
  it('derives paths from configure arguments instead of hardcoding them', () => {
    expect(parseNginxPaths(NGINX_V_OUTPUT)).toEqual({
      prefix: '/usr/share/nginx',
      confPath: '/etc/nginx/nginx.conf',
      configRoot: '/etc/nginx',
      errorLogPath: '/var/log/nginx/error.log',
      accessLogPath: '/var/log/nginx/access.log'
    })
  })

  it('resolves relative paths against the prefix', () => {
    const output =
      'configure arguments: --prefix=/opt/nginx --conf-path=conf/nginx.conf --error-log-path=logs/error.log'
    expect(parseNginxPaths(output)).toMatchObject({
      confPath: '/opt/nginx/conf/nginx.conf',
      configRoot: '/opt/nginx/conf',
      errorLogPath: '/opt/nginx/logs/error.log'
    })
  })

  it('returns nulls when configure arguments are unavailable', () => {
    expect(parseNginxPaths('nginx version: nginx/1.24.0')).toEqual({
      prefix: null,
      confPath: null,
      configRoot: null,
      errorLogPath: null,
      accessLogPath: null
    })
  })
})

describe('parseNginxTestOutput', () => {
  it('accepts a successful configuration test', () => {
    const output = [
      'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok',
      'nginx: configuration file /etc/nginx/nginx.conf test is successful'
    ].join('\n')

    expect(parseNginxTestOutput(output)).toEqual({ state: 'valid', output: output.trim() })
  })

  it('preserves failure output verbatim', () => {
    const output =
      'nginx: [emerg] unexpected "}" in /etc/nginx/sites-enabled/example:12\nnginx: configuration file /etc/nginx/nginx.conf test failed'
    const result = parseNginxTestOutput(output)

    expect(result.state).toBe('invalid')
    expect(result.output).toContain('unexpected "}"')
  })

  it('treats a syntax-only pass as invalid', () => {
    expect(parseNginxTestOutput('nginx: ... syntax is ok').state).toBe('invalid')
  })
})

describe('parseNginxLogPaths', () => {
  it('collects effective access and error log destinations', () => {
    const paths = parseNginxLogPaths(NGINX_T_OUTPUT, '/usr/share/nginx')

    expect(paths.accessLogs).toEqual([
      '/var/log/nginx/access.log',
      '/var/log/nginx/example.access.log'
    ])
    expect(paths.errorLogs).toEqual([
      '/var/log/nginx/error.log',
      '/usr/share/nginx/logs/example.error.log'
    ])
  })

  it('skips off, commented and non-file destinations', () => {
    const paths = parseNginxLogPaths(NGINX_T_OUTPUT, '/usr/share/nginx')

    expect(paths.accessLogs).not.toContain('off')
    expect(paths.accessLogs.some((path) => path.includes('commented'))).toBe(false)
    expect(paths.errorLogs.some((path) => path.startsWith('syslog'))).toBe(false)
  })

  it('drops relative paths when no prefix is known', () => {
    const paths = parseNginxLogPaths('error_log logs/error.log;')
    expect(paths.errorLogs).toEqual([])
  })
})

describe('parseSystemctlProperties', () => {
  it('parses key/value output and keeps values containing equals signs', () => {
    const stdout = [
      'ActiveState=active',
      'SubState=running',
      'MainPID=1200',
      'ActiveEnterTimestamp=Fri 2026-08-28 10:12:33 UTC',
      'UnitFileState=enabled',
      'Environment=KEY=value'
    ].join('\n')

    expect(parseSystemctlProperties(stdout)).toEqual({
      ActiveState: 'active',
      SubState: 'running',
      MainPID: '1200',
      ActiveEnterTimestamp: 'Fri 2026-08-28 10:12:33 UTC',
      UnitFileState: 'enabled',
      Environment: 'KEY=value'
    })
  })
})

describe('parseNginxMainPid', () => {
  it('reads the first PID from ps output', () => {
    expect(parseNginxMainPid('  1200\n  1201\n')).toBe(1200)
    expect(parseNginxMainPid('')).toBeNull()
  })
})

describe('isInsideDirectory', () => {
  it('confines config paths to the detected config root', () => {
    expect(isInsideDirectory('/etc/nginx', '/etc/nginx/nginx.conf')).toBe(true)
    expect(isInsideDirectory('/etc/nginx/', '/etc/nginx/sites-available/example')).toBe(true)
    expect(isInsideDirectory('/etc/nginx', '/etc/nginx')).toBe(true)
    expect(isInsideDirectory('/etc/nginx', '/etc/nginx-other/nginx.conf')).toBe(false)
    expect(isInsideDirectory('/etc/nginx', '/etc/nginx/../passwd')).toBe(false)
    expect(isInsideDirectory('/etc/nginx', 'nginx.conf')).toBe(false)
  })
})

/**
 * Verbatim `nginx -V` from nginx/1.24.0 (nginx-core 1.24.0-2ubuntu7.17) on
 * Ubuntu 24.04.4 LTS. Two details matter: the Debian build sets
 * `--error-log-path=stderr` rather than a file, and the compiler flags contain
 * `-ffile-prefix-map=` and `-fdebug-prefix-map=`, which must not be mistaken
 * for `--prefix=`.
 */
const REAL_NGINX_V = [
  'nginx version: nginx/1.24.0 (Ubuntu)',
  'built with OpenSSL 3.0.13 30 Jan 2024',
  'TLS SNI support enabled',
  "configure arguments: --with-cc-opt='-g -O2 -fno-omit-frame-pointer -mno-omit-leaf-frame-pointer -ffile-prefix-map=/build/nginx-uMuTY8/nginx-1.24.0=. -flto=auto -ffat-lto-objects -fstack-protector-strong -fstack-clash-protection -Wformat -Werror=format-security -mbranch-protection=standard -fdebug-prefix-map=/build/nginx-uMuTY8/nginx-1.24.0=/usr/src/nginx-1.24.0-2ubuntu7.17 -fPIC -Wdate-time -D_FORTIFY_SOURCE=3' --with-ld-opt='-Wl,-Bsymbolic-functions -flto=auto -ffat-lto-objects -Wl,-z,relro -Wl,-z,now -fPIC' --prefix=/usr/share/nginx --conf-path=/etc/nginx/nginx.conf --http-log-path=/var/log/nginx/access.log --error-log-path=stderr --lock-path=/var/lock/nginx.lock --pid-path=/run/nginx.pid --modules-path=/usr/lib/nginx/modules --http-client-body-temp-path=/var/lib/nginx/body --http-fastcgi-temp-path=/var/lib/nginx/fastcgi --http-proxy-temp-path=/var/lib/nginx/proxy --http-scgi-temp-path=/var/lib/nginx/scgi --http-uwsgi-temp-path=/var/lib/nginx/uwsgi --with-compat --with-debug --with-pcre-jit --with-http_ssl_module --with-http_stub_status_module --with-http_realip_module --with-http_auth_request_module --with-http_v2_module --with-http_dav_module --with-http_slice_module --with-threads --with-http_addition_module --with-http_flv_module --with-http_gunzip_module --with-http_gzip_static_module --with-http_mp4_module --with-http_random_index_module --with-http_secure_link_module --with-http_sub_module --with-mail_ssl_module --with-stream_ssl_module --with-stream_ssl_preread_module --with-stream_realip_module --with-http_geoip_module=dynamic --with-http_image_filter_module=dynamic --with-http_perl_module=dynamic --with-http_xslt_module=dynamic --with-mail=dynamic --with-stream=dynamic --with-stream_geoip_module=dynamic"
].join('\n')

/**
 * Verbatim excerpt of `sudo nginx -T` on the same host. The stock Debian layout
 * puts `error_log` at column 0 in nginx.conf and tab-indents `access_log`
 * inside the http block.
 */
const REAL_NGINX_T = [
  '# configuration file /etc/nginx/nginx.conf:',
  'user www-data;',
  'worker_processes auto;',
  'pid /run/nginx.pid;',
  'error_log /var/log/nginx/error.log;',
  'include /etc/nginx/modules-enabled/*.conf;',
  '',
  'events {',
  '\tworker_connections 768;',
  '\t# multi_accept on;',
  '}',
  '',
  'http {',
  '\tsendfile on;',
  '\tinclude /etc/nginx/mime.types;',
  '\tdefault_type application/octet-stream;',
  '',
  '\t##',
  '\t# Logging Settings',
  '\t##',
  '',
  '\taccess_log /var/log/nginx/access.log;',
  '',
  '\tinclude /etc/nginx/conf.d/*.conf;',
  '\tinclude /etc/nginx/sites-enabled/*;',
  '}',
  '# configuration file /etc/nginx/sites-enabled/default:',
  'server {',
  '\tlisten 80 default_server;',
  '\tlisten [::]:80 default_server;',
  '',
  '\troot /var/www/html;',
  '\tindex index.html index.htm index.nginx-debian.html;',
  '',
  '\tserver_name _;',
  '}'
].join('\n')

describe('parseNginxPaths against real Ubuntu 24.04 nginx -V output', () => {
  const paths = parseNginxPaths(REAL_NGINX_V)

  it('reads the prefix without matching -ffile-prefix-map or -fdebug-prefix-map', () => {
    expect(paths.prefix).toBe('/usr/share/nginx')
    expect(paths.confPath).toBe('/etc/nginx/nginx.conf')
    expect(paths.configRoot).toBe('/etc/nginx')
  })

  it('reports no default error log when nginx was built with --error-log-path=stderr', () => {
    // Resolving "stderr" against the prefix used to invent
    // /usr/share/nginx/stderr, which was then offered as a tailable log file.
    expect(paths.errorLogPath).toBeNull()
    expect(paths.accessLogPath).toBe('/var/log/nginx/access.log')
  })
})

describe('parseNginxLogPaths against real Ubuntu 24.04 nginx -T output', () => {
  it('finds both log destinations from the stock Debian config', () => {
    const paths = parseNginxLogPaths(REAL_NGINX_T, '/usr/share/nginx')

    expect(paths.accessLogs).toEqual(['/var/log/nginx/access.log'])
    expect(paths.errorLogs).toEqual(['/var/log/nginx/error.log'])
  })
})

describe('nginx status parsers against real Ubuntu 24.04 output', () => {
  it('parses nginx -v and nginx -t from the packaged build', () => {
    expect(parseNginxVersion('nginx version: nginx/1.24.0 (Ubuntu)')).toBe('1.24.0')
    expect(parseNginxVersion(REAL_NGINX_V)).toBe('1.24.0')

    const test = parseNginxTestOutput(
      [
        'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok',
        'nginx: configuration file /etc/nginx/nginx.conf test is successful'
      ].join('\n')
    )
    expect(test.state).toBe('valid')
  })

  it('treats an unprivileged nginx -t as invalid rather than valid', () => {
    // Without root, nginx passes the syntax check and then fails on /run/nginx.pid.
    const output = [
      '2026/08/29 11:53:05 [warn] 10671#10671: the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /etc/nginx/nginx.conf:1',
      'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok',
      '2026/08/29 11:53:05 [emerg] 10671#10671: open() "/run/nginx.pid" failed (13: Permission denied)',
      'nginx: configuration file /etc/nginx/nginx.conf test failed'
    ].join('\n')

    expect(parseNginxTestOutput(output).state).toBe('invalid')
  })

  it('parses systemctl show output, which orders MainPID before ActiveState', () => {
    const stdout = [
      'MainPID=9337',
      'ActiveState=active',
      'SubState=running',
      'UnitFileState=enabled',
      'ActiveEnterTimestamp=Sat 2026-08-29 11:49:52 CEST'
    ].join('\n')

    expect(parseSystemctlProperties(stdout)).toEqual({
      MainPID: '9337',
      ActiveState: 'active',
      SubState: 'running',
      UnitFileState: 'enabled',
      ActiveEnterTimestamp: 'Sat 2026-08-29 11:49:52 CEST'
    })
  })

  it('takes the master PID from the worker list printed by ps -o pid= -C nginx', () => {
    const stdout = ['   9337', '   9340', '   9341', '   9342', '   9343'].join('\n')
    expect(parseNginxMainPid(stdout)).toBe(9337)
  })
})

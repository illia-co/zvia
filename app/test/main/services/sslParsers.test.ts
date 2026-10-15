import { describe, expect, it } from 'vitest'
import {
  certEntriesFromRenewalConfs,
  deriveStatus,
  linkCertificatesToSites,
  liveDirCertEntries,
  parseCertbotCertificates,
  parseCertbotVersion,
  parseNginxServerBlocks,
  parseOpensslCertificate,
  parseRenewalConf,
  parseSystemdTimer,
  sameLetsEncryptCert
} from '@main/services/sslParsers'

const OPENSSL_OUTPUT = [
  'subject=CN = example.com',
  "issuer=C = US, O = Let's Encrypt, CN = R3",
  'notBefore=Jan  1 00:00:00 2024 GMT',
  'notAfter=Apr  1 00:00:00 2024 GMT',
  'serial=04A1B2C3D4E5F6',
  'X509v3 Subject Alternative Name:',
  '    DNS:example.com, DNS:www.example.com'
].join('\n')

const CERTBOT_CERTIFICATES = [
  'Found the following certs:',
  '  Certificate Name: example.com',
  '    Serial Number: 04a1b2c3d4e5f6',
  '    Key Type: RSA',
  '    Domains: example.com www.example.com',
  '    Expiry Date: 2026-04-01 12:00:00+00:00 (VALID: 89 days)',
  '    Certificate Path: /etc/letsencrypt/live/example.com/fullchain.pem',
  '    Private Key Path: /etc/letsencrypt/live/example.com/privkey.pem',
  '  Certificate Name: expired.example.com',
  '    Domains: expired.example.com',
  '    Expiry Date: 2020-01-01 00:00:00+00:00 (INVALID: EXPIRED)',
  '    Certificate Path: /etc/letsencrypt/live/expired.example.com/fullchain.pem',
  '    Private Key Path: /etc/letsencrypt/live/expired.example.com/privkey.pem'
].join('\n')

const NGINX_T_OUTPUT = [
  '# configuration file /etc/nginx/nginx.conf:',
  'http {',
  '    include /etc/nginx/sites-enabled/*;',
  '}',
  '# configuration file /etc/nginx/sites-enabled/example:',
  'server {',
  '    listen 80;',
  '    listen 443 ssl;',
  '    server_name example.com www.example.com;',
  '    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;',
  '    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;',
  '}',
  '# configuration file /etc/nginx/sites-enabled/other:',
  'server {',
  '    listen 8080;',
  '    server_name other.local;',
  '}'
].join('\n')

const SYSTEMD_TIMER_OUTPUT = [
  'NextElapseUSecRealtime=Sat 2026-08-30 03:12:00 UTC',
  'LastTriggerUSec=Sat 2026-08-23 03:12:01 UTC',
  'Result=success'
].join('\n')

const RENEWAL_CONF = [
  '# renew_before_expiry = 30 days',
  'version = 2.9.0',
  'archive_dir = /etc/letsencrypt/archive/example.com',
  'cert = /etc/letsencrypt/live/example.com/cert.pem',
  'privkey = /etc/letsencrypt/live/example.com/privkey.pem',
  'authenticator = nginx',
  'installer = nginx'
].join('\n')

describe('parseOpensslCertificate', () => {
  it('extracts subject, issuer, dates, serial and SANs', () => {
    const result = parseOpensslCertificate(OPENSSL_OUTPUT)
    expect(result.subjectCn).toBe('example.com')
    expect(result.issuer).toContain("Let's Encrypt")
    expect(result.notBefore).toBeTruthy()
    expect(result.notAfter).toBeTruthy()
    expect(result.serial).toBe('04A1B2C3D4E5F6')
    expect(result.sans).toEqual(['example.com', 'www.example.com'])
  })
})

describe('parseCertbotCertificates', () => {
  it('parses certificate entries with paths and validity', () => {
    const entries = parseCertbotCertificates(CERTBOT_CERTIFICATES)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      certName: 'example.com',
      domains: ['example.com', 'www.example.com'],
      certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
      privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem',
      valid: true
    })
    expect(entries[1].valid).toBe(false)
  })
})

describe('parseCertbotVersion', () => {
  it('extracts the certbot version string', () => {
    expect(parseCertbotVersion('certbot 2.9.0')).toBe('2.9.0')
  })
})

describe('parseNginxServerBlocks', () => {
  it('extracts server blocks with config paths and ssl directives', () => {
    const blocks = parseNginxServerBlocks(NGINX_T_OUTPUT)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({
      configPath: '/etc/nginx/sites-enabled/example',
      serverNames: ['example.com', 'www.example.com'],
      listensHttps: true,
      ports: [80, 443],
      sslCertificate: '/etc/letsencrypt/live/example.com/fullchain.pem',
      sslCertificateKey: '/etc/letsencrypt/live/example.com/privkey.pem'
    })
    expect(blocks[1].listensHttps).toBe(false)
  })
})

describe('parseSystemdTimer', () => {
  it('parses next run, last attempt and result', () => {
    expect(parseSystemdTimer(SYSTEMD_TIMER_OUTPUT)).toEqual({
      nextRun: 'Sat 2026-08-30 03:12:00 UTC',
      lastAttempt: 'Sat 2026-08-23 03:12:01 UTC',
      lastResult: 'success'
    })
  })
})

describe('parseRenewalConf', () => {
  it('parses authenticator, installer and certificate paths', () => {
    expect(parseRenewalConf(RENEWAL_CONF)).toEqual({
      authenticator: 'nginx',
      installer: 'nginx',
      certificatePath: '/etc/letsencrypt/live/example.com/cert.pem',
      privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem'
    })
  })
})

describe('deriveStatus', () => {
  const now = new Date('2026-03-01T00:00:00Z')

  it('marks certificates expiring within 30 days', () => {
    expect(
      deriveStatus({
        notAfter: '2026-03-20T00:00:00Z',
        managedByCertbot: true,
        lastRenewalResult: null,
        now
      })
    ).toBe('expiring-soon')
  })

  it('marks expired certificates', () => {
    expect(
      deriveStatus({
        notAfter: '2025-01-01T00:00:00Z',
        managedByCertbot: true,
        lastRenewalResult: null,
        now
      })
    ).toBe('expired')
  })

  it('marks renewal failures for certbot-managed certs', () => {
    expect(
      deriveStatus({
        notAfter: '2026-06-01T00:00:00Z',
        managedByCertbot: true,
        lastRenewalResult: 'failure',
        now
      })
    ).toBe('renewal-failed')
  })

  it('marks non-certbot certs as renewal-unavailable', () => {
    expect(
      deriveStatus({
        notAfter: '2026-06-01T00:00:00Z',
        managedByCertbot: false,
        lastRenewalResult: null,
        now
      })
    ).toBe('renewal-unavailable')
  })
})

describe('linkCertificatesToSites', () => {
  it('links certificates to nginx server blocks by path', () => {
    const blocks = parseNginxServerBlocks(NGINX_T_OUTPUT)
    const now = new Date('2026-03-01T00:00:00Z')
    const certs = linkCertificatesToSites(
      [
        {
          id: 'example.com',
          certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
          privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem',
          managedByCertbot: true,
          openssl: parseOpensslCertificate(OPENSSL_OUTPUT),
          certbotDomains: ['example.com', 'www.example.com'],
          expiryDate: null,
          inspectionError: null,
          lastRenewalResult: null,
          renewalMethod: 'systemd-timer',
          lastAttempt: null
        }
      ],
      blocks,
      now
    )

    expect(certs[0].nginxSites).toHaveLength(1)
    expect(certs[0].nginxSites[0].configPath).toBe('/etc/nginx/sites-enabled/example')
    expect(certs[0].primaryDomain).toBe('example.com')
  })

  it('links renewal-conf cert.pem to nginx fullchain.pem in the same live dir', () => {
    const blocks = parseNginxServerBlocks(NGINX_T_OUTPUT)
    const now = new Date('2026-03-01T00:00:00Z')
    expect(
      sameLetsEncryptCert(
        '/etc/letsencrypt/live/example.com/cert.pem',
        '/etc/letsencrypt/live/example.com/fullchain.pem'
      )
    ).toBe(true)
    const certs = linkCertificatesToSites(
      [
        {
          id: 'example.com',
          certificatePath: '/etc/letsencrypt/live/example.com/cert.pem',
          privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem',
          managedByCertbot: true,
          openssl: parseOpensslCertificate(OPENSSL_OUTPUT),
          certbotDomains: [],
          expiryDate: null,
          inspectionError: null,
          lastRenewalResult: null,
          renewalMethod: 'systemd-timer',
          lastAttempt: null
        }
      ],
      blocks,
      now
    )

    expect(certs[0].nginxSites).toHaveLength(1)
  })

  it('links a copied cert path to the site by domain overlap', () => {
    const blocks = parseNginxServerBlocks(NGINX_T_OUTPUT).map((block) => ({
      ...block,
      // ponytail: nginx serves a copy outside /etc/letsencrypt — path match fails
      sslCertificate: '/opt/shop/ssl/fullchain.pem',
      sslCertificateKey: '/opt/shop/ssl/privkey.pem'
    }))
    const now = new Date('2026-03-01T00:00:00Z')
    const certs = linkCertificatesToSites(
      [
        {
          id: 'example.com',
          certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
          privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem',
          managedByCertbot: true,
          openssl: null,
          certbotDomains: ['example.com', 'www.example.com'],
          expiryDate: null,
          inspectionError: null,
          lastRenewalResult: null,
          renewalMethod: 'systemd-timer',
          lastAttempt: null
        }
      ],
      blocks,
      now
    )

    expect(certs[0].nginxSites).toHaveLength(1)
    expect(certs[0].primaryDomain).toBe('example.com')
  })

  it('falls back to linked site server_names when openssl is unreadable', () => {
    const blocks = parseNginxServerBlocks(NGINX_T_OUTPUT)
    const now = new Date('2026-03-01T00:00:00Z')
    const certs = linkCertificatesToSites(
      [
        {
          id: 'example.com',
          certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
          privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem',
          managedByCertbot: true,
          openssl: null,
          certbotDomains: [],
          expiryDate: null,
          inspectionError: 'permission denied',
          lastRenewalResult: null,
          renewalMethod: 'systemd-timer',
          lastAttempt: null
        }
      ],
      blocks,
      now
    )

    expect(certs[0].primaryDomain).toBe('example.com')
    expect(certs[0].domains).toEqual(['example.com', 'www.example.com'])
    expect(certs[0].nginxSites).toHaveLength(1)
  })
})

describe('certEntriesFromRenewalConfs', () => {
  it('builds entries and normalizes cert.pem to fullchain.pem', () => {
    const entries = certEntriesFromRenewalConfs([
      { file: '/etc/letsencrypt/renewal/example.com.conf', content: RENEWAL_CONF }
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      certName: 'example.com',
      certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
      privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem'
    })
  })

  it('skips empty confs', () => {
    expect(certEntriesFromRenewalConfs([{ file: '/etc/letsencrypt/renewal/empty.conf', content: '' }])).toHaveLength(0)
  })
})

describe('liveDirCertEntries', () => {
  it('builds fullchain/privkey paths per live dir', () => {
    const entries = liveDirCertEntries(['example.com'])
    expect(entries[0]).toMatchObject({
      certName: 'example.com',
      certificatePath: '/etc/letsencrypt/live/example.com/fullchain.pem',
      privateKeyPath: '/etc/letsencrypt/live/example.com/privkey.pem'
    })
  })

  it('skips the README file in the live directory', () => {
    const entries = liveDirCertEntries(['README', 'example.com'])
    expect(entries).toHaveLength(1)
    expect(entries[0].certName).toBe('example.com')
  })
})

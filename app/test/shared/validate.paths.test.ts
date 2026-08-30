import { describe, expect, it } from 'vitest'
import { ValidationError } from '@shared/errors'
import {
  getProtectedSystemdUnitActionBlock,
  isProtectedSystemdUnit
} from '@shared/systemd'
import {
  validateFilesDeleteRequest,
  validateFilesWriteRequest,
  validateServicesActionRequest
} from '@shared/validate'

describe('validateFilesDeleteRequest path safety', () => {
  it('rejects parent directory segments', () => {
    expect(() =>
      validateFilesDeleteRequest({
        serverId: 'production',
        path: '/home/foo/../../etc'
      })
    ).toThrow(ValidationError)
  })

  it('blocks critical paths without confirmation', () => {
    expect(() =>
      validateFilesDeleteRequest({
        serverId: 'production',
        path: '/etc/hosts'
      })
    ).toThrow(/explicit confirmation/i)
  })

  it('allows critical path deletes when confirmed', () => {
    expect(
      validateFilesDeleteRequest({
        serverId: 'production',
        path: '/etc/hosts',
        dangerousPathConfirmed: true
      })
    ).toEqual({
      serverId: 'production',
      path: '/etc/hosts',
      dangerousPathConfirmed: true
    })
  })

  it('accepts ordinary absolute paths', () => {
    expect(
      validateFilesDeleteRequest({
        serverId: 'production',
        path: '/home/ubuntu/site'
      })
    ).toEqual({
      serverId: 'production',
      path: '/home/ubuntu/site'
    })
  })
})

describe('validateFilesWriteRequest critical paths', () => {
  it('requires confirmation for writes under /etc', () => {
    expect(() =>
      validateFilesWriteRequest({
        serverId: 'production',
        path: '/etc/nginx/nginx.conf',
        content: 'server {}'
      })
    ).toThrow(/explicit confirmation/i)
  })
})

describe('protected systemd units', () => {
  it('identifies ssh units as protected', () => {
    expect(isProtectedSystemdUnit('ssh.service')).toBe(true)
    expect(isProtectedSystemdUnit('nginx.service')).toBe(false)
  })

  it('blocks stop and disable on ssh', () => {
    expect(getProtectedSystemdUnitActionBlock('ssh.service', 'stop')).toMatch(/SSH/i)
    expect(getProtectedSystemdUnitActionBlock('ssh.service', 'disable')).toMatch(/SSH/i)
    expect(getProtectedSystemdUnitActionBlock('ssh.service', 'restart')).toBeNull()
  })

  it('enforces the block in services action validation', () => {
    expect(() =>
      validateServicesActionRequest({
        serverId: 'production',
        unit: 'ssh.service',
        action: 'stop'
      })
    ).toThrow(/SSH/i)
  })
})

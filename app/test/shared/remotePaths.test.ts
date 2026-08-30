import { describe, expect, it } from 'vitest'
import {
  collapseAbsolutePath,
  getCriticalPathMutationWarning,
  isCriticalSystemPath,
  remotePathHasParentSegment
} from '@shared/remotePaths'

describe('remotePathHasParentSegment', () => {
  it('detects parent directory segments', () => {
    expect(remotePathHasParentSegment('/home/foo/../../etc')).toBe(true)
    expect(remotePathHasParentSegment('/var/log/../etc/passwd')).toBe(true)
  })

  it('accepts ordinary absolute paths', () => {
    expect(remotePathHasParentSegment('/etc/nginx/nginx.conf')).toBe(false)
    expect(remotePathHasParentSegment('/home/user/file')).toBe(false)
  })
})

describe('collapseAbsolutePath', () => {
  it('collapses repeated slashes', () => {
    expect(collapseAbsolutePath('/lib//systemd/system/')).toBe('/lib/systemd/system')
  })
})

describe('getCriticalPathMutationWarning', () => {
  it('warns for the filesystem root', () => {
    expect(getCriticalPathMutationWarning('/')).toMatch(/filesystem root/i)
  })

  it('warns for critical system prefixes', () => {
    expect(getCriticalPathMutationWarning('/etc/nginx/nginx.conf')).toMatch(/\/etc/)
    expect(getCriticalPathMutationWarning('/boot/grub')).toMatch(/\/boot/)
    expect(getCriticalPathMutationWarning('/var/lib/docker')).toMatch(/\/var\/lib/)
  })

  it('returns null for ordinary user paths', () => {
    expect(getCriticalPathMutationWarning('/home/ubuntu/app')).toBeNull()
    expect(getCriticalPathMutationWarning('/var/www/html')).toBeNull()
  })
})

describe('isCriticalSystemPath', () => {
  it('treats root and critical prefixes as critical', () => {
    expect(isCriticalSystemPath('/')).toBe(true)
    expect(isCriticalSystemPath('/etc/passwd')).toBe(true)
    expect(isCriticalSystemPath('/home/ubuntu')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { getCriticalPackageRemoveWarning } from '@shared/packages'

describe('getCriticalPackageRemoveWarning', () => {
  it('warns for OpenSSH packages', () => {
    expect(getCriticalPackageRemoveWarning('openssh-server')).toMatch(/SSH/i)
  })

  it('warns for sudo', () => {
    expect(getCriticalPackageRemoveWarning('sudo')).toMatch(/privileged/i)
  })

  it('returns null for ordinary packages', () => {
    expect(getCriticalPackageRemoveWarning('nginx')).toBeNull()
    expect(getCriticalPackageRemoveWarning('certbot')).toBeNull()
  })
})

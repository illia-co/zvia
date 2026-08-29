import { describe, expect, it } from 'vitest'
import { resolveRevealTarget } from './fileUtils'

describe('resolveRevealTarget', () => {
  it('splits a file path into its directory and basename', () => {
    expect(resolveRevealTarget('/etc/cron.d/certbot')).toEqual({
      directory: '/etc/cron.d',
      fileName: 'certbot'
    })
  })

  it('handles a file directly under the root', () => {
    expect(resolveRevealTarget('/etc/crontab')).toEqual({
      directory: '/etc',
      fileName: 'crontab'
    })
    expect(resolveRevealTarget('/swapfile')).toEqual({ directory: '/', fileName: 'swapfile' })
  })

  it('treats a trailing slash as a directory to list', () => {
    expect(resolveRevealTarget('/etc/cron.daily/')).toEqual({
      directory: '/etc/cron.daily',
      fileName: null
    })
    expect(resolveRevealTarget('/')).toEqual({ directory: '/', fileName: null })
  })

  it('collapses repeated separators', () => {
    expect(resolveRevealTarget('/lib//systemd/system/nginx.service')).toEqual({
      directory: '/lib/systemd/system',
      fileName: 'nginx.service'
    })
  })

  it('refuses anything that is not an absolute path', () => {
    // crontab:user and crontab:root are pseudo-paths for crontabs that only
    // exist behind `crontab -l`, and must never be handed to the file manager.
    expect(resolveRevealTarget('crontab:user')).toBeNull()
    expect(resolveRevealTarget('etc/crontab')).toBeNull()
    expect(resolveRevealTarget('')).toBeNull()
    expect(resolveRevealTarget('   ')).toBeNull()
  })

  it('refuses relative segments it cannot open as a file', () => {
    expect(resolveRevealTarget('/etc/.')).toBeNull()
    expect(resolveRevealTarget('/etc/..')).toBeNull()
  })
})

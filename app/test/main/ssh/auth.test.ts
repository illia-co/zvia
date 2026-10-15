import { beforeEach, describe, expect, it, vi } from 'vitest'
import { access, readFile } from 'node:fs/promises'
import { AuthenticationError, PassphraseRequiredError } from '@shared/errors'
import { buildConnectConfig, isEncryptedPrivateKey } from '@main/ssh/auth'

vi.mock('@main/store/secrets', () => ({
  secretsStore: { getPassphrase: vi.fn(async () => null) }
}))

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn()
}))

const accessMock = vi.mocked(access)
const readFileMock = vi.mocked(readFile)

const UNENCRYPTED_KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nplain\n-----END OPENSSH PRIVATE KEY-----'
const ENCRYPTED_KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nENCRYPTED PRIVATE KEY\n-----END OPENSSH PRIVATE KEY-----'

const agentProfile = {
  id: 'srv-1',
  name: 'test',
  hostname: 'example.com',
  username: 'ubuntu',
  port: 22,
  auth: { type: 'ssh-agent' }
} as const

function mockNoKeyFiles(): void {
  accessMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
}

describe('isEncryptedPrivateKey', () => {
  it('detects encrypted keys', () => {
    expect(isEncryptedPrivateKey(ENCRYPTED_KEY)).toBe(true)
    expect(isEncryptedPrivateKey(UNENCRYPTED_KEY)).toBe(false)
  })
})

describe('buildConnectConfig ssh-agent fallback', () => {
  const originalSock = process.env.SSH_AUTH_SOCK

  beforeEach(() => {
    vi.resetAllMocks()
    if (originalSock === undefined) {
      delete process.env.SSH_AUTH_SOCK
    } else {
      process.env.SSH_AUTH_SOCK = originalSock
    }
  })

  it('uses the agent alone when no default key files exist', async () => {
    process.env.SSH_AUTH_SOCK = '/tmp/agent.sock'
    mockNoKeyFiles()

    const config = await buildConnectConfig({ ...agentProfile, auth: { type: 'ssh-agent' } })

    expect(config.agent).toBe('/tmp/agent.sock')
    expect(config.privateKey).toBeUndefined()
  })

  it('falls back to the default key file when the agent is missing', async () => {
    delete process.env.SSH_AUTH_SOCK
    accessMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(UNENCRYPTED_KEY)

    const config = await buildConnectConfig({ ...agentProfile, auth: { type: 'ssh-agent' } })

    expect(config.agent).toBeUndefined()
    expect(config.privateKey).toBe(UNENCRYPTED_KEY)
  })

  it('throws AuthenticationError when neither agent nor key exists', async () => {
    delete process.env.SSH_AUTH_SOCK
    mockNoKeyFiles()

    await expect(
      buildConnectConfig({ ...agentProfile, auth: { type: 'ssh-agent' } })
    ).rejects.toBeInstanceOf(AuthenticationError)
  })

  it('throws PassphraseRequiredError for an encrypted fallback key without passphrase', async () => {
    delete process.env.SSH_AUTH_SOCK
    accessMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(ENCRYPTED_KEY)

    await expect(
      buildConnectConfig({ ...agentProfile, auth: { type: 'ssh-agent' } })
    ).rejects.toBeInstanceOf(PassphraseRequiredError)
  })

  it('uses an explicitly supplied passphrase without persisting it', async () => {
    delete process.env.SSH_AUTH_SOCK
    accessMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(ENCRYPTED_KEY)

    const config = await buildConnectConfig(
      { ...agentProfile, auth: { type: 'ssh-agent' } },
      { passphrase: 'one-time' }
    )

    expect(config.privateKey).toBe(ENCRYPTED_KEY)
    expect(config.passphrase).toBe('one-time')
  })
})

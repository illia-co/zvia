export type ServerId = string

export type AuthMethod =
  | { type: 'ssh-agent' }
  | { type: 'key-file'; privateKeyPath: string; hasPassphrase?: boolean }

export interface ServerProfile {
  id: ServerId
  name: string
  hostname: string
  username: string
  port: number
  auth: AuthMethod
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface ConnectionStateEvent {
  serverId: ServerId
  state: ConnectionState
  error?: string
}

export interface HostKeyPrompt {
  serverId: ServerId
  hostname: string
  port: number
  keyType: string
  fingerprint: string
  isChanged: boolean
}

export type HostKeyDecision = 'accept' | 'reject'

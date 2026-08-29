import type { ServerProfile } from '@shared/server'

export const SCREENSHOT_SERVER_ID = 'production'

export const SCREENSHOT_PROFILE: ServerProfile = {
  id: SCREENSHOT_SERVER_ID,
  name: 'Production',
  hostname: 'production.example.com',
  username: 'ubuntu',
  port: 22,
  auth: { type: 'ssh-agent' }
}

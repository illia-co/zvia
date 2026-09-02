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

export const SCREENSHOT_DEPLOYMENT_ID = 'deployment:api.production.example.com'
export const SCREENSHOT_DEPLOYMENT_ENTITY_ID = 'domain:api.production.example.com'
export const SCREENSHOT_PROD_DEPLOYMENT_ID = 'deployment:production.example.com'
/** Stable-tagged snapshot in screenshot demo history (see screenshotMode demoHistory). */
export const SCREENSHOT_STABLE_BASELINE_ID = '2026-08-25T10:00:00.000Z'

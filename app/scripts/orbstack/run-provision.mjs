#!/usr/bin/env node
/**
 * Runs the OrbStack provision script inside the VM.
 * Translates a macOS path to OrbStack's /mnt/mac mount when needed.
 *
 * Environment variables passed through:
 *   ZVIA_FULLSTACK=1  — deploy shop/api/postgres compose stack
 *   ZVIA_DOMAIN       — base domain (default: zvia-test.local)
 *   FORCE=1           — reprovision even if marker exists
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'provision.sh')
const orbPath = scriptPath.startsWith('/Users/')
  ? `/mnt/mac${scriptPath}`
  : scriptPath

const envParts = []
for (const key of ['ZVIA_FULLSTACK', 'ZVIA_DOMAIN', 'FORCE', 'ZVIA_APP_PORT']) {
  if (process.env[key]) {
    envParts.push(`${key}=${process.env[key]}`)
  }
}
const envPrefix = envParts.length > 0 ? `${envParts.join(' ')} ` : ''

execSync(`orb bash -lc '${envPrefix}bash "${orbPath.replace(/"/g, '\\"')}"'`, { stdio: 'inherit' })

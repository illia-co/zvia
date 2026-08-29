#!/usr/bin/env node
/**
 * Runs the OrbStack provision script inside the VM.
 * Translates a macOS path to OrbStack's /mnt/mac mount when needed.
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'provision.sh')
const orbPath = scriptPath.startsWith('/Users/')
  ? `/mnt/mac${scriptPath}`
  : scriptPath

execSync(`orb bash -lc 'bash "${orbPath.replace(/"/g, '\\"')}"'`, { stdio: 'inherit' })

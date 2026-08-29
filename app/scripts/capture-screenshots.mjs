#!/usr/bin/env node
/**
 * Capture real Relay UI screenshots for the landing page.
 * Launches the built Electron app in screenshot mode with demo data stubs.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(APP_ROOT, '..', 'landing', 'src', 'assets', 'screenshots')
const electronPath = require('electron')

const CAPTURES = [
  { name: 'overview', tool: 'overview' },
  { name: 'stats', tool: 'stats' },
  { name: 'users', tool: 'users' },
  { name: 'processes', tool: 'processes' },
  { name: 'packages', tool: 'packages' },
  { name: 'logs', tool: 'logs' },
  { name: 'files', tool: 'files' },
  { name: 'docker', tool: 'docker' },
  { name: 'ports', tool: 'ports' },
  { name: 'nginx', tool: 'nginx' },
  { name: 'ssl', tool: 'ssl' },
  { name: 'services', tool: 'services' },
  { name: 'cron', tool: 'cron' }
]

async function runCapture(name, tool) {
  const outputPath = join(OUTPUT_DIR, `${name}.png`)

  await new Promise((resolve, reject) => {
    const child = spawn(electronPath, ['.'], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        RELAY_SCREENSHOT: '1',
        RELAY_SCREENSHOT_TOOL: tool,
        RELAY_SCREENSHOT_OUTPUT: outputPath
      },
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`Screenshot capture for "${name}" exited with code ${code}`))
    })
  })
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log('Building app...')
  await new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], { cwd: APP_ROOT, stdio: 'inherit', shell: true })
    build.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error('Build failed'))))
  })

  for (const { name, tool } of CAPTURES) {
    console.log(`Capturing ${name}...`)
    await runCapture(name, tool)
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

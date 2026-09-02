import { ipcMain } from 'electron'
import { writeFileSync } from 'node:fs'
import type { BrowserWindow } from 'electron'
import { getScreenshotTool, isScreenshotMode } from './screenshotMode'

const CAPTURE_WIDTH = 1440
const CAPTURE_HEIGHT = 900
const SETTLE_MS = 2500
const SETTLE_MS_SLOW = 4000
const MOUNT_DELAY_MS = 750

function settleMsForTool(tool: string): number {
  if (tool === 'deployments:diff' || tool === 'deployments:snapshots') {
    return SETTLE_MS_SLOW
  }
  return SETTLE_MS
}

export function configureScreenshotWindow(window: BrowserWindow): void {
  if (!isScreenshotMode()) return

  window.setSize(CAPTURE_WIDTH, CAPTURE_HEIGHT)
  window.setContentSize(CAPTURE_WIDTH, CAPTURE_HEIGHT)
  if (process.env.ZVIA_SCREENSHOT_OUTPUT) {
    window.hide()
  }
}

export async function captureScreenshotIfReady(window: BrowserWindow): Promise<void> {
  if (!isScreenshotMode()) return

  const outputPath = process.env.ZVIA_SCREENSHOT_OUTPUT
  if (!outputPath) {
    console.error('[Zvia] ZVIA_SCREENSHOT_OUTPUT is required in screenshot mode')
    process.exit(1)
  }

  const tool = getScreenshotTool()
  const settleMs = settleMsForTool(tool)

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Screenshot capture timed out'))
    }, settleMs + MOUNT_DELAY_MS + 5000)

    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        ipcMain.once('screenshot:ready', () => {
          clearTimeout(timeout)
          resolve()
        })

        window.webContents.send('screenshot:configure', { tool })
      }, MOUNT_DELAY_MS)
    })
  })

  await new Promise((resolve) => setTimeout(resolve, settleMs))

  const image = await window.webContents.capturePage()
  writeFileSync(outputPath, image.toPNG())
  console.log(`[Zvia] Screenshot saved to ${outputPath}`)
}

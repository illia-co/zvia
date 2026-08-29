import type { ToolId } from '@renderer/lib/tools'
import { useServerStore } from '@renderer/state/serverStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import {
  SCREENSHOT_PROFILE,
  SCREENSHOT_SERVER_ID
} from '@renderer/screenshot/constants'

export function setupScreenshotDemo(toolId: ToolId): void {
  document.documentElement.classList.add('dark')

  useServerStore.setState({
    profiles: [SCREENSHOT_PROFILE],
    selectedServerId: SCREENSHOT_SERVER_ID,
    connectionStates: { [SCREENSHOT_SERVER_ID]: 'connected' },
    connectionErrors: {},
    hostKeyPrompt: null,
    isLoadingProfiles: false,
    actionError: null
  })

  useWorkspaceStore.getState().openTool(SCREENSHOT_SERVER_ID, toolId)
}

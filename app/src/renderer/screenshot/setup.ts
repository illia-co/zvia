import type { ToolId } from '@renderer/lib/tools'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { useServerStore } from '@renderer/state/serverStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import {
  SCREENSHOT_DEPLOYMENT_ENTITY_ID,
  SCREENSHOT_DEPLOYMENT_ID,
  SCREENSHOT_PROD_DEPLOYMENT_ID,
  SCREENSHOT_PROFILE,
  SCREENSHOT_SERVER_ID,
  SCREENSHOT_STABLE_BASELINE_ID
} from '@renderer/screenshot/constants'

export function setupScreenshotDemo(tool: string): void {
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

  const [toolId, view] = tool.split(':') as [ToolId, string | undefined]

  if (toolId === 'deployments' && view) {
    if (view === 'snapshots') {
      useNavigationStore.getState().openWithIntent(SCREENSHOT_SERVER_ID, {
        tool: 'deployments',
        deploymentId: SCREENSHOT_PROD_DEPLOYMENT_ID,
        view: 'snapshots'
      })
      return
    }

    if (view === 'diff') {
      useNavigationStore.getState().openWithIntent(SCREENSHOT_SERVER_ID, {
        tool: 'deployments',
        deploymentId: SCREENSHOT_PROD_DEPLOYMENT_ID,
        view: 'diff',
        baselineId: SCREENSHOT_STABLE_BASELINE_ID
      })
      return
    }

    useNavigationStore.getState().openWithIntent(SCREENSHOT_SERVER_ID, {
      tool: 'deployments',
      deploymentId: SCREENSHOT_DEPLOYMENT_ID,
      ...(view === 'inspector' ? { entityId: SCREENSHOT_DEPLOYMENT_ENTITY_ID } : {})
    })
    return
  }

  useWorkspaceStore.getState().openTool(SCREENSHOT_SERVER_ID, toolId)
}

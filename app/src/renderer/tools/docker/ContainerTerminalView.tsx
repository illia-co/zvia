import { useMemo } from 'react'
import type { DockerContainer } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { generateId } from '@renderer/lib/utils'
import { usePanelVisibility } from '@renderer/state/PanelContext'
import { TerminalView } from '@renderer/tools/terminal/TerminalView'

interface ContainerTerminalViewProps {
  serverId: ServerId
  container: DockerContainer
}

export function ContainerTerminalView({ serverId, container }: ContainerTerminalViewProps) {
  const isWorkspaceVisible = usePanelVisibility()
  const sessionId = useMemo(() => `${container.id}-${generateId()}`, [container.id])
  const command = `docker exec -it ${container.id} /bin/sh`

  return (
    <TerminalView
      serverId={serverId}
      sessionId={sessionId}
      command={command}
      isActive
      isWorkspaceVisible={isWorkspaceVisible}
      isConnected
      onSessionEnded={() => {}}
    />
  )
}

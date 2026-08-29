import type { ToolId } from '@renderer/lib/tools'
import { OverviewPanel } from '@renderer/tools/overview/OverviewPanel'
import { StatsPanel } from '@renderer/tools/stats/StatsPanel'
import { LogsPanel } from '@renderer/tools/logs/LogsPanel'
import { TerminalPanel } from '@renderer/tools/terminal/TerminalPanel'
import { FilesPanel } from '@renderer/tools/files/FilesPanel'
import { DockerPanel } from '@renderer/tools/docker/DockerPanel'
import { PortsPanel } from '@renderer/tools/ports/PortsPanel'
import { NginxPanel } from '@renderer/tools/nginx/NginxPanel'
import { ServicesPanel } from '@renderer/tools/services/ServicesPanel'
import { CronPanel } from '@renderer/tools/cron/CronPanel'
import { SslPanel } from '@renderer/tools/ssl/SslPanel'
import { UsersPanel } from '@renderer/tools/users/UsersPanel'
import { ProcessesPanel } from '@renderer/tools/processes/ProcessesPanel'
import { PackagesPanel } from '@renderer/tools/packages/PackagesPanel'
export function renderToolPanel(toolId: ToolId) {
  switch (toolId) {
    case 'overview':
      return <OverviewPanel />
    case 'stats':
      return <StatsPanel />
    case 'logs':
      return <LogsPanel />
    case 'terminal':
      return <TerminalPanel />
    case 'files':
      return <FilesPanel />
    case 'docker':
      return <DockerPanel />
    case 'ports':
      return <PortsPanel />
    case 'nginx':
      return <NginxPanel />
    case 'ssl':
      return <SslPanel />
    case 'services':
      return <ServicesPanel />
    case 'cron':
      return <CronPanel />
    case 'users':
      return <UsersPanel />
    case 'processes':
      return <ProcessesPanel />
    case 'packages':
      return <PackagesPanel />
  }
}

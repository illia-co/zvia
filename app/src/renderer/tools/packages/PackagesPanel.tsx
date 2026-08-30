import { useEffect, useState } from 'react'
import type { PackageDetail, PackageOperation } from '@shared/packages'
import { normalizePackageDetail } from '@shared/packages'
import type { RelayErrorPayload } from '@shared/errors'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'
import { elevationCommand, parseRelayError } from '@renderer/lib/errors'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useToolIntent } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { InstallPackageDialog } from './InstallPackageDialog'
import { InstalledPackagesTab } from './InstalledPackagesTab'
import { PackageDetailView } from './PackageDetailView'
import {
  operationStepsForKind,
  PackageOperationProgress
} from './PackageOperationProgress'
import { PackagesOverview } from './PackagesOverview'
import { SearchTab } from './SearchTab'
import { UpdatesTab } from './UpdatesTab'
import { usePackages, type PackagesTab } from './usePackages'

const TABS: { id: PackagesTab; label: string }[] = [
  { id: 'installed', label: 'Installed' },
  { id: 'updates', label: 'Updates' },
  { id: 'search', label: 'Search' }
]

interface PendingOperation {
  kind: PackageOperation['kind']
  packageName?: string
  title: string
  command: string
  warning: string
}

export function PackagesPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const openTool = useWorkspaceStore((state) => state.openTool)
  const intent = useToolIntent('packages')

  const [tab, setTab] = useState<PackagesTab>('installed')
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [installDetail, setInstallDetail] = useState<PackageDetail | null>(null)
  const [installLoading, setInstallLoading] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null)
  const [operationStreamId, setOperationStreamId] = useState<string | null>(null)
  const [operationTitle, setOperationTitle] = useState('')
  const [operationSteps, setOperationSteps] = useState<
    ReturnType<typeof operationStepsForKind>
  >([])
  const [actionError, setActionError] = useState<RelayErrorPayload | null>(null)

  const isConnected = connectionState === 'connected'
  const showingDetail = selectedPackage !== null

  const packages = usePackages({
    serverId,
    isConnected,
    polling: !showingDetail && operationStreamId === null
  })

  useEffect(() => {
    setTab('installed')
    setSelectedPackage(null)
    setInstallDialogOpen(false)
    setInstallDetail(null)
    setPendingOperation(null)
    setOperationStreamId(null)
    setActionError(null)
  }, [serverId])

  useEffect(() => {
    if (!intent) return
    if (intent.view) setTab(intent.view)
    if (intent.packageName) {
      setSelectedPackage(intent.packageName)
      void packages.loadDetail(intent.packageName)
    }
  }, [intent, packages.loadDetail])

  const openPackage = (packageName: string) => {
    setSelectedPackage(packageName)
    void packages.loadDetail(packageName)
  }

  const openInstallDialog = async (packageName: string) => {
    setInstallLoading(true)
    setActionError(null)
    try {
      const detail = normalizePackageDetail(
        await window.relay.packages.info({ serverId, packageName })
      )
      setInstallDetail(detail)
      setInstallDialogOpen(true)
    } catch (error) {
      setActionError(parseRelayError(error))
    } finally {
      setInstallLoading(false)
    }
  }

  const requestRemove = (packageName: string) => {
    setPendingOperation({
      kind: 'remove',
      packageName,
      title: `Remove ${packageName}`,
      command: `apt-get remove -y ${packageName}`,
      warning: `This will remove ${packageName} and may uninstall dependent packages.`
    })
  }

  const requestUpgrade = (packageName: string) => {
    setPendingOperation({
      kind: 'upgrade',
      packageName,
      title: `Upgrade ${packageName}`,
      command: `apt-get install --only-upgrade -y ${packageName}`,
      warning: `This will upgrade ${packageName} to the latest available version.`
    })
  }

  const requestUpgradeAll = () => {
    setPendingOperation({
      kind: 'upgrade-all',
      title: 'Upgrade all packages',
      command: 'apt-get upgrade -y',
      warning: 'This will upgrade every package with available updates.'
    })
  }

  const startOperation = async (operation: PackageOperation, title: string) => {
    setActionError(null)
    const streamId = crypto.randomUUID()
    setOperationStreamId(streamId)
    setOperationTitle(title)
    setOperationSteps(operationStepsForKind(operation.kind))
    setPendingOperation(null)
    setInstallDialogOpen(false)

    try {
      await window.relay.packages.operationStart({ serverId, streamId, operation })
    } catch (error) {
      setOperationStreamId(null)
      setActionError(parseRelayError(error))
    }
  }

  const finishOperation = async () => {
    setOperationStreamId(null)
    setSelectedPackage(null)
    packages.clearDetail()
    await packages.reloadAll()
  }

  const cancelOperation = () => {
    if (!operationStreamId) return
    void window.relay.packages.operationCancel({ serverId, streamId: operationStreamId })
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to manage packages.
          </p>
        </div>
      </div>
    )
  }

  if (packages.available === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-text">Packages unavailable</p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
          {packages.unavailableReason ??
            'No supported package manager was detected on this server.'}
        </p>
        <Button size="sm" className="mt-5" onClick={() => openTool(serverId, 'terminal')}>
          Open Terminal
        </Button>
      </div>
    )
  }

  if (operationStreamId) {
    return (
      <PackageOperationProgress
        serverId={serverId}
        streamId={operationStreamId}
        title={operationTitle}
        steps={operationSteps}
        onDone={() => void finishOperation()}
        onCancel={cancelOperation}
      />
    )
  }

  const elevation = actionError ? elevationCommand(actionError) : null
  const errorSurface = elevation ? (
    <div className="border-b border-divider p-3">
      <ElevationRequired serverId={serverId} command={elevation} />
    </div>
  ) : actionError ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface error={actionError} onDismiss={() => setActionError(null)} />
    </div>
  ) : packages.error ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface error={packages.error} onDismiss={packages.clearError} />
    </div>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {errorSurface}

      {showingDetail && packages.detail ? (
        <>
          <div className="border-b border-divider px-3 py-2">
            <BackButton
              onClick={() => {
                setSelectedPackage(null)
                packages.clearDetail()
              }}
            />
          </div>
          <PackageDetailView
            serverId={serverId}
            detail={packages.detail}
            loading={packages.detailLoading}
            onInstall={(packageName) => void openInstallDialog(packageName)}
            onRemove={requestRemove}
            onUpgrade={requestUpgrade}
          />
        </>
      ) : (
        <>
          <PackagesOverview overview={packages.overview} loading={packages.loading} />

          <div className="border-b border-divider px-3 py-2">
            <SegmentedControl options={TABS} value={tab} onChange={setTab} />
          </div>

          <div className="min-h-0 flex-1">
            {tab === 'installed' && (
              <InstalledPackagesTab
                items={packages.installed?.items ?? []}
                query={packages.installedQuery}
                loading={packages.installedLoading || packages.loading}
                onQueryChange={packages.setInstalledQuery}
                onSelect={openPackage}
              />
            )}

            {tab === 'updates' && (
              <UpdatesTab
                updates={packages.updates}
                loading={packages.updatesLoading || packages.loading}
                onSelect={openPackage}
                onUpgradeAll={requestUpgradeAll}
                onUpgrade={requestUpgrade}
              />
            )}

            {tab === 'search' && (
              <SearchTab
                results={packages.searchResults}
                query={packages.searchQuery}
                loading={packages.searchLoading}
                onQueryChange={packages.setSearchQuery}
                onSelect={openPackage}
                onInstall={(packageName) => void openInstallDialog(packageName)}
              />
            )}
          </div>
        </>
      )}

      <InstallPackageDialog
        open={installDialogOpen}
        detail={installDetail}
        loading={installLoading}
        onOpenChange={setInstallDialogOpen}
        onConfirm={(version) => {
          if (!installDetail) return
          void startOperation(
            { kind: 'install', packageName: installDetail.name, version },
            version
              ? `Installing ${installDetail.name} (${version})`
              : `Installing ${installDetail.name}`
          )
        }}
      />

      <Dialog open={pendingOperation !== null} onOpenChange={(open) => !open && setPendingOperation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingOperation?.title}</DialogTitle>
            <DialogDescription>{pendingOperation?.warning}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ServerScopeNotice />
            <div className="rounded-sm bg-bg-secondary p-2 font-mono text-[11px] text-text-secondary">
              {pendingOperation?.command}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingOperation(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingOperation?.kind === 'remove' ? 'destructive' : 'default'}
              onClick={() => {
                if (!pendingOperation) return
                const operation: PackageOperation =
                  pendingOperation.kind === 'upgrade-all'
                    ? { kind: 'upgrade-all' }
                    : {
                        kind: pendingOperation.kind,
                        packageName: pendingOperation.packageName!
                      }
                void startOperation(operation, pendingOperation.title)
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

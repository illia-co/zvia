import type {
  InstalledPackage,
  PackageDetail,
  PackageManagerId,
  PackageOverview,
  PackageSearchResult,
  PackageUpdate,
  PaginatedResult
} from '@shared/packages'

export interface PackageManager {
  readonly id: PackageManagerId
  readonly label: string
  detect(): Promise<boolean>
  overview(distro: string): Promise<PackageOverview>
  listInstalled(opts: {
    query?: string
    offset: number
    limit: number
  }): Promise<PaginatedResult<InstalledPackage>>
  search(query: string): Promise<PackageSearchResult[]>
  getInfo(name: string): Promise<PackageDetail>
  listUpdates(): Promise<PackageUpdate[]>
  buildSimulateInstallCommand(packageName: string, version?: string): string
  buildInstallCommand(packageName: string, version?: string): string
  buildRemoveCommand(packageName: string): string
  buildUpgradeCommand(packageName: string): string
  buildUpgradeAllCommand(): string
  buildVerifyCommand(packageName: string): string
}

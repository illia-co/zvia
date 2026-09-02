export const GITHUB_REPO = 'https://github.com/illia-co/zvia'

export const RELEASE_ASSETS = {
  mac: 'zvia-mac.dmg',
  windows: 'zvia-win.exe',
  linux: 'zvia-linux.AppImage'
} as const

export interface DownloadLinks {
  releases: string
  downloadMac: string
  downloadWindows: string
  downloadLinux: string
}

const DEFAULT_TAG = import.meta.env.VITE_RELEASE_TAG || 'v0.1.2-beta'

export function buildDownloadLinks(tag: string): DownloadLinks {
  const base = `${GITHUB_REPO}/releases`

  return {
    releases: `${base}/tag/${tag}`,
    downloadMac: `${base}/download/${tag}/${RELEASE_ASSETS.mac}`,
    downloadWindows: `${base}/download/${tag}/${RELEASE_ASSETS.windows}`,
    downloadLinux: `${base}/download/${tag}/${RELEASE_ASSETS.linux}`
  }
}

/** Static fallback URLs baked into the site build. */
export const DEFAULT_DOWNLOADS = buildDownloadLinks(DEFAULT_TAG)

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  assets: GitHubReleaseAsset[]
}

function assetUrl(assets: GitHubReleaseAsset[], name: string): string | undefined {
  return assets.find((asset) => asset.name === name)?.browser_download_url
}

/** GitHub /releases/latest excludes prereleases, so fetch the newest release directly. */
export async function fetchLatestDownloads(): Promise<DownloadLinks> {
  const response = await fetch('https://api.github.com/repos/illia-co/zvia/releases?per_page=1')

  if (!response.ok) {
    return DEFAULT_DOWNLOADS
  }

  const releases = (await response.json()) as GitHubRelease[]
  const release = releases[0]

  if (!release?.tag_name) {
    return DEFAULT_DOWNLOADS
  }

  const mac = assetUrl(release.assets, RELEASE_ASSETS.mac)
  const windows = assetUrl(release.assets, RELEASE_ASSETS.windows)
  const linux = assetUrl(release.assets, RELEASE_ASSETS.linux)

  if (mac && windows && linux) {
    return {
      releases: `${GITHUB_REPO}/releases/tag/${release.tag_name}`,
      downloadMac: mac,
      downloadWindows: windows,
      downloadLinux: linux
    }
  }

  return buildDownloadLinks(release.tag_name)
}

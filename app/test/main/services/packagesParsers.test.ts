import { describe, expect, it } from 'vitest'
import {
  mergePackageDetail,
  parseAptCachePolicy,
  parseAptCacheRdepends,
  parseAptCacheSearch,
  parseAptCacheShow,
  parseAptListUpgradable,
  parseDpkgListFiles,
  parseDpkgQueryLine,
  parseDpkgQueryOutput
} from '@main/services/packagesParsers'

const DPKG_QUERY_OUTPUT = [
  'adduser\t3.118ubuntu5\tall\tinstall ok installed\tAdd and remove users and groups',
  'curl\t7.81.0-1ubuntu1.14\tamd64\tinstall ok installed\tcommand line tool for transferring data with URL syntax',
  'dpkg\t1.21.1ubuntu2.3\tamd64\tinstall ok installed\tDebian package management system',
  'libcurl4\t7.81.0-1ubuntu1.14\tamd64\tinstall ok installed\teasy-to-use client-side URL transfer library'
].join('\n')

const APT_LIST_UPGRADABLE = [
  'Listing... Done',
  'curl/jammy-updates,jammy-security 7.81.0-1ubuntu1.15 amd64 [upgradable from: 7.81.0-1ubuntu1.14]',
  'libcurl4/jammy-updates,jammy-security 7.81.0-1ubuntu1.15 amd64 [upgradable from: 7.81.0-1ubuntu1.14]'
].join('\n')

const APT_CACHE_SEARCH = [
  'curl - command line tool for transferring data with URL syntax',
  'libcurl4 - easy-to-use client-side URL transfer library'
].join('\n')

const APT_CACHE_SHOW = [
  'Package: curl',
  'Version: 7.81.0-1ubuntu1.15',
  'Architecture: amd64',
  'Depends: libc6 (>= 2.34), libcurl4 (= 7.81.0-1ubuntu1.15), zlib1g (>= 1:1.1.4)',
  'Description-en: command line tool for transferring data with URL syntax',
  'Homepage: https://curl.se/',
  ''
].join('\n')

const APT_CACHE_RDEPENDS = [
  'curl',
  'Reverse Depends:',
  '  libcurl4',
  ' | git',
  '  wget'
].join('\n')

const DPKG_LIST_FILES = [
  '/usr/bin/curl',
  '/usr/share/doc/curl',
  '/usr/share/man/man1/curl.1.gz'
].join('\n')

describe('parseDpkgQueryLine', () => {
  it('parses an installed package line', () => {
    expect(parseDpkgQueryLine(DPKG_QUERY_OUTPUT.split('\n')[1])).toEqual({
      name: 'curl',
      version: '7.81.0-1ubuntu1.14',
      architecture: 'amd64',
      status: 'install ok installed',
      description: 'command line tool for transferring data with URL syntax'
    })
  })

  it('ignores non-installed statuses', () => {
    expect(
      parseDpkgQueryLine('curl\t7.81.0-1ubuntu1.14\tamd64\tdeinstall ok config-files\tremoved')
    ).toBeNull()
  })
})

describe('parseDpkgQueryOutput', () => {
  it('parses multiple installed packages', () => {
    expect(parseDpkgQueryOutput(DPKG_QUERY_OUTPUT)).toHaveLength(4)
  })
})

describe('parseAptListUpgradable', () => {
  it('parses upgradable package rows', () => {
    expect(parseAptListUpgradable(APT_LIST_UPGRADABLE)).toEqual([
      {
        name: 'curl',
        candidateVersion: '7.81.0-1ubuntu1.15',
        architecture: 'amd64',
        installedVersion: '7.81.0-1ubuntu1.14'
      },
      {
        name: 'libcurl4',
        candidateVersion: '7.81.0-1ubuntu1.15',
        architecture: 'amd64',
        installedVersion: '7.81.0-1ubuntu1.14'
      }
    ])
  })
})

describe('parseAptCacheSearch', () => {
  it('parses apt-cache search output', () => {
    expect(parseAptCacheSearch(APT_CACHE_SEARCH)).toEqual([
      {
        name: 'curl',
        description: 'command line tool for transferring data with URL syntax'
      },
      {
        name: 'libcurl4',
        description: 'easy-to-use client-side URL transfer library'
      }
    ])
  })
})

const APT_CACHE_POLICY = [
  'curl:',
  '  Installed: (none)',
  '  Candidate: 7.81.0-1ubuntu1.15',
  '  Version table:',
  ' *** 7.81.0-1ubuntu1.15 500',
  '        500 http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 Packages',
  '     7.81.0-1ubuntu1.14 500',
  '        500 http://security.ubuntu.com/ubuntu jammy-security/main amd64 Packages',
  '     7.81.0-1ubuntu1 500',
  '        500 http://archive.ubuntu.com/ubuntu jammy/main amd64 Packages'
].join('\n')

describe('parseAptCacheShow', () => {
  it('parses package metadata and dependencies', () => {
    expect(parseAptCacheShow(APT_CACHE_SHOW, 'curl')).toEqual({
      name: 'curl',
      version: '7.81.0-1ubuntu1.15',
      candidateVersion: null,
      availableVersions: [],
      installedVersion: null,
      architecture: 'amd64',
      description: 'command line tool for transferring data with URL syntax',
      homepage: 'https://curl.se/',
      installed: false,
      dependencies: ['libc6', 'libcurl4', 'zlib1g'],
      reverseDependencies: [],
      installedFiles: []
    })
  })
})

describe('parseAptCachePolicy', () => {
  it('parses candidate and available versions', () => {
    expect(parseAptCachePolicy(APT_CACHE_POLICY)).toEqual({
      candidateVersion: '7.81.0-1ubuntu1.15',
      availableVersions: [
        '7.81.0-1ubuntu1.15',
        '7.81.0-1ubuntu1.14',
        '7.81.0-1ubuntu1'
      ]
    })
  })
})

describe('parseAptCacheRdepends', () => {
  it('parses reverse dependency names', () => {
    expect(parseAptCacheRdepends(APT_CACHE_RDEPENDS)).toEqual(['libcurl4', 'git', 'wget'])
  })
})

describe('parseDpkgListFiles', () => {
  it('parses installed file paths', () => {
    expect(parseDpkgListFiles(DPKG_LIST_FILES)).toEqual([
      '/usr/bin/curl',
      '/usr/share/doc/curl',
      '/usr/share/man/man1/curl.1.gz'
    ])
  })
})

describe('mergePackageDetail', () => {
  it('merges installed state and related metadata', () => {
    const detail = parseAptCacheShow(APT_CACHE_SHOW, 'curl')
    expect(detail).not.toBeNull()

    const installed = parseDpkgQueryLine(DPKG_QUERY_OUTPUT.split('\n')[1])
    expect(installed).not.toBeNull()

    expect(
      mergePackageDetail(detail!, installed, ['wget'], ['/usr/bin/curl'])
    ).toMatchObject({
      installed: true,
      installedVersion: '7.81.0-1ubuntu1.14',
      reverseDependencies: ['wget'],
      installedFiles: ['/usr/bin/curl']
    })
  })
})

# Changelog

All notable changes to Zvia are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with beta prerelease tags.

## [0.1.1-beta] — 2026-08-31

### Added

- **Deployments** — server-scoped topology discovery from nginx, SSL, ports, processes, systemd, and Docker
- Deployment list with per-domain health, component chips, and shared-backend insights
- Interactive topology canvas with evidence-backed entity and relationship inspectors
- Cross-tool links from Ports, Docker, Nginx, and Services into Deployments
- Scan progress streaming during explicit topology rescans
- **Applications** section in the tool sidebar; Deployments opens by default on connect
- Landing site: Deployments hero and feature section, authentication/security section, Legal Notice and Privacy Policy pages
- Deployments backend module under `app/src/main/services/deployments/`
- OrbStack integration tests for topology discovery

### Changed

- Marketing site updated to lead with Deployments and refreshed download links
- Topology cache invalidates when Docker, Nginx, or systemd state changes on the server
- Connection loss clears topology cache along with other per-server service state

### Install

Download installers from [GitHub Releases](https://github.com/illia-co/zvia/releases/tag/v0.1.1-beta) or the [Zvia website](https://illia-co.github.io/zvia/).

See [docs/releases/v0.1.1-beta.md](docs/releases/v0.1.1-beta.md) for full launch notes.

## [0.1.0-beta] — initial public beta

- Electron desktop app with 14 server-scoped tools
- SSH, SFTP, and PTY over standard Linux commands — no remote agent
- macOS, Windows, and Linux installers via GitHub Releases
- Marketing site with documentation at `/documentation`

[0.1.1-beta]: https://github.com/illia-co/zvia/releases/tag/v0.1.1-beta
[0.1.0-beta]: https://github.com/illia-co/zvia/releases/tag/v0.1.0-beta

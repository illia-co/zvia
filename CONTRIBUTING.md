# Contributing to Zvia

Thank you for your interest in contributing. Zvia is an open-source desktop SSH workspace for Linux servers.

## Getting started

1. Fork the repository and clone your fork.
2. Install [Node.js 20+](https://nodejs.org/) and npm 10+.
3. From the repository root:

```bash
npm install
npm run dev          # Electron app
npm run dev:landing  # Marketing site
```

4. Run checks before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
npm run build:landing
```

## Project structure

| Path | Purpose |
|------|---------|
| `app/` | Electron desktop application — see [app/docs/](app/docs/) |
| `landing/` | Marketing site and user documentation — see [landing/docs/](landing/docs/) |
| `shared/` | Design tokens and brand assets — see [shared/docs/](shared/docs/) |
| `docs/` | [Documentation index](docs/README.md) |

See [AGENTS.md](./AGENTS.md) for product rules, architecture constraints, and coding conventions.

## Pull requests

- Keep changes focused and server-scoped — Zvia does not use global fleet views.
- Match existing TypeScript, React, and Electron patterns in the codebase.
- Do not expose SSH credentials or raw keys to the renderer process.
- Add or update tests when behavior changes.
- Update user-facing documentation in `landing/src/docs/content.ts` when features or workflows change.
- Update agent docs in `app/docs/`, `landing/docs/`, or `shared/docs/` when architecture or tool behavior changes.

## Reporting issues

Use [GitHub Issues](https://github.com/illia-co/zvia/issues) for bugs and feature requests.

For security vulnerabilities, see [SECURITY.md](./SECURITY.md). Do not file public issues for security bugs.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

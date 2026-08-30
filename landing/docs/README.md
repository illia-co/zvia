# Landing documentation

Documentation for the marketing site (`@zvia/landing`).

| Document | Description |
|----------|-------------|
| [PRODUCT.md](./PRODUCT.md) | Product vision, UX goals, and feature narrative |

## User documentation

Public end-user docs are implemented in the landing app:

- `landing/src/docs/content.ts` — section content
- `landing/src/pages/DocumentationPage.tsx` — `/documentation` page
- `landing/src/components/docs/` — layout components

## Local development

```bash
npm run dev:landing
```

Preview the GitHub Pages build locally:

```bash
npm run preview:pages -w @zvia/landing
```

## GitHub Pages deployment

The landing site deploys automatically from `main` via [`.github/workflows/deploy-landing.yml`](../../.github/workflows/deploy-landing.yml).

**Live URL (for now):** https://illia-co.github.io/zvia/

### One-time repo setup

1. Open **Settings → Pages**
2. Set **Build and deployment → Source** to **GitHub Actions**
3. After the first successful deploy, the site will be available at the URL above

### Custom domain later

When you have a domain:

1. Add the domain in **Settings → Pages → Custom domain**
2. Update deploy env in `deploy-landing.yml`:
   - `VITE_BASE_PATH: /`
   - `VITE_SITE_URL: https://your-domain.com`
3. Point DNS at GitHub Pages

## App downloads

Download buttons link to GitHub Releases assets:

- macOS: `Zvia-mac.dmg`
- Windows: `Zvia-windows-setup.exe`
- Linux: `Zvia-linux.AppImage`

Create a release by pushing a version tag:

```bash
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

The [release workflow](../../.github/workflows/release.yml) builds platform packages and publishes them to GitHub Releases.

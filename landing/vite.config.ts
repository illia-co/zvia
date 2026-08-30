import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function siteEnvPlugin(): Plugin {
  return {
    name: 'site-env',
    transformIndexHtml(html) {
      const basePath = process.env.VITE_BASE_PATH || '/'
      const siteUrl = (process.env.VITE_SITE_URL || 'https://illia-co.github.io/zvia').replace(
        /\/$/,
        ''
      )

      return html
        .replaceAll('%VITE_BASE_PATH%', basePath)
        .replaceAll('%VITE_SITE_URL%', siteUrl)
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), siteEnvPlugin()],
  resolve: {
    alias: {
      '@zvia/shared': resolve(__dirname, '../shared')
    }
  },
  appType: 'spa'
})

import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main')
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})

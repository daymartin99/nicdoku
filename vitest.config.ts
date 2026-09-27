import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests only; e2e/ is run by Playwright.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register-stub.ts', import.meta.url)) },
  },
  test: { include: ['src/**/*.test.ts'] },
})

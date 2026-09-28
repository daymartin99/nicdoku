import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174 --strictPort',
    port: 4174,
    // never reuse: a reused server skips the build step and tests a stale bundle
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'] } }],
})

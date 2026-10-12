
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PUJAZ_BASE_URL ?? 'http://127.0.0.1:8080';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
    name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      /*name: 'brave',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: '/usr/bin/brave-browser',
        },
        
      },
      */
    },
  ],
  webServer: {
    command: 'docker compose up --build',
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
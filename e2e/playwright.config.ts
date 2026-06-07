import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e smoke config. By default it auto-starts the Angular client dev
 * server and runs the public-page smoke specs against it (no backend needed).
 * Point E2E_BASE_URL at a running deployment to test that instead.
 *
 *   npm run test:e2e            # auto-start client + run smoke
 *   E2E_BASE_URL=https://…  npm run test:e2e   # run against a live URL
 *
 * First run needs browsers: `npx playwright install chromium`.
 */
const PORT = 4200;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Auto-start the client unless we're pointed at an external URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev:client',
        cwd: '..',
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});

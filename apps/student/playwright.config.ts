import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});

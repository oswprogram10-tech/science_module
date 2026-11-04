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
    // 이미 떠 있는 서버(이전 빌드)를 재사용하면 오래된 화면을 검사할 수 있어 항상 새로 띄운다.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

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
  // 학생 앱(4174), 교사 앱(4175), 수업 중계 서버(8787)를 함께 띄운다. 기존 테스트는 서버 없이도 통과하며,
  // 수업 테스트만 주소에 `?classroom=`을 붙인다. 이미 떠 있는 서버를 재사용하면 오래된 빌드를 검사할 수 있어 항상 새로 띄운다.
  webServer: [
    {
      command: 'pnpm build && pnpm exec vite preview --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter teacher build && pnpm --filter teacher exec vite preview --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @sci/server start',
      url: 'http://localhost:8787/health',
      env: { PORT: '8787' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

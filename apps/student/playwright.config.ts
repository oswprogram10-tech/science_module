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
  // 학생 앱(4174), 교사 앱(4175), 수업 중계 서버(8787), 교사 PC 수업 서버(8790)를 함께 띄운다. 기존 테스트는 서버 없이도 통과하며,
  // 수업 테스트만 주소에 `?classroom=`을 붙인다. 이미 떠 있는 서버를 재사용하면 오래된 빌드를 검사할 수 있어 항상 새로 띄운다.
  webServer: [
    {
      // ?classroom= 는 빌드 때 허용한 호스트만 받는다(리뷰 반영 v0.1). 수업 E2E가 쓰는 localhost를 허용한다.
      command: 'VITE_CLASSROOM_ALLOWED_HOSTS=localhost pnpm build && pnpm exec vite preview --port 4174 --strictPort',
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
      // CI 재시도가 같은 서버에서 돌면 IP당 수업 만들기 한도(기본 10/시간)에 걸릴 수 있어 E2E 서버만 늘린다.
      env: { PORT: '8787', CREATES_PER_HOUR: '1000' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // 교사 PC 수업 서버(apps/classroom-host)의 묶음 JS를 node로 실행한다. 교사 화면은 위에서 만든 apps/teacher/dist를 내보낸다
      // (webServer는 위에서부터 차례로 켜지므로 그때는 dist가 있다). 브라우저는 열지 않는다.
      command: 'pnpm --filter @sci/classroom-host bundle && node ../classroom-host/dist/host.cjs',
      url: 'http://localhost:8790/health',
      env: { PORT: '8790', NO_BROWSER: '1', CREATES_PER_HOUR: '1000' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

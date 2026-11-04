import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 가칭. 출시 전에 기관 도메인으로 바꾼다(docs/app-packaging.md 참고).
  appId: 'kr.scibridge.student',
  appName: 'Sci-Bridge ON',
  webDir: 'dist',
};

export default config;

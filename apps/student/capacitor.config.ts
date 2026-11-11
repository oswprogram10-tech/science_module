import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 가칭. 출시 전에 기관 도메인으로 바꾼다(docs/app-packaging.md 참고).
  appId: 'kr.scibridge.student',
  appName: 'Sci-Bridge ON',
  webDir: 'dist',
  server: {
    // 앱 출처를 https://localhost 대신 http://localhost 로 한다. 그래야 선생님 PC의 ws:// 서버에 혼합 콘텐츠 차단 없이 붙는다.
    // localhost는 보안 문맥이라 카메라·블루투스는 그대로 쓴다. 평문(cleartext) 허용 근거는 docs/app-packaging.md 참고.
    androidScheme: 'http',
  },
};

export default config;

const DEV_URL = 'ws://localhost:8787/ws';

/** 서버 주소: 주소의 `?classroom=` > 빌드 변수 VITE_CLASSROOM_URL > 개발용 기본값. */
export function serverUrl(search: string = window.location.search): string {
  try {
    const q = new URLSearchParams(search).get('classroom');
    if (q) return q;
  } catch {
    /* 무시 */
  }
  return import.meta.env.VITE_CLASSROOM_URL || DEV_URL;
}

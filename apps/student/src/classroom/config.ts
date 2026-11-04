/** 수업 중계 서버 주소. 주소의 `?classroom=` > 빌드 변수 `VITE_CLASSROOM_URL`. 둘 다 없으면 null(수업 기능을 숨긴다). */
export function classroomUrl(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('classroom');
    if (q) return q;
  } catch {
    /* 주소를 못 읽으면 빌드 변수를 본다 */
  }
  const v = import.meta.env.VITE_CLASSROOM_URL;
  return typeof v === 'string' && v ? v : null;
}

export const APP_VERSION = '0.0.0';

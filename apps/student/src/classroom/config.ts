/** 쉼표로 구분된 호스트 목록을 소문자 배열로 바꾼다. */
const parseHosts = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

export interface ClassroomUrlEnv {
  /** 주소창의 쿼리 문자열. */
  search: string;
  /** 개발 서버인가(`import.meta.env.DEV`). */
  dev: boolean;
  /** 빌드 변수 `VITE_CLASSROOM_ALLOWED_HOSTS`(쉼표 구분). */
  allowedHosts: string | undefined;
  /** 빌드 변수 `VITE_CLASSROOM_URL`. */
  buildUrl: string | undefined;
}

/**
 * 수업 중계 서버 주소를 정한다. 주소의 `?classroom=` > 빌드 변수 `VITE_CLASSROOM_URL`. 둘 다 없으면 null(수업 기능을 숨긴다).
 *
 * `?classroom=`는 링크 하나로 학생 기기의 진행 요약을 엉뚱한 서버로 보내게 만들 수 있으므로,
 * 개발 서버이거나 그 서버 주소의 호스트가 빌드 때 허용한 목록(`VITE_CLASSROOM_ALLOWED_HOSTS`)에 있을 때만 받는다.
 */
export function resolveClassroomUrl(env: ClassroomUrlEnv): string | null {
  try {
    const q = new URLSearchParams(env.search).get('classroom');
    if (q) {
      const u = new URL(q);
      if ((u.protocol === 'ws:' || u.protocol === 'wss:') && (env.dev || parseHosts(env.allowedHosts).includes(u.hostname.toLowerCase()))) return q;
    }
  } catch {
    /* 주소를 못 읽거나 올바른 주소가 아니면 빌드 변수를 본다 */
  }
  return typeof env.buildUrl === 'string' && env.buildUrl ? env.buildUrl : null;
}

export function classroomUrl(): string | null {
  let search = '';
  try {
    search = window.location.search;
  } catch {
    /* 주소를 못 읽으면 빌드 변수를 본다 */
  }
  return resolveClassroomUrl({
    search,
    dev: import.meta.env.DEV === true,
    allowedHosts: import.meta.env.VITE_CLASSROOM_ALLOWED_HOSTS,
    buildUrl: import.meta.env.VITE_CLASSROOM_URL,
  });
}

export const APP_VERSION = '0.0.0';

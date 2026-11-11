const DEV_URL = 'ws://localhost:8787/ws';

export interface ServerUrlEnv {
  /** 주소창의 쿼리 문자열. */
  search: string;
  /** 빌드 변수 `VITE_CLASSROOM_URL`. */
  buildUrl: string | undefined;
  /** 교사 PC 수업 서버가 내보낸 화면인가(`index.html`의 `sci-bridge-host` 표시). */
  hostServed: boolean;
  /** 이 화면의 주소(`location.host`, `location.protocol`). */
  host: string;
  protocol: string;
}

/**
 * 서버 주소: 주소의 `?classroom=` > 빌드 변수 VITE_CLASSROOM_URL > 수업 서버가 내보낸 화면이면 자기 주소(`ws://<location.host>/ws`) > 개발용 기본값.
 * 교사 PC 수업 서버는 화면과 WebSocket을 같은 포트로 내보내므로, 교사 화면을 어느 주소(localhost든 PC의 IP든)로 열어도 그 주소로 이어진다.
 */
export function resolveServerUrl(env: ServerUrlEnv): string {
  try {
    const q = new URLSearchParams(env.search).get('classroom');
    if (q) return q;
  } catch {
    /* 무시 */
  }
  if (env.buildUrl) return env.buildUrl;
  if (env.hostServed && env.host) return `${env.protocol === 'https:' ? 'wss' : 'ws'}://${env.host}/ws`;
  return DEV_URL;
}

/** 이 화면을 수업 서버(교사 PC)가 내보냈는가. */
export function isHostServed(): boolean {
  try {
    return document.querySelector('meta[name="sci-bridge-host"]')?.getAttribute('content') === '1';
  } catch {
    return false;
  }
}

export function serverUrl(): string {
  return resolveServerUrl({
    search: window.location.search,
    buildUrl: import.meta.env.VITE_CLASSROOM_URL,
    hostServed: isHostServed(),
    host: window.location.host,
    protocol: window.location.protocol,
  });
}

import { Capacitor } from '@capacitor/core';

/** 선생님 PC 주소를 기기에 기억하는 `localStorage` 키. 값은 입력한 주소 문자열 하나뿐이다(학생 정보 없음). */
export const HOST_KEY = 'sci-bridge.classroom-host.v1';
export const DEFAULT_HOST_PORT = 8787;

/**
 * 학생이 입력한 "선생님 PC 주소"를 WebSocket 주소로 바꾼다. 못 읽으면 null.
 * - 앞뒤 공백은 뗀다. 가운데 공백이 있으면 틀린 값이다.
 * - `ws://` 또는 `wss://`로 시작하면 그대로 쓴다(올바른 주소여야 한다).
 * - 아니면 `ws://<입력>/ws`. 포트가 없으면 8787을 붙인다. 그 밖의 스킴(`http://` 등)이나 IPv6는 받지 않는다.
 */
export function parseHostAddress(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^wss?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      return (u.protocol === 'ws:' || u.protocol === 'wss:') && u.hostname ? text : null;
    } catch {
      return null;
    }
  }
  if (text.includes('://')) return null;
  const m = /^([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?\/?$/.exec(text);
  if (!m) return null;
  const port = m[3] === undefined ? DEFAULT_HOST_PORT : Number(m[3]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  // 숫자와 점만 있는 값은 올바른 IPv4여야 한다(예: 192.168.0 이나 300.1.1.1은 거절).
  const host = m[1]!;
  if (/^[\d.]+$/.test(host) && !(/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host.split('.').every((n) => Number(n) <= 255))) return null;
  try {
    const u = new URL(`ws://${m[1]}:${port}/ws`);
    return u.hostname ? `ws://${m[1]}:${port}/ws` : null;
  } catch {
    return null;
  }
}

/** 앱 모드인가: Capacitor 앱(APK)이거나, 시험용으로 주소에 `?app=1`이 있을 때(E2E가 앱 화면을 흉내 낸다). */
export function isAppMode(search?: string): boolean {
  try {
    if (new URLSearchParams(search ?? window.location.search).get('app') === '1') return true;
  } catch {
    /* 주소를 못 읽으면 아래로 */
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 기억해 둔 선생님 PC 주소(입력했던 문자열). 없거나 읽을 수 없으면 ''. */
export function loadHostAddress(): string {
  try {
    const v = localStorage.getItem(HOST_KEY);
    return typeof v === 'string' && v.length <= 200 ? v : '';
  } catch {
    return '';
  }
}

/** 마지막에 쓴 주소를 기억한다. 주소 문자열만 둔다. */
export function saveHostAddress(input: string): void {
  try {
    const t = input.trim();
    if (t) localStorage.setItem(HOST_KEY, t);
    else localStorage.removeItem(HOST_KEY);
  } catch {
    /* 저장소를 못 쓰면 기억만 못 한다 */
  }
}

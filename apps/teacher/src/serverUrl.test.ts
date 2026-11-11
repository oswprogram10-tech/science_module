import { describe, expect, it } from 'vitest';
import { resolveServerUrl, type ServerUrlEnv } from './serverUrl';

const base: ServerUrlEnv = { search: '', buildUrl: undefined, hostServed: false, host: 'localhost:5175', protocol: 'http:' };

describe('교사 화면의 서버 주소 정하기', () => {
  it('아무것도 없으면 개발용 기본값', () => {
    expect(resolveServerUrl(base)).toBe('ws://localhost:8787/ws');
  });
  it('수업 서버가 내보낸 화면이면 자기 주소를 쓴다', () => {
    expect(resolveServerUrl({ ...base, hostServed: true, host: 'localhost:8787' })).toBe('ws://localhost:8787/ws');
    expect(resolveServerUrl({ ...base, hostServed: true, host: '192.168.0.10:8788' })).toBe('ws://192.168.0.10:8788/ws');
  });
  it('https로 열렸으면 wss', () => {
    expect(resolveServerUrl({ ...base, hostServed: true, host: 'class.example.kr', protocol: 'https:' })).toBe('wss://class.example.kr/ws');
  });
  it('수업 서버가 내보낸 화면이 아니면(개발 서버·학교 서버 정적 호스팅) 자기 주소를 쓰지 않는다', () => {
    expect(resolveServerUrl({ ...base, host: 'localhost:4175' })).toBe('ws://localhost:8787/ws');
  });
  it('빌드 변수는 자기 주소보다 먼저', () => {
    expect(resolveServerUrl({ ...base, hostServed: true, host: 'localhost:8787', buildUrl: 'wss://school.example.kr/ws' })).toBe('wss://school.example.kr/ws');
  });
  it('주소의 ?classroom=는 빌드 변수와 자기 주소보다 먼저', () => {
    expect(
      resolveServerUrl({ ...base, hostServed: true, host: 'localhost:8787', buildUrl: 'wss://school.example.kr/ws', search: '?classroom=ws://10.0.0.5:8787/ws' }),
    ).toBe('ws://10.0.0.5:8787/ws');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveClassroomUrl } from './config';

const base = { dev: false, allowedHosts: undefined, buildUrl: undefined };

describe('classroomUrl: ?classroom= 허용 규칙', () => {
  it('허용 호스트가 아니면 무시하고 빌드 변수로 돌아간다', () => {
    const env = { ...base, search: '?classroom=ws://evil.example:8787/ws', allowedHosts: 'localhost,school.example.kr' };
    expect(resolveClassroomUrl(env)).toBeNull();
    expect(resolveClassroomUrl({ ...env, buildUrl: 'wss://class.example.kr/ws' })).toBe('wss://class.example.kr/ws');
  });
  it('허용 호스트 목록에 있으면 받는다(대소문자 무시)', () => {
    const env = { ...base, allowedHosts: 'localhost, School.Example.kr' };
    expect(resolveClassroomUrl({ ...env, search: '?classroom=ws://localhost:8787/ws' })).toBe('ws://localhost:8787/ws');
    expect(resolveClassroomUrl({ ...env, search: '?classroom=wss://school.example.kr/ws' })).toBe('wss://school.example.kr/ws');
  });
  it('허용 목록이 없으면(운영 빌드) 어떤 값도 받지 않는다', () => {
    expect(resolveClassroomUrl({ ...base, search: '?classroom=ws://localhost:8787/ws' })).toBeNull();
  });
  it('개발 서버에서는 모두 받는다', () => {
    expect(resolveClassroomUrl({ ...base, dev: true, search: '?classroom=ws://192.168.0.5:8787/ws' })).toBe('ws://192.168.0.5:8787/ws');
  });
  it('ws가 아니거나 올바른 주소가 아니면 무시한다', () => {
    const env = { ...base, dev: true };
    expect(resolveClassroomUrl({ ...env, search: '?classroom=javascript:alert(1)' })).toBeNull();
    expect(resolveClassroomUrl({ ...env, search: '?classroom=not a url' })).toBeNull();
    expect(resolveClassroomUrl({ ...env, search: '?classroom=https://localhost/ws' })).toBeNull();
  });
  it('주소가 없으면 빌드 변수', () => {
    expect(resolveClassroomUrl({ ...base, search: '', buildUrl: 'wss://a/ws' })).toBe('wss://a/ws');
    expect(resolveClassroomUrl({ ...base, search: '' })).toBeNull();
  });
});

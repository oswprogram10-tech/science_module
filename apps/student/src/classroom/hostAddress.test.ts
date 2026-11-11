import { describe, expect, it } from 'vitest';
import { parseHostAddress } from './hostAddress';

describe('선생님 PC 주소 해석', () => {
  it('IP만 -> 기본 포트 8787', () => {
    expect(parseHostAddress('192.168.0.10')).toBe('ws://192.168.0.10:8787/ws');
  });
  it('IP:포트', () => {
    expect(parseHostAddress('192.168.0.10:8788')).toBe('ws://192.168.0.10:8788/ws');
    expect(parseHostAddress('10.0.0.5:1')).toBe('ws://10.0.0.5:1/ws');
    expect(parseHostAddress('10.0.0.5:65535')).toBe('ws://10.0.0.5:65535/ws');
  });
  it('호스트 이름과 끝의 슬래시', () => {
    expect(parseHostAddress('teacher-pc.local:8787')).toBe('ws://teacher-pc.local:8787/ws');
    expect(parseHostAddress('192.168.0.10:8787/')).toBe('ws://192.168.0.10:8787/ws');
  });
  it('ws:// 와 wss:// 는 그대로', () => {
    expect(parseHostAddress('ws://192.168.0.10:8787/ws')).toBe('ws://192.168.0.10:8787/ws');
    expect(parseHostAddress('wss://class.example.kr/ws')).toBe('wss://class.example.kr/ws');
    expect(parseHostAddress('WS://192.168.0.10:9000/x')).toBe('WS://192.168.0.10:9000/x');
  });
  it('앞뒤 공백은 떼고, 가운데 공백은 거절', () => {
    expect(parseHostAddress('  192.168.0.10:8787  ')).toBe('ws://192.168.0.10:8787/ws');
    expect(parseHostAddress('192.168.0. 10')).toBeNull();
    expect(parseHostAddress('192.168.0.10 :8787')).toBeNull();
  });
  it('잘못된 값은 null', () => {
    for (const bad of ['', '   ', 'abc def', '192.168.0.10:0', '192.168.0.10:65536', '192.168.0.10:abc', '192.168.0', '300.1.1.1', 'http://192.168.0.10:8787', 'ftp://x', 'ws://', 'wss://:8787', '[::1]:8787', '-bad.example', 'a_b', '192.168.0.10:8787/ws']) {
      expect(parseHostAddress(bad), bad).toBeNull();
    }
  });
});

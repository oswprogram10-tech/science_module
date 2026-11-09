import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherClient } from './client';

class FakeWS {
  static OPEN = 1;
  static all: FakeWS[] = [];
  readyState = 1;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.all.push(this);
  }
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {}
  recv(o: unknown) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
}

const TOKEN = 'a'.repeat(32);
beforeEach(() => {
  FakeWS.all = [];
  vi.stubGlobal('WebSocket', FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

const open = (creds: { code: string; token: string } | null = null) => {
  const c = new TeacherClient('ws://x/ws', creds);
  const ws = FakeWS.all[0]!;
  ws.onopen?.();
  return { c, ws };
};

describe('교사 클라이언트', () => {
  it('수업 만들기는 답이 오기 전에는 한 번만 보낸다', () => {
    const { c, ws } = open();
    c.create();
    c.create();
    c.create();
    expect(ws.sent).toEqual([{ t: 'create' }]);
    expect(c.getState().creating).toBe(true);
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    expect(c.getState().creating).toBe(false);
    expect(c.getState().created).toEqual({ code: 'ABC234', token: TOKEN });
  });

  it('created 뒤에 온 bad_message는 치명적이지 않다', () => {
    const { c, ws } = open();
    c.create();
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    ws.recv({ t: 'error', code: 'bad_message' });
    expect(c.getState().error).toBeNull();
    expect(c.getState().created).not.toBeNull();
  });

  it('수업을 보기 전의 bad_message는 오류로 처리한다', () => {
    const { c, ws } = open({ code: 'ABC234', token: TOKEN });
    ws.recv({ t: 'error', code: 'bad_message' });
    expect(c.getState().error).toBe('bad_message');
  });

  it('bad_secret이면 입력받은 비밀번호로 다시 만든다', () => {
    const { c, ws } = open();
    c.create();
    ws.recv({ t: 'error', code: 'bad_secret' });
    expect(c.getState()).toMatchObject({ error: 'bad_secret', creating: false });
    c.create('pw');
    expect(ws.sent).toEqual([{ t: 'create' }, { t: 'create', secret: 'pw' }]);
    expect(c.getState().error).toBeNull();
  });

  it('재연결 때도 같은 secret으로 create를 다시 보낸다', () => {
    vi.useFakeTimers();
    try {
      const { c, ws } = open();
      c.create('pw');
      ws.onclose?.();
      vi.advanceTimersByTime(600);
      const ws2 = FakeWS.all[1]!;
      ws2.onopen?.();
      expect(ws2.sent).toEqual([{ t: 'create', secret: 'pw' }]);
      c.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

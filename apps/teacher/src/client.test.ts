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

describe('교사 클라이언트: 튜터 질문 덧씌우기', () => {
  const edits = { v: 1 as const, units: { 'g6-motion': { 'ramp-cart': { changed: { '|repeat|': { off: true as const } }, added: [] } } } };
  const other = { v: 1 as const, units: {} };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('수업을 만들면(created) 저장된 덧씌우기를 서버에 보낸다', () => {
    const { c, ws } = open();
    c.setTutorEdits(edits);
    c.create();
    expect(ws.sent).toEqual([{ t: 'create' }]);
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    expect(ws.sent).toEqual([{ t: 'create' }, { t: 'tutor', edits }]);
    ws.recv({ t: 'snapshot', code: 'ABC234', paused: false, groups: [] });
    expect(ws.sent).toHaveLength(2); // 한 번만
  });

  it('다시 연결(watch)되면 첫 snapshot을 받은 뒤에 보낸다', () => {
    const { c, ws } = open({ code: 'ABC234', token: TOKEN });
    c.setTutorEdits(edits);
    expect(ws.sent).toEqual([{ t: 'watch', code: 'ABC234', token: TOKEN }]);
    ws.recv({ t: 'snapshot', code: 'ABC234', paused: false, groups: [] });
    expect(ws.sent[1]).toEqual({ t: 'tutor', edits });
  });

  it('수업에 들어가기 전에는 보내지 않고, 들어간 뒤 저장할 때마다 500 ms 묶어서 마지막 것만 보낸다', () => {
    const { c, ws } = open();
    c.setTutorEdits(edits);
    vi.advanceTimersByTime(2000);
    expect(ws.sent).toEqual([]);
    c.create();
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    ws.sent.length = 0;
    c.setTutorEdits(other);
    c.setTutorEdits(edits);
    c.setTutorEdits(other);
    vi.advanceTimersByTime(499);
    expect(ws.sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ws.sent).toEqual([{ t: 'tutor', edits: other }]);
  });

  it('덧씌우기를 알려 준 적이 없으면 아무것도 보내지 않는다(기존 동작)', () => {
    const { c, ws } = open();
    c.create();
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    ws.recv({ t: 'snapshot', code: 'ABC234', paused: false, groups: [] });
    vi.advanceTimersByTime(2000);
    expect(ws.sent).toEqual([{ t: 'create' }]);
  });

  it('연결이 끊겼다 다시 이어지면(watch) 최신 덧씌우기를 다시 보낸다', () => {
    const { c, ws } = open();
    c.setTutorEdits(edits);
    c.create();
    ws.recv({ t: 'created', code: 'ABC234', token: TOKEN });
    ws.onclose?.();
    c.setTutorEdits(other); // 끊긴 동안 저장
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(10_000);
    const ws2 = FakeWS.all[1]!;
    ws2.onopen?.();
    expect(ws2.sent).toEqual([{ t: 'watch', code: 'ABC234', token: TOKEN }]);
    ws2.recv({ t: 'snapshot', code: 'ABC234', paused: false, groups: [] });
    expect(ws2.sent[1]).toEqual({ t: 'tutor', edits: other });
  });
});

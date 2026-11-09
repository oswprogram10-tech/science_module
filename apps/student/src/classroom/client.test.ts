import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bus, reportSafety, reportSafetyClear, reportStatus } from './bus';
import { StudentClassroom } from './client';
import { FLUSH_GAP_MS } from './queue';

class FakeWS {
  static OPEN = 1;
  static all: FakeWS[] = [];
  readyState = 1;
  sent: { at: number; msg: Record<string, unknown> }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.all.push(this);
  }
  send(d: string) {
    this.sent.push({ at: Date.now(), msg: JSON.parse(d) as Record<string, unknown> });
  }
  close() {}
  recv(o: unknown) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
  types() {
    return this.sent.map((s) => s.msg.t);
  }
}

const CODE = 'ABC234';
const joined = { t: 'joined', code: CODE, group: 2 };
const last = () => FakeWS.all[FakeWS.all.length - 1]!;

function connect(c: StudentClassroom) {
  c.join('ws://x/ws', 'B', { code: CODE, group: 2 });
  const ws = last();
  ws.onopen?.();
  ws.recv(joined);
  return ws;
}

beforeEach(() => {
  FakeWS.all = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeWS);
  reportStatus(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  bus.setPaused(false);
});

describe('학생 수업 연결', () => {
  it('끊긴 동안 쌓인 안전 알림은 줄여서 150ms 이상 간격으로 보낸다', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    ws.onclose?.(); // 끊김
    expect(c.getState().link).toBe('retrying');
    reportSafety('SPILL');
    reportSafety('SPILL');
    reportSafety('FOOD');
    reportSafetyClear(['SPILL']);
    reportSafety('NO_GLOVES');
    vi.advanceTimersByTime(1000); // 재연결 대기
    const ws2 = last();
    expect(ws2).not.toBe(ws);
    ws2.onopen?.();
    ws2.recv(joined);
    expect(ws2.types()).toEqual(['join', 'status']); // 쌓인 것은 아직 안 보냄
    vi.advanceTimersByTime(2000);
    const queued = ws2.sent.slice(2);
    // SPILL 안전 1개(마지막), FOOD, SPILL 해제, NO_GLOVES: 중복은 줄었다
    expect(queued.map((q) => `${q.msg.t}:${q.msg.type}`)).toEqual(['safety:SPILL', 'safety:FOOD', 'safetyClear:SPILL', 'safety:NO_GLOVES']);
    const times = queued.map((q) => q.at);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(FLUSH_GAP_MS);
    expect(times[0]! - ws2.sent[1]!.at).toBeGreaterThanOrEqual(FLUSH_GAP_MS);
    c.leave();
  });

  it('쌓는 개수는 8개까지', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    ws.onclose?.();
    for (const t of ['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD'] as const) {
      reportSafety(t);
      reportSafetyClear([t]);
    }
    reportSafety('SPILL'); // 같은 종류의 마지막 하나만 남는다
    vi.advanceTimersByTime(1000);
    const ws2 = last();
    ws2.onopen?.();
    ws2.recv(joined);
    vi.advanceTimersByTime(5000);
    expect(ws2.sent.slice(2)).toHaveLength(8);
    c.leave();
  });

  it('참여한 뒤의 bad_message는 내보내지 않고 console.warn만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = new StudentClassroom();
    const ws = connect(c);
    ws.recv({ t: 'error', code: 'bad_message' });
    expect(c.getState()).toMatchObject({ link: 'online', session: { code: CODE, group: 2 }, error: null });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    c.leave();
  });

  it('참여 전(대화상자에서 막 누른 참여)의 bad_message는 오류로 보인다', () => {
    const c = new StudentClassroom();
    c.join('ws://x/ws', 'B', { code: CODE, group: 2 });
    const ws = last();
    ws.onopen?.();
    ws.recv({ t: 'error', code: 'bad_message' });
    expect(c.getState().session).toBeNull();
    expect(c.getState().error).toContain('참여하지 못했어요');
  });

  it('보내는 글자는 규격 상한(64자, appVersion 32자)에 맞게 자른다', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    reportStatus({ unitId: 'u'.repeat(200), activity: 'classify', phase: 'running', trials: 123456, lastKind: 'k'.repeat(200), safetyLocked: false });
    vi.advanceTimersByTime(2000);
    const status = ws.sent.map((s) => s.msg).filter((m) => m.t === 'status').pop()!;
    expect((status.unitId as string).length).toBe(64);
    expect((status.lastKind as string).length).toBe(64);
    expect(status.trials).toBe(9999);
    expect(((ws.sent[0]!.msg.appVersion) as string).length).toBeLessThanOrEqual(32);
    c.leave();
  });

  it('experimentId는 있을 때만 status에 실리고 64자로 자른다(하위 호환)', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    reportStatus({ unitId: 'g5-mixture', activity: 'card-sort', experimentId: 'separation-methods', phase: 'running', trials: 1, safetyLocked: false });
    vi.advanceTimersByTime(2000);
    let status = ws.sent.map((s) => s.msg).filter((m) => m.t === 'status').pop()!;
    expect(status.experimentId).toBe('separation-methods');
    reportStatus({ unitId: 'g4-gases', activity: 'variable', phase: 'running', trials: 1, safetyLocked: false });
    vi.advanceTimersByTime(2000);
    status = ws.sent.map((s) => s.msg).filter((m) => m.t === 'status').pop()!;
    expect(status).not.toHaveProperty('experimentId');
    reportStatus({ unitId: 'u', activity: 'card-sort', experimentId: 'e'.repeat(200), phase: 'running', trials: 1, safetyLocked: false });
    vi.advanceTimersByTime(2000);
    status = ws.sent.map((s) => s.msg).filter((m) => m.t === 'status').pop()!;
    expect((status.experimentId as string).length).toBe(64);
    c.leave();
  });

  it('멈춤 중 수업 나가기를 누르면 멈춤이 풀린다', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    ws.recv({ t: 'pause', on: true });
    expect(bus.getPaused()).toBe(true);
    c.leave(); // 멈춤 막의 「수업 나가기」 버튼이 부르는 함수
    expect(bus.getPaused()).toBe(false);
    expect(c.getState()).toMatchObject({ session: null, link: 'off' });
  });

  it('서버가 pause off를 보내면 멈춤이 풀린다(교사 부재 해제)', () => {
    const c = new StudentClassroom();
    const ws = connect(c);
    ws.recv({ t: 'pause', on: true });
    ws.recv({ t: 'pause', on: false });
    expect(bus.getPaused()).toBe(false);
    c.leave();
  });
});

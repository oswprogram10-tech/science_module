import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BleError, type BleFilters, type BleTransport } from '@sci/sensors';
import { createRealPulseController, type Timers } from './controller';
import { COUNT_MAX, COUNT_MIN, EXPIRE_MS, countToBpm, initialState, reducer, type Action, type RealPulseState } from './model';
import { RealPulsePanel } from './RealPulsePanel';
import { ConsentDialog } from './ConsentDialog';

/** 컨트롤러가 보내는 상태 변화를 reducer에 그대로 적용해 현재 상태를 들고 있는 시험 도구 */
function harness(extra: Partial<Parameters<typeof createRealPulseController>[0]> = {}) {
  let state: RealPulseState = initialState();
  const actions: Action[] = [];
  const target = new EventTarget();
  const ctl = createRealPulseController({
    dispatch: (a) => {
      actions.push(a);
      state = reducer(state, a);
    },
    pageTarget: target,
    ...extra,
  });
  ctl.attach();
  return { ctl, target, actions, get: () => state };
}

const hasAnyValue = (s: RealPulseState) => Object.values(s.slots).some((v) => v !== null) || s.live !== null || s.draft !== '' || s.counting !== null || s.entering !== null;

describe('15초 센 횟수 → 회/분', () => {
  it('5~60의 정수만 받고 ×4 한다', () => {
    expect(countToBpm('5')).toBe(20);
    expect(countToBpm('19')).toBe(76);
    expect(countToBpm(' 60 ')).toBe(240);
    for (const bad of ['4', '61', '', 'abc', '1.5', '-5', '１９', '19회', '0']) expect(countToBpm(bad), bad).toBeNull();
    expect([COUNT_MIN, COUNT_MAX]).toEqual([5, 60]);
  });
});

describe('허가(H1)', () => {
  it('허가 전에는 측정·기록·센서 연결 조작이 아무것도 하지 않는다', () => {
    const { ctl, actions, get } = harness({ createTransport: () => { throw new Error('연결하면 안 돼요'); } });
    ctl.startCount('before');
    expect(ctl.submitCount('before', '19')).toBe(false);
    ctl.saveLive('before', 80);
    ctl.connectBle();
    ctl.setDraft('19');
    expect(actions).toEqual([]);
    expect(get().consent).toBe(false);
  });

  it('허가하면 켜지고, 상태에 허가 여부 말고 값은 없다', () => {
    const { ctl, get } = harness();
    ctl.grant();
    expect(get().consent).toBe(true);
    expect(hasAnyValue(get())).toBe(false);
  });

  it('처음 상태는 허가 전이다 (저장해 둔 허가를 읽지 않는다)', () => {
    expect(initialState().consent).toBe(false);
  });

  it('화면: 허가 전에는 측정 버튼이 모두 비활성이고, 허가 화면은 role="dialog"이다', () => {
    const html = renderToStaticMarkup(createElement(RealPulsePanel, { friend: { before: 85, after: 111, later: 100 } }));
    expect(html).toContain('허가 전');
    for (const name of ['15초 재기', '블루투스 심박 센서 연결', '지금 지우기', '그만두기']) {
      const buttons = html.match(new RegExp(`<button[^>]*>${name}</button>`, 'g')) ?? [];
      expect(buttons.length, name).toBeGreaterThan(0);
      for (const b of buttons) expect(b, name).toContain('disabled');
    }
    expect(html).toContain('내 맥박은 사람마다 달라요. 가상 친구와 똑같지 않아도 괜찮아요.');
    expect(html).not.toContain('role="dialog"');
    const dialog = renderToStaticMarkup(createElement(ConsentDialog, { onGrant: () => {}, onDecline: () => {} }));
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('허가할게요');
    expect(dialog).toContain('안 할래요');
    for (const t of ['이 기기 안에만', '서버로 보내지 않아요', '바로 지워져요', '언제든 그만둘 수 있어요']) expect(dialog).toContain(t);
  });

  it('화면: 각 칸 옆에 같은 시점의 가상 친구 값을 보여 준다', () => {
    const html = renderToStaticMarkup(createElement(RealPulsePanel, { friend: { before: 85, after: 111, later: 100 } }));
    for (const t of ['운동 전', '운동 직후', '3분 뒤', '85회/분', '111회/분', '100회/분']) expect(html).toContain(t);
  });
});

describe('15초 세기와 기록', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('15초가 지나면 센 횟수를 입력받고, 기록하면 ×4가 칸에 들어간다', () => {
    const h = harness();
    h.ctl.grant();
    h.ctl.startCount('after');
    expect(h.get().counting).toEqual({ slot: 'after', remaining: 15 });
    vi.advanceTimersByTime(14_000);
    expect(h.get().counting).toEqual({ slot: 'after', remaining: 1 });
    vi.advanceTimersByTime(1_000);
    expect(h.get().counting).toBeNull();
    expect(h.get().entering).toBe('after');
    h.ctl.setDraft('27');
    expect(h.ctl.submitCount('after', h.get().draft)).toBe(true);
    expect(h.get().slots).toEqual({ before: null, after: 108, later: null });
    expect(h.get().entering).toBeNull();
    expect(h.get().draft).toBe('');
  });

  it('범위 밖이면 기록하지 않고 안내만 한다', () => {
    const h = harness();
    h.ctl.grant();
    expect(h.ctl.submitCount('before', '3')).toBe(false);
    expect(h.get().slots.before).toBeNull();
    expect(h.get().error).toContain('5에서 60 사이');
  });

  it('세는 도중 멈추면 타이머가 사라진다', () => {
    const h = harness();
    h.ctl.grant();
    h.ctl.startCount('before');
    h.ctl.cancelCount();
    vi.advanceTimersByTime(60_000);
    expect(h.get().counting).toBeNull();
    expect(h.get().entering).toBeNull();
  });
});

describe('지우기(H3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const filled = () => {
    const h = harness();
    h.ctl.grant();
    h.ctl.submitCount('before', '18');
    h.ctl.submitCount('after', '30');
    h.ctl.setDraft('21');
    return h;
  };

  it('지금 지우기: 값을 모두 지우고 허가는 남긴다', () => {
    const h = filled();
    expect(h.get().slots).toEqual({ before: 72, after: 120, later: null });
    h.ctl.clear();
    expect(hasAnyValue(h.get())).toBe(false);
    expect(h.get().consent).toBe(true);
    expect(h.get().notice).toBe('내 맥박을 지웠어요.');
  });

  it('그만두기: 값을 지우고 허가도 거둔다 (다시 허가를 물어야 한다)', () => {
    const h = filled();
    h.ctl.withdraw();
    expect(hasAnyValue(h.get())).toBe(false);
    expect(h.get().consent).toBe(false);
    h.ctl.startCount('before');
    expect(h.get().counting).toBeNull();
    h.ctl.grant();
    expect(hasAnyValue(h.get())).toBe(false);
  });

  it('마지막 측정 뒤 30분이 지나면 지운다 (측정할 때마다 30분을 다시 센다)', () => {
    const h = harness();
    h.ctl.grant();
    h.ctl.submitCount('before', '18');
    vi.advanceTimersByTime(EXPIRE_MS - 1);
    expect(h.get().slots.before).toBe(72);
    h.ctl.submitCount('after', '30'); // 마지막 측정이 옮겨진다
    vi.advanceTimersByTime(EXPIRE_MS - 1);
    expect(h.get().slots).toEqual({ before: 72, after: 120, later: null });
    vi.advanceTimersByTime(1);
    expect(hasAnyValue(h.get())).toBe(false);
    expect(h.get().notice).toBe('30분이 지나서 내 맥박을 지웠어요.');
    expect(h.get().consent).toBe(true);
  });

  it('측정이 없으면 지울 때를 기다리는 시간 도구도 없다', () => {
    const h = harness();
    h.ctl.grant();
    expect(vi.getTimerCount()).toBe(0);
    h.ctl.submitCount('before', '18');
    expect(vi.getTimerCount()).toBe(1);
    h.ctl.clear();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('주입한 시계로도 동작한다 (가짜 timers)', () => {
    const jobs: { fn: () => void; ms: number; id: number; live: boolean }[] = [];
    const timers: Timers = {
      setTimeout: (fn, ms) => {
        jobs.push({ fn, ms, id: jobs.length, live: true });
        return jobs.length - 1;
      },
      clearTimeout: (h) => {
        jobs[h as number]!.live = false;
      },
    };
    const h = harness({ timers });
    h.ctl.grant();
    h.ctl.submitCount('before', '18');
    const job = jobs.filter((j) => j.live).pop()!;
    expect(job.ms).toBe(30 * 60 * 1000);
    job.fn();
    expect(hasAnyValue(h.get())).toBe(false);
  });

  it('pagehide: 값을 지우고 허가도 거둔다 (bfcache로 되살아나도 값이 없다)', () => {
    const h = filled();
    h.target.dispatchEvent(new Event('pagehide'));
    expect(hasAnyValue(h.get())).toBe(false);
    expect(h.get().consent).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('화면을 떠나면(dispose) 시간 도구가 모두 사라지고 pagehide도 더 듣지 않는다', () => {
    const h = filled();
    h.ctl.startCount('later');
    h.ctl.dispose();
    expect(vi.getTimerCount()).toBe(0);
    const before = h.actions.length;
    h.target.dispatchEvent(new Event('pagehide'));
    expect(h.actions.length).toBe(before);
    h.ctl.submitCount('later', '20');
    expect(h.actions.length).toBe(before);
  });
});

/** 알림을 직접 밀어 넣을 수 있는 가짜 블루투스 전송 */
class FakeTransport implements BleTransport {
  calls: string[] = [];
  filters: BleFilters | null = null;
  push: ((v: DataView) => void) | null = null;
  fail: BleError | null = null;
  async requestDevice(f: BleFilters) {
    this.calls.push('request');
    this.filters = f;
    if (this.fail) throw this.fail;
  }
  async connect() {
    this.calls.push('connect');
  }
  async startNotifications(service: string, characteristic: string, cb: (v: DataView) => void) {
    this.calls.push(`notify:${service}:${characteristic}`);
    this.push = cb;
  }
  async disconnect() {
    this.calls.push('disconnect');
  }
  onDisconnect() {}
}
const bytes = (...b: number[]) => new DataView(new Uint8Array(b).buffer);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('블루투스 심박 센서', () => {
  it('Heart Rate 서비스·특성으로 연결하고, 받은 값은 상태에만 두며, 칸에 넣을 수 있다', async () => {
    const t = new FakeTransport();
    const h = harness({ createTransport: () => t });
    h.ctl.grant();
    h.ctl.connectBle();
    await flush();
    expect(h.get().ble).toBe('connected');
    expect(h.get().bleMessage).toBe('센서 연결됨');
    expect(t.calls).toEqual(['request', 'connect', 'notify:0000180d-0000-1000-8000-00805f9b34fb:00002a37-0000-1000-8000-00805f9b34fb']);
    t.push!(bytes(0x00, 72));
    expect(h.get().live).toBe(72);
    t.push!(bytes(0x01, 0x5a, 0x00));
    expect(h.get().live).toBe(90);
    h.ctl.saveLive('later', h.get().live!);
    expect(h.get().slots.later).toBe(90);
  });

  it('지우면 센서 연결도 끊고 이후 값은 받지 않는다', async () => {
    const t = new FakeTransport();
    const h = harness({ createTransport: () => t });
    h.ctl.grant();
    h.ctl.connectBle();
    await flush();
    t.push!(bytes(0x00, 72));
    h.ctl.clear();
    expect(t.calls).toContain('disconnect');
    expect(h.get().live).toBeNull();
    expect(h.get().ble).toBe('idle');
    t.push!(bytes(0x00, 99));
    expect(h.get().live).toBeNull();
  });

  it('블루투스를 쓸 수 없거나 거부되면 한국어 안내만 한다', async () => {
    const none = harness({ createTransport: () => null });
    none.ctl.grant();
    none.ctl.connectBle();
    expect(none.get().ble).toBe('error');
    expect(none.get().bleMessage).toContain('블루투스');
    const t = new FakeTransport();
    t.fail = new BleError('cancelled');
    const h = harness({ createTransport: () => t });
    h.ctl.grant();
    h.ctl.connectBle();
    await flush();
    expect(h.get().ble).toBe('error');
    expect(h.get().bleMessage).toContain('센서를 고르지 않았거나');
  });

  it('화면을 떠나면 센서 연결을 끊는다', async () => {
    const t = new FakeTransport();
    const h = harness({ createTransport: () => t });
    h.ctl.grant();
    h.ctl.connectBle();
    await flush();
    h.ctl.dispose();
    expect(t.calls).toContain('disconnect');
  });
});

describe('H2: 실측값을 다루는 코드는 어디에도 쓰거나 보내지 않는다', () => {
  // 주석을 뺀 코드에 저장소·네트워크·로그·주소를 만지는 말이 없어야 한다.
  const FORBIDDEN = ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'console', 'location', 'history', 'fetch', 'WebSocket', 'XMLHttpRequest', 'sendBeacon', 'xapi', 'recorder', 'classroom', 'postMessage', 'BroadcastChannel', 'document.cookie', 'logbook'];
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));

  it('realPulse 폴더의 코드 파일', () => {
    expect(files).toEqual(expect.arrayContaining(['model.ts', 'controller.ts', 'useRealPulse.ts', 'RealPulsePanel.tsx', 'ConsentDialog.tsx']));
    for (const f of files) {
      const code = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
      for (const word of FORBIDDEN) expect(code, `${f}: ${word}`).not.toContain(word);
    }
  });
});

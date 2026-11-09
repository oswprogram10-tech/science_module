import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGBOOK_KEY, MAX_BYTES, createLogbook, dayOf, fitToCap, type LogStorage } from './logbook';

/** 메모리 저장소. 호출 기록(calls)을 남겨 "쓰지 않았다"를 확인한다. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const calls: string[] = [];
  const storage: LogStorage = {
    getItem: (k) => {
      calls.push(`get:${k}`);
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      calls.push(`set:${k}`);
      data.set(k, v);
    },
    removeItem: (k) => {
      calls.push(`remove:${k}`);
      data.delete(k);
    },
  };
  return { storage, data, calls, writes: () => calls.filter((c) => !c.startsWith('get:')) };
}

const at = (iso: string) => () => new Date(iso);

describe('기록장: 기본은 꺼짐', () => {
  it('꺼져 있으면 어떤 기록 함수도 쓰지 않는다(빈 키도 만들지 않는다)', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage, now: at('2026-11-05T09:00:00') });
    expect(lb.isEnabled()).toBe(false);
    expect(lb.noteVariableTrial('g5-solution', { iv: 'temp', fair: true, predictionMatched: true })).toBe(false);
    expect(lb.noteClassifyComplete('g6-acid-base')).toBe(false);
    expect(lb.noteCardSort('g3-animal', 2, true)).toBe(false);
    expect(lb.noteObservation('g6-earth-motion', 't1', true)).toBe(false);
    expect(lb.savePortfolio({ jobKey: 'vet', jobText: '', skills: [], more: '글' })).toBe(false);
    expect(lb.entries()).toEqual([]);
    expect(m.writes()).toEqual([]);
    expect(m.data.has(LOGBOOK_KEY)).toBe(false);
  });

  it('끈 채 읽기만 해도 쓰지 않는다', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage });
    lb.isEnabled();
    lb.usable();
    lb.hasStoredData();
    lb.entries();
    expect(m.writes()).toEqual([]);
  });
});

describe('기록장: 켜고 기록하기', () => {
  const setup = (iso = '2026-11-05T09:00:00') => {
    const m = memory();
    let now = new Date(iso);
    const lb = createLogbook({ storage: m.storage, now: () => now });
    return { m, lb, setNow: (d: string) => (now = new Date(d)) };
  };

  it('켜면 키가 생기고 기록이 쌓인다', () => {
    const { m, lb } = setup();
    expect(lb.enable()).toBe(true);
    expect(lb.isEnabled()).toBe(true);
    expect(JSON.parse(m.data.get(LOGBOOK_KEY)!)).toEqual({ v: 1, enabled: true, entries: [] });
    lb.noteVariableTrial('g5-solution', { iv: 'temp', fair: true, predictionMatched: true });
    expect(lb.entries()).toEqual([
      { unitId: 'g5-solution', kind: 'variable', day: '2026-11-05', summary: { trials: 1, fair: 1, fairKeys: ['temp'], predicted: 1, matched: 1 } },
    ]);
  });

  it('같은 단원·같은 날은 한 항목으로 합치고, 다른 날은 새 항목이다', () => {
    const { lb, setNow } = setup();
    lb.enable();
    lb.noteVariableTrial('g5-solution', { iv: 'temp', fair: true, predictionMatched: true });
    lb.noteVariableTrial('g5-solution', { iv: 'temp', fair: true, predictionMatched: false });
    lb.noteVariableTrial('g5-solution', { iv: 'amount', fair: false });
    expect(lb.entries()).toHaveLength(1);
    expect(lb.entries()[0]!.summary).toEqual({ trials: 3, fair: 2, fairKeys: ['temp'], predicted: 2, matched: 1 });
    setNow('2026-11-06T09:00:00');
    lb.noteVariableTrial('g5-solution', { iv: 'amount', fair: true });
    expect(lb.entries().map((e) => e.day)).toEqual(['2026-11-05', '2026-11-06']);
    expect(lb.entries()[1]!.summary).toEqual({ trials: 1, fair: 1, fairKeys: ['amount'], predicted: 0, matched: 0 });
  });

  it('분류·카드 분류·관찰 요약', () => {
    const { lb } = setup();
    lb.enable();
    lb.noteClassifyComplete('g6-acid-base');
    lb.noteCardSort('g3-animal', 1, false);
    lb.noteCardSort('g3-animal', 2, true);
    lb.noteCardSort('g3-animal', 1, false); // 줄어들지 않는다
    lb.noteObservation('g6-earth-motion', 'a', false);
    lb.noteObservation('g6-earth-motion', 'a', true);
    lb.noteObservation('g6-earth-motion', 'b', true);
    const by = Object.fromEntries(lb.entries().map((e) => [e.kind, e.summary]));
    expect(by['classify']).toEqual({ completed: true });
    expect(by['card-sort']).toEqual({ criteriaDone: 2, finished: true });
    expect(by['observation']).toEqual({ recorded: ['a', 'b'], matched: ['a', 'b'] });
  });

  it('주입한 시계로 날짜를 정한다(일 단위, 지역 날짜)', () => {
    expect(dayOf(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03');
    const { lb } = setup('2026-03-09T08:00:00');
    lb.enable();
    lb.noteClassifyComplete('g6-acid-base');
    expect(lb.entries()[0]!.day).toBe('2026-03-09');
  });

  it('진로 카드는 하나만 두고 글 길이를 줄인다', () => {
    const { lb } = setup();
    lb.enable();
    lb.savePortfolio({ jobKey: 'vet', jobText: '', skills: ['observe'], more: '가'.repeat(500) });
    lb.savePortfolio({ jobKey: null, jobText: '나'.repeat(100), skills: ['predict'], more: '다' });
    const cards = lb.entries().filter((e) => e.kind === 'portfolio');
    expect(cards).toHaveLength(1);
    expect(lb.portfolioCard()).toEqual({ jobKey: null, jobText: '나'.repeat(40), skills: ['predict'], more: '다' });
    lb.savePortfolio({ jobKey: 'vet', jobText: '', skills: [], more: '가'.repeat(500) });
    expect(lb.portfolioCard()!.more).toHaveLength(200);
  });

  it('기록 항목에는 이름·가명 ID·교실 코드·시행별 값 자리가 없다', () => {
    const { m, lb } = setup();
    lb.enable();
    lb.noteVariableTrial('g5-solution', { iv: 'temp', fair: true, predictionMatched: true });
    lb.noteClassifyComplete('g6-acid-base');
    const json = m.data.get(LOGBOOK_KEY)!;
    for (const word of ['anon-student', 'actor', 'classroom', 'code', 'name', 'values', 'tutor', 'pulse']) {
      expect(json.toLowerCase(), word).not.toContain(word);
    }
    for (const e of lb.entries()) expect(Object.keys(e).sort()).toEqual(['day', 'kind', 'summary', 'unitId']);
  });
});

describe('기록장: 끄기와 지우기', () => {
  it('끄기(지우지 않음)는 기록을 멈추고, 다시 켜면 이전 기록이 보인다', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage, now: at('2026-11-05T09:00:00') });
    lb.enable();
    lb.noteClassifyComplete('g6-acid-base');
    expect(lb.disable(false)).toBe(true);
    expect(lb.isEnabled()).toBe(false);
    expect(lb.entries()).toEqual([]);
    expect(lb.hasStoredData()).toBe(true);
    const before = m.data.get(LOGBOOK_KEY);
    expect(lb.noteClassifyComplete('g3-animal')).toBe(false);
    expect(m.data.get(LOGBOOK_KEY)).toBe(before);
    lb.enable();
    expect(lb.entries().map((e) => e.unitId)).toEqual(['g6-acid-base']);
  });

  it('끄면서 지우면 키가 사라진다', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage });
    lb.enable();
    lb.disable(true);
    expect(m.data.has(LOGBOOK_KEY)).toBe(false);
    expect(lb.isEnabled()).toBe(false);
  });

  it('모두 지우기는 키를 삭제한다', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage });
    lb.enable();
    lb.noteClassifyComplete('g6-acid-base');
    expect(lb.clearAll()).toBe(true);
    expect(m.data.has(LOGBOOK_KEY)).toBe(false);
    expect(lb.entries()).toEqual([]);
  });

  it('바뀔 때마다 구독자에게 알린다', () => {
    const m = memory();
    const lb = createLogbook({ storage: m.storage });
    let n = 0;
    const off = lb.subscribe(() => n++);
    lb.enable();
    lb.clearAll();
    off();
    lb.enable();
    expect(n).toBe(2);
    expect(lb.getVersion()).toBe(3);
  });
});

describe('기록장: 200 KB 상한', () => {
  it('넘치면 오래된 항목부터 버린다', () => {
    const entry = (i: number) => ({
      unitId: `u${i}`,
      kind: 'observation' as const,
      day: '2026-11-05',
      summary: { recorded: Array.from({ length: 40 }, (_, k) => `${'t'.repeat(50)}${i}-${k}`), matched: [] },
    });
    const state = { v: 1 as const, enabled: true, entries: Array.from({ length: 200 }, (_, i) => entry(i)) };
    const fit = fitToCap(state)!;
    expect(new TextEncoder().encode(fit.json).length).toBeLessThanOrEqual(MAX_BYTES);
    expect(fit.entries.length).toBeLessThan(200);
    expect(fit.entries[fit.entries.length - 1]!.unitId).toBe('u199');
    expect(fit.entries[0]!.unitId).not.toBe('u0');
  });

  it('상한 가까이 찬 저장소에 더 기록해도 상한을 넘지 않고 최근 기록은 남는다', () => {
    const old = Array.from({ length: 200 }, (_, i) => ({
      unitId: `old-${i}`,
      kind: 'observation',
      day: '2026-01-01',
      summary: { recorded: Array.from({ length: 20 }, (_, k) => `${'t'.repeat(50)}-${i}-${k}`), matched: [] },
    }));
    const seeded = JSON.stringify({ v: 1, enabled: true, entries: old });
    expect(new TextEncoder().encode(seeded).length).toBeGreaterThan(MAX_BYTES);
    const m = memory({ [LOGBOOK_KEY]: seeded });
    const lb = createLogbook({ storage: m.storage, now: at('2026-11-05T09:00:00') });
    for (let i = 0; i < 5; i++) lb.noteObservation(`new-${i}`, 'task', true);
    expect(new TextEncoder().encode(m.data.get(LOGBOOK_KEY)!).length).toBeLessThanOrEqual(MAX_BYTES);
    const ids = lb.entries().map((e) => e.unitId);
    expect(ids.slice(-5)).toEqual(['new-0', 'new-1', 'new-2', 'new-3', 'new-4']);
    expect(ids).not.toContain('old-0');
  });
});

describe('기록장: 저장소 예외', () => {
  const throwing = (which: 'get' | 'set' | 'remove' | 'all'): LogStorage => ({
    getItem: () => {
      if (which === 'get' || which === 'all') throw new Error('blocked');
      return null;
    },
    setItem: () => {
      if (which === 'set' || which === 'all') throw new Error('quota');
    },
    removeItem: () => {
      if (which === 'remove' || which === 'all') throw new Error('blocked');
    },
  });

  it('읽기가 막혀 있으면 꺼진 것으로 보고 던지지 않는다', () => {
    const lb = createLogbook({ storage: throwing('all') });
    expect(() => {
      lb.isEnabled();
      lb.entries();
      lb.noteVariableTrial('a', { fair: true });
      lb.clearAll();
      lb.disable(false);
    }).not.toThrow();
    expect(lb.isEnabled()).toBe(false);
    expect(lb.usable()).toBe(false);
    expect(lb.enable()).toBe(false);
  });

  it('쓰기만 막혀 있으면 켜지 못하고 쓸 수 없다고 본다', () => {
    const lb = createLogbook({ storage: throwing('set') });
    expect(lb.enable()).toBe(false);
    expect(lb.usable()).toBe(false);
    expect(lb.isEnabled()).toBe(false);
  });

  it('저장소가 없으면(null, 접근 예외) 쓸 수 없다', () => {
    expect(createLogbook({ storage: null }).usable()).toBe(false);
    const lb = createLogbook({
      storage: () => {
        throw new Error('SecurityError');
      },
    });
    expect(() => lb.isEnabled()).not.toThrow();
    expect(lb.usable()).toBe(false);
  });

  it('깨진 JSON은 꺼진 것으로 보고 켤 때 새로 만든다', () => {
    const m = memory({ [LOGBOOK_KEY]: '{not json' });
    const lb = createLogbook({ storage: m.storage });
    expect(lb.isEnabled()).toBe(false);
    expect(lb.entries()).toEqual([]);
    expect(lb.enable()).toBe(true);
    expect(lb.entries()).toEqual([]);
  });

  it('모르는 항목은 걸러낸다', () => {
    const bad = JSON.stringify({ v: 1, enabled: true, entries: [{ unitId: 'a', kind: 'weird', day: '2026-01-01', summary: {} }, { unitId: 'b', kind: 'classify', day: 'x', summary: {} }, 7] });
    const lb = createLogbook({ storage: memory({ [LOGBOOK_KEY]: bad }).storage });
    expect(lb.isEnabled()).toBe(true);
    expect(lb.entries()).toEqual([]);
  });
});

describe('기록장: 소스 검사(개인정보)', () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  const read = (dir: string, re = /\.tsx?$/) =>
    readdirSync(dir)
      .filter((f) => re.test(f) && !/\.test\./.test(f))
      .map((f) => ({ f, code: strip(readFileSync(join(dir, f), 'utf8')) }));

  it('realPulse 폴더는 기록장을 가져오거나 부르지 않는다', () => {
    const files = read(join(__dirname, '../modules/exercise-body/realPulse'));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const { f, code } of files) {
      expect(code.toLowerCase(), f).not.toContain('logbook');
      expect(code, f).not.toContain('sci-bridge.');
    }
  });

  it('맥박 단원의 다른 코드도 기록장을 쓰지 않는다', () => {
    for (const { f, code } of read(join(__dirname, '../modules/exercise-body'))) {
      expect(code.toLowerCase(), f).not.toContain('logbook');
    }
  });

  it('교실 연결 코드와 xAPI 패키지는 기록장을 가져오지 않는다', () => {
    for (const { f, code } of read(join(__dirname, '../classroom'))) expect(code.toLowerCase(), f).not.toContain('logbook');
    for (const { f, code } of read(join(__dirname, '../../../../packages/xapi/src'))) expect(code.toLowerCase(), f).not.toContain('logbook');
    for (const { f, code } of read(join(__dirname, '../../../../packages/classroom/src'))) expect(code.toLowerCase(), f).not.toContain('logbook');
  });

  it('기록장 코드는 네트워크·교실·xAPI 코드를 가져오지 않는다', () => {
    for (const { f, code } of read(__dirname)) {
      for (const word of ['fetch', 'WebSocket', 'XMLHttpRequest', 'sendBeacon', 'xapi', 'classroom', 'postMessage', 'BroadcastChannel', 'document.cookie', 'console', 'sessionStorage', 'indexedDB']) {
        expect(code, `${f}: ${word}`).not.toContain(word);
      }
    }
  });

  it('localStorage는 logbook.ts 한 곳에서만, 키 하나만 쓴다', () => {
    const files = read(__dirname);
    const users = files.filter(({ code }) => code.includes('localStorage')).map(({ f }) => f);
    expect(users).toEqual(['logbook.ts']);
    expect(LOGBOOK_KEY).toBe('sci-bridge.logbook.v1');
  });
});

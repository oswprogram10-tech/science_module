import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulateStringSound, type StringSoundSample } from '@sci/engine-physics';
import type { Trial } from '@sci/runtime';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { stringSoundModule } from './index';
import { soundNote } from './initial';
import { COLS, MOVE_PX, denseCenters, SoundAirView, airX, lambdaOf, moveOf } from './SoundAirView';
import { SoundMacroView, bandHeight, bridgeX } from './SoundMacroView';

const unit = UNITS.find((u) => u.id === 'g3-sound')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g3-sound가 없어요');
const experiment = unit.experiment;
const base = { strength: 'weak', lengthCm: 20, color: 'red' };
const sim = (v: typeof base) => simulateStringSound(v as never);
const last = (v: typeof base): StringSoundSample => sim(v).samples.at(-1)!;

// 화면은 trial의 내용 중 samples만 읽는다.
const trialOf = (v: typeof base) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: typeof base, snapshot: StringSoundSample | null, ran = true) =>
  renderToStaticMarkup(createElement(SoundMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const air = (v: typeof base, snapshot: StringSoundSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(SoundAirView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const cxs = (html: string) => [...html.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]));

describe('레지스트리', () => {
  it('g3-sound는 string-sound 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(3);
    expect(unit.module).toBe(stringSoundModule);
    expect(MODULES['string-sound'].kind).toBe('string-sound');
    expect(experiment.safety).toEqual([]);
    expect(experiment.safetyChecklist).toBeUndefined();
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 6줄', () => {
    const cols = stringSoundModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['1초 동안 떨린 횟수(번)', '소리의 크기(눈금)']);
    const row = (strength: string, lengthCm: number) => cols.map((c) => c.value(sim({ ...base, strength, lengthCm }).result));
    expect(row('weak', 15)).toEqual(['440', '62.0']);
    expect(row('weak', 20)).toEqual(['330', '62.0']);
    expect(row('weak', 30)).toEqual(['220', '62.0']);
    expect(row('strong', 15)).toEqual(['440', '70.0']);
    expect(row('strong', 20)).toEqual(['330', '70.0']);
    expect(row('strong', 30)).toEqual(['220', '70.0']);
  });

  it('센서: 가상 소리 센서는 sound 종류로 소리의 크기(눈금)를 읽는다', () => {
    const [none] = stringSoundModule.sensors(null, base);
    expect([none!.kind, none!.unit, none!.label, none!.source]).toEqual(['sound', '눈금', '가상 소리 센서', 0]);
    expect(stringSoundModule.sensors(last({ ...base, strength: 'strong' }), base)[0]!.source).toBe(70);
    expect(stringSoundModule.sensors(last(base), base)[0]!.source).toBe(62);
  });

  it('그래프 설정', () => {
    const g = stringSoundModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks]).toEqual(['줄의 떨림', -1, [-1, -0.5, 0, 0.5, 1], '시간(1000분의 1초)', [0, 5, 10, 15, 20]]);
    expect(g.series).toBeUndefined();
    expect(g.markers).toBeUndefined();
    expect(stringSoundModule.restPlayhead).toBe(20);
  });

  it('그래프(앞 시행 선)는 displacement, 예측 비교는 freq: 길이만 바꾸면 늘었다·줄었다, 세기만 바꾸면 변하지 않았다', () => {
    const m = stringSoundModule.metric;
    expect([m.sampleKey, m.resultKey, m.sameThreshold(experiment)]).toEqual(['displacement', 'freq', 5]);
    const f = (v: typeof base) => sim(v).result[m.resultKey];
    const th = m.sameThreshold(experiment);
    expect(observedOutcome(f(base), f({ ...base, lengthCm: 15 }), th)).toBe('increase');
    expect(observedOutcome(f(base), f({ ...base, lengthCm: 30 }), th)).toBe('decrease');
    expect(observedOutcome(f(base), f({ ...base, strength: 'strong' }), th)).toBe('same');
    expect(observedOutcome(f(base), f({ ...base, color: 'yellow' }), th)).toBe('same');
  });
});

describe('눈으로 보기', () => {
  it('아래 문구와 떨리는 길이 글자', () => {
    expect(macro(base, last(base))).toContain('1초 동안 330번 떨려요 · 소리의 크기 62.0');
    expect(macro({ ...base, strength: 'strong', lengthCm: 15 }, last({ ...base, strength: 'strong', lengthCm: 15 }))).toContain('1초 동안 440번 떨려요 · 소리의 크기 70.0');
    expect(soundNote({ freq: 220, level: 62 })).toBe('1초 동안 220번 떨려요 · 소리의 크기 62.0');
    for (const L of [15, 20, 30]) expect(macro({ ...base, lengthCm: L }, last({ ...base, lengthCm: L }))).toContain(`떨리는 길이 ${L} cm`);
    expect(macro(base, last(base))).toContain('느린 화면');
  });

  it('실험 전에는 답(횟수·소리의 크기)과 떨림 띠를 보여 주지 않는다', () => {
    const html = macro(base, null, false);
    expect(html).not.toContain('330');
    expect(html).not.toContain('62.0');
    expect(count(html, 'vibe-band')).toBe(0);
    expect(html).toContain('떨리는 길이 20 cm');
  });

  it('띠의 높이는 떨림의 크기에 비례하고, 길이는 떨리는 길이에 비례한다', () => {
    expect(bandHeight(1) / bandHeight(0.4)).toBeCloseTo(2.5, 9);
    const w = macro(base, last(base));
    const s = macro({ ...base, strength: 'strong' }, last({ ...base, strength: 'strong' }));
    const h = (html: string) => Number(/data-testid="vibe-band"[^>]*height="([\d.]+)"/.exec(html)![1]);
    expect(h(s) / h(w)).toBeCloseTo(2.5, 6);
    const bandW = (L: number) => Number(/data-testid="vibe-band"[^>]*width="([\d.]+)"/.exec(macro({ ...base, lengthCm: L }, last({ ...base, lengthCm: L })))![1]);
    expect(bandW(30) / bandW(15)).toBeCloseTo(2, 9);
    expect(bridgeX(30) - bridgeX(15)).toBe(75);
  });

  it('줄 색은 줄의 색으로만 나타난다 (빨간색 #dc2626, 노란색 #eab308)', () => {
    expect(macro(base, last(base))).toContain('stroke="#dc2626"');
    expect(macro({ ...base, color: 'yellow' }, last(base))).toContain('stroke="#eab308"');
  });

  it('손가락과 세기 라벨', () => {
    expect(macro(base, last(base))).toContain('튕기는 세기: 약하게');
    expect(macro({ ...base, strength: 'strong' }, last(base))).toContain('튕기는 세기: 세게');
    expect(macro({ ...base, strength: 'strong' }, last(base))).toContain('data-strength="strong"');
  });
});

describe('공기 알갱이 보기', () => {
  const SPACING = (f: number) => lambdaOf(f);

  it('라벨(공기, 귀)과 설명 문구', () => {
    const html = air(base, last(base));
    for (const t of ['>공기<', '>귀<', '>줄<']) expect(html).toContain(t);
    expect(html).toContain('줄의 떨림이 공기를 떨리게 하고, 그 떨림이 귀에 전해져 소리가 들려요.');
    expect(count(html, 'ear')).toBe(1);
  });

  it('밀집 간격은 1/freq에 비례한다', () => {
    expect(SPACING(440) / SPACING(220)).toBeCloseTo(0.5, 9);
    expect(SPACING(440) / SPACING(330)).toBeCloseTo(0.75, 9);
    expect(SPACING(440)).toBeCloseTo(24, 9);
  });

  it('알갱이가 앞뒤로 움직이는 폭은 A에 비례한다', () => {
    expect(moveOf(1) / moveOf(0.4)).toBeCloseTo(2.5, 9);
    const maxShift = (A: number, f: number) => Math.max(...COLS.flatMap((x0) => [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((p) => Math.abs(airX(x0, f, A, p) - x0))));
    expect(maxShift(1, 440)).toBeLessThanOrEqual(MOVE_PX + 1e-9);
    expect(maxShift(1, 440)).toBeGreaterThan(MOVE_PX * 0.95);
    expect(maxShift(0.4, 440) / maxShift(1, 440)).toBeCloseTo(0.4, 1);
  });

  it('위치가 뒤섞이지 않는다: 같은 줄의 알갱이는 순서가 바뀌지 않는다', () => {
    for (const f of [220, 330, 440]) {
      const xs = COLS.map((x0) => airX(x0, f, 1, 0.37));
      for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
  });

  it('실험 전에는 알갱이가 가만히 고르게 놓여 있다 (애니메이션 없음)', () => {
    const html = air(base, null, false);
    expect(html).toContain('data-amp="0"');
    expect(html).toContain('data-running="false"');
    const row = cxs(html).slice(0, COLS.length);
    const gaps = row.slice(1).map((x, i) => +(x - row[i]!).toFixed(2));
    expect(new Set(gaps).size).toBe(1);
  });

  it('실험 중(끝에 닿기 전)에는 움직이고, 재생이 끝난 뒤에는 멈춘다', () => {
    expect(air(base, sim(base).samples[10]!, true, 5)).toContain('data-running="true"');
    expect(air(base, last(base), true, 20)).toContain('data-running="false"');
  });

  it('실험 뒤에는 멈춘 화면(재생 끝, 움직임 줄이기)에서도 촘촘한 곳 띠와 밀집한 알갱이 무늬를 그리고, 길이에 따라 띠 개수가 다르다', () => {
    const bands = (v: typeof base) => count(air(v, last(v), true, 20), 'dense-band');
    expect(bands({ ...base, lengthCm: 15 })).toBeGreaterThan(bands({ ...base, lengthCm: 20 }));
    expect(bands({ ...base, lengthCm: 20 })).toBeGreaterThan(bands({ ...base, lengthCm: 30 }));
    expect(bands({ ...base, lengthCm: 15 })).toBeGreaterThan(bands({ ...base, lengthCm: 30 }) + 1);
    expect(count(air(base, null, false), 'dense-band')).toBe(0);
    // 띠 개수는 freq에 비례한다(밀집 간격 24·32·48 → 6·4~5·3)
    expect(denseCenters(440, 0.8).length).toBe(6);
    expect(denseCenters(220, 0.8).length).toBe(3);
  });

  it('알갱이 무늬는 점 x 위치 군집으로도 길이에 따라 다르고, 세기에 따라 움직임 폭만 다르다', () => {
    const shift = (v: typeof base) => {
      const html = air(v, last(v), true, 20);
      const xs = cxs(html).slice(0, COLS.length);
      return Math.max(...xs.map((x, i) => Math.abs(x - COLS[i]!)));
    };
    const w = shift(base);
    const s = shift({ ...base, strength: 'strong' });
    expect(s / w).toBeGreaterThan(2.2);
    expect(s / w).toBeLessThan(2.8);
    // 15 cm와 30 cm는 같은 줄에서 알갱이 간격이 촘촘해지는 곳의 개수가 다르다
    const dense = (L: number) => {
      const v = { ...base, strength: 'strong', lengthCm: L };
      const xs = cxs(air(v, last(v), true, 20)).slice(0, COLS.length);
      return xs.slice(1).filter((x, i) => x - xs[i]! < 4.5 * 0.6).length;
    };
    expect(dense(15)).toBeGreaterThan(dense(30));
  });

  it('움직임 줄이기와 재생이 끝난 정지 화면은 같은 그림이다 (같은 플레이헤드)', () => {
    const stat = air(base, last(base), true, 20);
    // 움직임 줄이기는 running을 꺼서 같은 정지 경로를 쓴다: 끝에서의 정지 화면이 곧 그 그림
    expect(stat).toContain('data-running="false"');
    expect(air(base, last(base), true, 20)).toBe(stat);
    expect(stat).toContain('dense-band');
  });

  it('알갱이 개수는 조건과 관계없이 같다', () => {
    const n = (v: typeof base) => count(air(v, last(v)), 'air') && cxs(air(v, last(v))).length;
    expect(n(base)).toBe(n({ ...base, strength: 'strong', lengthCm: 15 }));
  });
});

describe('그래프: 앞 시행의 흐린 선(displacement)으로 물결 개수를 비교한다', () => {
  const trial = (v: typeof base): Trial<StringSoundSample, never> => ({ id: 't', index: 1, values: v, ivKey: null, prediction: null, samples: sim(v).samples, result: sim(v).result, analysis: { kind: 'first-trial', changed: [] } }) as never;
  const lines = (cur: typeof base, prev: typeof base) => {
    const html = renderToStaticMarkup(
      createElement(GraphView, { module: stringSoundModule as never, experiment, trial: trial(cur), prev: trial(prev), playhead: 0, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }),
    );
    const get = (re: RegExp) => [...re.exec(html)![1]!.matchAll(/([\d.]+),([\d.]+)/g)].map((m) => Number(m[2]));
    return { html, prev: get(/<polyline points="([^"]+)" fill="none" stroke="#7a8794"/), cur: get(/<polyline points="([^"]+)" fill="none" stroke="#1f6fb5"/) };
  };
  const ZERO_Y = 108;
  const waves = (ys: number[]) => ys.slice(1).filter((y, i) => ys[i]! > ZERO_Y + 1e-6 && y <= ZERO_Y + 1e-6).length; // 화면 y는 위가 작다: 아래(+)에서 위로 올라오는 곳
  it('15 cm(8.8개) 앞 시행 위에 20 cm(6.6개)을 겹치면 흐린 선은 8번, 진한 선은 6번 위로 지난다', () => {
    const { prev, cur, html } = lines(base, { ...base, lengthCm: 15 });
    expect(waves(prev)).toBe(8);
    expect(waves(cur)).toBe(6);
    expect(html).toContain('앞 시행');
  });
  it('세기만 다른 두 시행은 물결 개수가 같고 높이가 다르다', () => {
    const { prev, cur } = lines(base, { ...base, strength: 'strong' });
    expect(waves(prev)).toBe(waves(cur));
    const amp = (ys: number[]) => (Math.max(...ys) - Math.min(...ys)) / 2;
    expect(amp(prev) / amp(cur)).toBeCloseTo(2.5, 1);
  });
});

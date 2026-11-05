import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { arrivalS, simulateRamp, type RampSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { rampCartModule } from './index';
import { passed1m, rampNote } from './initial';
import { FLOOR_Y, PX_PER_M, RampMacroView, X0, xOf } from './RampMacroView';
import { SpeedCalcView } from './SpeedCalcView';

const unit = UNITS.find((u) => u.id === 'g6-motion')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g6-motion이 없어요');
const experiment = unit.experiment;
const base = { heightCm: 20, floor: 'wood', load: 0 };
const sim = (v: typeof base) => simulateRamp(v as never);
const at = (v: typeof base, t: number): RampSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const last = (v: typeof base): RampSample => sim(v).samples.at(-1)!;

const trialOf = (v: typeof base) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: typeof base, snapshot: RampSample | null, ran = true) =>
  renderToStaticMarkup(createElement(RampMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const calc = (v: typeof base, snapshot: RampSample | null, ran = true) =>
  renderToStaticMarkup(createElement(SpeedCalcView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g6-motion은 ramp-cart 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(6);
    expect(unit.module).toBe(rampCartModule);
    expect(MODULES['ramp-cart'].kind).toBe('ramp-cart');
    expect(experiment.safety).toEqual([]);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 6줄', () => {
    const cols = rampCartModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['1 m 가는 데 걸린 시간(초)', '속력(m/s)']);
    const row = (heightCm: number, floor: string) => cols.map((c) => c.value(sim({ heightCm, floor, load: 0 }).result));
    expect([10, 20, 40].map((h) => row(h, 'wood'))).toEqual([['0.80', '1.25'], ['0.55', '1.82'], ['0.38', '2.63']]);
    expect([10, 20, 40].map((h) => row(h, 'towel'))).toEqual([['0.95', '1.05'], ['0.59', '1.69'], ['0.39', '2.56']]);
  });

  it('센서: 가상 속력 센서(speed)는 그 순간 빠르기(m/s), 시행 전에는 0', () => {
    const [none] = rampCartModule.sensors(null, base);
    expect([none!.kind, none!.unit, none!.label, none!.source]).toEqual(['speed', 'm/s', '가상 속력 센서', 0]);
    const s = at(base, 0.5);
    expect(rampCartModule.sensors(s, base)[0]!.source).toBe(s.v);
  });

  it('그래프 설정: y 0~1.5 고정, x 0~1.2초, 함수형 표식 한 개', () => {
    const g = rampCartModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series]).toEqual(['출발선에서의 거리(m)', 0, [0, 0.5, 1, 1.5], '시간(초)', [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], undefined]);
    expect(g.xTickFormat!(1)).toBe('1.0');
    expect(rampCartModule.restPlayhead).toBe(1.2);
    expect(typeof g.markers).toBe('function');
    const markers = g.markers as (e: unknown, t: unknown) => { t: number; label: string; labelSide?: string }[];
    const m = markers(experiment, trialOf(base));
    expect(m).toHaveLength(1);
    expect(m[0]!.label).toBe('1 m 도착');
    expect(m[0]!.labelSide).toBe('left');
    expect(m[0]!.t).toBeCloseTo(0.5481, 4);
    // 조건에 따라 시각이 다르다
    expect(markers(experiment, trialOf({ ...base, heightCm: 40 }))[0]!.t).toBeLessThan(m[0]!.t);
    expect(markers(experiment, trialOf({ ...base, floor: 'towel', heightCm: 10 }))[0]!.t).toBeGreaterThan(m[0]!.t);
    // 추는 영향 없음
    expect(markers(experiment, trialOf({ ...base, load: 2 }))[0]!.t).toBe(m[0]!.t);
  });

  it('예측 비교는 speed, 기준 0.02: 높이를 바꾸면 늘었다, 수건이면 줄었다, 추만 바꾸면 변하지 않았다', () => {
    const m = rampCartModule.metric;
    expect([m.sampleKey, m.resultKey, m.sameThreshold(experiment)]).toEqual(['x', 'speed', 0.02]);
    const f = (v: typeof base) => sim(v).result[m.resultKey];
    expect(observedOutcome(f(base), f({ ...base, heightCm: 40 }), 0.02)).toBe('increase');
    expect(observedOutcome(f(base), f({ ...base, heightCm: 10 }), 0.02)).toBe('decrease');
    expect(observedOutcome(f(base), f({ ...base, floor: 'towel' }), 0.02)).toBe('decrease');
    expect(observedOutcome(f(base), f({ ...base, load: 2 }), 0.02)).toBe('same');
  });
});

describe('눈으로 보기', () => {
  it('아래 문구: "{t}초 · 출발선에서 {x} m", 1 m를 지나면 "1 m까지 {timeS}초"를 덧붙인다', () => {
    expect(rampNote({ t: 0.3, x: 0.7312 }, base, experiment)).toBe('0.3초 · 출발선에서 0.73 m');
    expect(rampNote({ t: 0.6, x: 1.2 }, base, experiment)).toBe('0.6초 · 출발선에서 1.20 m · 1 m까지 0.55초');
    expect(passed1m(0.54, base)).toBe(false);
    expect(passed1m(arrivalS({ heightCm: 20, floor: 'wood' }), base)).toBe(true);
    expect(macro(base, last(base))).toContain('1.2초 · 출발선에서 1.50 m · 1 m까지 0.55초');
    expect(macro(base, at(base, 0.3))).not.toContain('1 m까지');
  });

  it('실험 전에는 결과(걸린 시간·속력)를 보여 주지 않는다', () => {
    const html = macro(base, null, false);
    expect(html).not.toMatch(/0\.55|1\.82|1 m까지|초 ·/);
    expect(count(html, 'ghost')).toBe(0);
    expect(html).toContain('data-on-ramp="true"');
    expect(html).toContain('수레를 20 cm 높이에서 놓아요');
  });

  it('경사면 높이 숫자, 0·0.5·1·1.5 m 눈금, 출발선·도착 깃발·멈춤 벽이 있다', () => {
    for (const h of [10, 20, 40]) {
      const html = macro({ ...base, heightCm: h }, at(base, 0.3));
      expect(html).toContain(`>${h} cm<`);
      expect(html).toContain(`data-height="${h}"`);
    }
    const html = macro(base, at(base, 0.3));
    expect(count(html, 'ramp-tick')).toBe(4);
    for (const label of ['0', '0.5', '1', '1.5', 'm']) expect(html).toContain(`>${label}<`);
    expect(html).toContain('>출발선<');
    expect(html).toContain('>도착<');
    expect(html).toContain('>멈춤 벽<');
    expect(html).toContain('>느린 화면<');
    expect(count(html, 'finish-flag')).toBe(1);
    expect(count(html, 'wall')).toBe(1);
    expect(html).not.toMatch(/배/);
  });

  it('수레는 바닥 위에 그린다: 바닥 윗면(FLOOR_Y)에서 x에 맞춰 놓이고 벽(1.5 m)을 넘지 않는다', () => {
    for (const v of [base, { ...base, heightCm: 40 }, { ...base, floor: 'towel' }]) {
      for (const s of sim(v).samples.filter((_, i) => i % 10 === 0)) {
        const html = macro(v, s);
        const m = /data-testid="cart-pos" data-x="([\d.]+)" transform="translate\(([\d.]+) (\d+)\)"/.exec(html)!;
        expect(Number(m[3])).toBe(FLOOR_Y);
        // 수레 앞 끝 = 위치 x. 1.5 m 벽 앞면을 넘지 않는다.
        expect(Number(m[2]) + 13).toBeCloseTo(xOf(s.x), 2);
        expect(Number(m[2]) + 13).toBeLessThanOrEqual(xOf(1.5) + 1e-6);
      }
    }
    expect(X0 + 1.5 * PX_PER_M).toBe(xOf(1.5));
  });

  it('추 2개이면 추를 둘 그리고, 없으면 그리지 않는다', () => {
    expect(count(macro({ ...base, load: 2 }, at(base, 0.3)), 'cart-weight')).toBe(2);
    expect(count(macro(base, at(base, 0.3)), 'cart-weight')).toBe(0);
    expect(macro({ ...base, load: 2 }, null, false)).toContain('data-load="2"');
  });

  it('바닥: 나무 판(가로 결)과 수건(세로 줄무늬·술)은 색 말고도 다르다', () => {
    const wood = macro(base, at(base, 0.3));
    const towel = macro({ ...base, floor: 'towel' }, at(base, 0.3));
    expect(wood).toContain('data-floor="wood"');
    expect(towel).toContain('data-floor="towel"');
    expect(wood).toContain('바닥: 나무 판');
    expect(towel).toContain('바닥: 수건을 깐 바닥');
    expect(wood).toContain('<ellipse');
    expect(towel).not.toContain('<ellipse');
    expect(towel.match(/<line /g)!.length).toBeGreaterThan(wood.match(/<line /g)!.length + 20);
  });

  it('잔상 점은 0.1초마다 수레 뒤에 남고, 수레보다 앞에 있지 않으며, 빠를수록 간격이 넓다', () => {
    const gap = (v: typeof base) => {
      const html = macro(v, at(v, 0.4));
      const xs = [...html.matchAll(/data-testid="ghost" cx="([\d.]+)"/g)].map((m) => Number(m[1]));
      return { xs, cart: Number(/data-testid="cart-pos" data-x="([\d.]+)"/.exec(html)![1]) };
    };
    const slow = gap({ ...base, heightCm: 10 });
    const fast = gap({ ...base, heightCm: 40 });
    expect(slow.xs.length).toBeGreaterThanOrEqual(3);
    for (const xs of [slow.xs, fast.xs]) for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(fast.xs[1]! - fast.xs[0]!).toBeGreaterThan(slow.xs[1]! - slow.xs[0]!);
    expect(count(macro(base, null, false), 'ghost')).toBe(0);
    // 벽 앞에 멈춘 뒤에는 같은 자리에 점을 쌓지 않는다
    const end = [...macro({ ...base, heightCm: 40 }, last({ ...base, heightCm: 40 })).matchAll(/data-testid="ghost" cx="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(new Set(end).size).toBe(end.length);
  });

  it('SVG 글자는 모두 13 이상이다', () => {
    for (const html of [macro(base, at(base, 0.3)), macro(base, null, false), calc(base, last(base)), calc(base, null, false)]) {
      const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(0);
      for (const px of sizes) expect(px).toBeGreaterThanOrEqual(14);
    }
  });
});

describe('속력 계산해 보기', () => {
  it('1 m에 닿기 전에는 "걸린 시간 ?"이고 나눗셈 식이 없다', () => {
    const html = calc(base, at(base, 0.3));
    expect(html).toContain('걸린 시간 ?');
    expect(html).toContain('이동 거리 1 m');
    expect(html).not.toContain('data-testid="division"');
    // 글자로 보이는 부분에는 결과 숫자가 없다(빠르기 막대의 data-v는 그 순간 빠르기)
    expect(html.replace(/<[^>]*>/g, ' ')).not.toMatch(/0\.55|1\.82/);
  });

  it('1 m에 닿은 뒤에는 "걸린 시간 {timeS}초"와 "1 ÷ {timeS} = {speed} (m/s)"', () => {
    const html = calc(base, last(base));
    expect(html).toContain('걸린 시간 0.55초');
    expect(html).toMatch(/1 ÷ (<!-- -->)?0\.55(<!-- -->)? = (<!-- -->)?1\.82(<!-- -->)? \(m\/s\)/);
    expect(html).not.toContain('걸린 시간 ?');
    const towel = calc({ ...base, floor: 'towel' }, last({ ...base, floor: 'towel' }));
    expect(towel).toMatch(/1\.69/);
  });

  it('식은 도착 시각(0.5481초)에 나타난다', () => {
    expect(calc(base, at(base, 0.54))).not.toContain('data-testid="division"');
    expect(calc(base, at(base, 0.55))).toContain('data-testid="division"');
  });

  it('실험 전에는 아무 결과도 없다: 걸린 시간 ?, 식 없음, 빠르기 막대 0', () => {
    const html = calc(base, null, false);
    expect(html).toContain('걸린 시간 ?');
    expect(html).not.toContain('data-testid="division"');
    expect(html).not.toMatch(/0\.55|1\.82/);
    expect(html).toContain('data-v="0.00"');
    expect(html).toContain('지금 빠르기');
  });

  it('지금 빠르기 막대는 그 순간의 v를 따른다', () => {
    const early = at(base, 0.1);
    const late = at(base, 1.1);
    const w = (html: string) => Number(/data-testid="speed-bar" data-v="[\d.]+" x="8" y="140" width="([\d.]+)"/.exec(html)![1]);
    expect(w(calc(base, early))).toBeGreaterThan(w(calc(base, late)));
  });
});

describe('그래프', () => {
  const render = (v: typeof base) =>
    renderToStaticMarkup(
      createElement(GraphView, { module: rampCartModule, experiment, trial: trialOf(v), prev: undefined, playhead: 0, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }),
    );

  it('y축 0·0.5·1·1.5, x축 0.0~1.2(소수 한 자리), "1 m 도착" 표식 하나, 모든 조건에서 축이 같다', () => {
    for (const heightCm of [10, 20, 40]) {
      for (const floor of ['wood', 'towel']) {
        const html = render({ heightCm, floor, load: 0 });
        expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]).filter((t) => t !== '1 m 도착')).toEqual(['0', '0.5', '1', '1.5']);
        const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">([\d.]+)<\/text>/g)].filter((m) => Number(m[2]) > 200).map((m) => m[3]);
        expect(xTicks).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0', '1.2']);
        expect(html.match(/<g data-testid="graph-marker">/g)).toHaveLength(1);
        expect(html).toContain('1 m 도착');
        expect(html).toContain('출발선에서의 거리(m)');
      }
    }
  });

  it('y = x 의 최댓값은 마지막에 있다 (max-is-first-or-last 가드를 통과한다)', () => {
    for (const heightCm of [10, 20, 40]) {
      for (const floor of ['wood', 'towel']) {
        const s = sim({ heightCm, floor, load: 0 }).samples;
        expect(Math.max(...s.map((p) => p.x))).toBe(s[s.length - 1]!.x);
      }
    }
  });

  it('1 m 도착 표식 선은 y = 1 m 에서 곡선과 만난다 (표식 x 위치가 도착 시각과 같다)', () => {
    const html = render(base);
    const x1 = Number(/data-testid="graph-marker"><line x1="([\d.]+)"/.exec(html)![1]);
    expect(x1).toBeCloseTo(44 + (arrivalS({ heightCm: 20, floor: 'wood' }) / 1.2) * (320 - 44 - 12), 0);
  });
});

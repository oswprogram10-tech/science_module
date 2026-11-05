import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulateMagnet, type MagnetSample } from '@sci/engine-physics';
import type { Trial } from '@sci/runtime';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { magnetDistanceModule } from './index';
import { magnetNote } from './initial';
import { ClipMacroView, PILE_TOP, PX_PER_CM, SHEET_T, TABLE_Y, clipsPerRow, heldLayout } from './ClipMacroView';
import { ClipReachView, extentPx, patternDots } from './ClipReachView';

const unit = UNITS.find((u) => u.id === 'g4-magnet')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-magnet이 없어요');
const experiment = unit.experiment;
const base = { gapCm: 0.5, magnets: 1, between: 'none' };
const sim = (v: typeof base) => simulateMagnet(v as never);
const last = (v: typeof base): MagnetSample => sim(v).samples.at(-1)!;
const at = (v: typeof base, t: number): MagnetSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;

const trialOf = (v: typeof base) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: typeof base, snapshot: MagnetSample | null, ran = true) =>
  renderToStaticMarkup(createElement(ClipMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const reach = (v: typeof base, snapshot: MagnetSample | null, ran = true) =>
  renderToStaticMarkup(createElement(ClipReachView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const num = (html: string, re: RegExp) => Number(re.exec(html)![1]);

describe('레지스트리', () => {
  it('g4-magnet은 magnet-distance 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(4);
    expect(unit.module).toBe(magnetDistanceModule);
    expect(MODULES['magnet-distance'].kind).toBe('magnet-distance');
    expect(experiment.safety).toEqual(['magnet']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 8줄', () => {
    const cols = magnetDistanceModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['끌려온 클립의 수(개)']);
    const row = (gapCm: number, magnets: number, between = 'none') => cols[0]!.value(sim({ gapCm, magnets, between }).result);
    expect([0, 0.5, 1, 2].map((g) => row(g, 1))).toEqual(['12', '5', '2', '0']);
    expect([0, 0.5, 1, 2].map((g) => row(g, 2))).toEqual(['19', '8', '4', '1']);
    expect([0, 0.5, 1, 2].map((g) => row(g, 2, 'iron'))).toEqual(['0', '0', '0', '0']);
  });

  it('센서: 가상 거리 센서(distance)는 자석 높이(cm), 시행 전에는 5 cm', () => {
    const [none] = magnetDistanceModule.sensors(null, base);
    expect([none!.kind, none!.unit, none!.label, none!.source]).toEqual(['distance', 'cm', '가상 거리 센서', 5]);
    expect(magnetDistanceModule.sensors(at(base, 3), base)[0]!.source).toBeCloseTo(0.5, 9);
  });

  it('그래프 설정: 정수 눈금, y 0부터, x 0~6초, 표식 3초·4초', () => {
    const g = magnetDistanceModule.graph;
    expect([g.yLabel, g.yMin, g.integerTicks, g.xLabel, g.xTicks, g.series, g.yTicks]).toEqual(['붙은 클립의 수(개)', 0, true, '시간(초)', [0, 1, 2, 3, 4, 5, 6], undefined, [0, 5, 10, 15, 20, 25]]);
    expect(g.markers).toEqual([{ t: 3, label: '가장 가까이' }, { t: 4, label: '들어 올리기' }]);
    expect(magnetDistanceModule.restPlayhead).toBe(6);
  });

  it('예측 비교는 clips, 기준 0: 1개 차이도 늘었다·줄었다, 종이로 바꾸면 변하지 않았다', () => {
    const m = magnetDistanceModule.metric;
    expect([m.sampleKey, m.resultKey, m.sameThreshold(experiment)]).toEqual(['clipsHeld', 'clips', 0]);
    const f = (v: typeof base) => sim(v).result[m.resultKey];
    expect(observedOutcome(f(base), f({ ...base, gapCm: 2 }), 0)).toBe('decrease');
    expect(observedOutcome(f(base), f({ ...base, gapCm: 0 }), 0)).toBe('increase');
    expect(observedOutcome(f(base), f({ ...base, between: 'paper' }), 0)).toBe('same');
    expect(observedOutcome(f(base), f({ ...base, between: 'plastic' }), 0)).toBe('same');
    expect(observedOutcome(f(base), f({ ...base, between: 'iron' }), 0)).toBe('decrease');
  });
});

describe('눈으로 보기', () => {
  it('아래 문구: "{t}초 · 자석 높이 {h} cm · 붙은 클립 {n}개"', () => {
    expect(magnetNote({ t: 3, heightCm: 0.5, clipsHeld: 5 })).toBe('3.0초 · 자석 높이 0.5 cm · 붙은 클립 5개');
    expect(macro(base, last(base))).toContain('6.0초 · 자석 높이 5.0 cm · 붙은 클립 5개');
    expect(macro({ ...base, gapCm: 0, magnets: 2 }, at({ ...base, gapCm: 0, magnets: 2 }, 3))).toContain('3.0초 · 자석 높이 0.0 cm · 붙은 클립 19개');
  });

  it('실험 전에는 답(붙은 클립 수)을 보여 주지 않는다', () => {
    const html = macro(base, null, false);
    expect(html).toContain('data-count="0"');
    expect(html).not.toMatch(/붙은 클립 \d/);
    expect(html).not.toMatch(/data-count="[1-9]/);
    expect(html).toContain('거리 5.0 cm');
  });

  it('N과 S 글자, 스탠드, 자(0~5 cm 눈금), 거리 치수선이 있다', () => {
    const html = macro(base, last(base));
    expect(html).toContain('>N<');
    expect(html).toContain('>S<');
    expect(html).toContain('fill="#ffffff"');
    for (const c of ['0', '1', '2', '3', '4', '5']) expect(html).toContain(`fill="#1d2733">${c}<`);
    expect(count(html, 'ruler')).toBe(1);
    expect(count(html, 'dimension')).toBe(1);
    expect(count(html, 'thread')).toBe(1);
    expect(html).toContain('>클립<');
  });

  it('자석 2개는 겹쳐 그리고, 1개는 하나만 그린다', () => {
    expect(count(macro(base, last(base)), 'bar-magnet')).toBe(1);
    expect(count(macro({ ...base, magnets: 2 }, last(base)), 'bar-magnet')).toBe(2);
  });

  it('붙은 클립 개수만큼 그린다: 표의 값과 같고 단조 증가', () => {
    for (const [m, g, n] of [[1, 0, 12], [1, 0.5, 5], [2, 0, 19], [2, 2, 1], [1, 2, 0]] as const) {
      const v = { gapCm: g, magnets: m, between: 'none' };
      const html = macro(v, last(v));
      expect(html).toContain(`data-count="${n}"`);
      const g0 = /data-testid="clips"[^>]*>([\s\S]*?)<\/g>/.exec(html)![1]!;
      expect((g0.match(/<rect/g) ?? []).length).toBe(n);
    }
  });

  it('사이 물체: 종이·플라스틱·철판은 이름표와 질감(패턴)이 다르고, 없음은 그리지 않는다', () => {
    expect(count(macro(base, last(base)), 'between')).toBe(0);
    for (const [b, label, pat] of [['paper', '종이', 'mg-paper'], ['plastic', '플라스틱 판', 'mg-plastic'], ['iron', '얇은 철판', 'mg-iron']] as const) {
      const html = macro({ ...base, between: b }, last({ ...base, between: b }));
      expect(count(html, 'between')).toBe(1);
      expect(html).toContain(`data-kind="${b}"`);
      expect(html).toContain(`>${label}<`);
      expect(html).toContain(`fill="url(#${pat})"`);
    }
  });

  it('붙은 클립은 맨 아래 면 아래에 매달린다: 사이 물체와 겹치지 않고, 허공에 뜨지 않고, 탁자를 뚫지 않는다', () => {
    for (const magnets of [1, 2] as const) {
      for (const n of magnets === 1 ? [1, 5, 8, 12] : [1, 5, 8, 12, 19]) {
        const lay = heldLayout(n, magnets);
        expect(lay).toHaveLength(n);
        // 첫 줄은 맨 아래 면(y = 0)에 닿고, 면 위로(음수 y) 올라가지 않는다
        expect(Math.min(...lay.map((p) => p.y))).toBeGreaterThanOrEqual(0);
        expect(Math.min(...lay.map((p) => p.y))).toBeLessThanOrEqual(1);
        // 둘째 줄부터는 앞 줄 바로 아래 걸려 있다(줄 간격 5 = 클립 높이 6보다 작아 맞닿음)
        const ys = [...new Set(lay.map((p) => p.y))].sort((a, b) => a - b);
        ys.slice(1).forEach((y, i) => expect(y - ys[i]!).toBeLessThanOrEqual(6));
        // 한 줄에 clipsPerRow개를 넘지 않는다
        expect(lay.filter((p) => p.y === ys[0]).length).toBeLessThanOrEqual(clipsPerRow(magnets));
        // 가장 아래 클립이 탁자 면 안에 있다(자석이 클립 더미에 닿았을 때도)
        expect(PILE_TOP + Math.max(...ys) + 6).toBeLessThanOrEqual(TABLE_Y);
      }
    }
  });

  it('맨 아래 면 위치: 자석 높이를 따라 움직이고, 사이 물체는 그 위(자석 쪽)에 있다', () => {
    const v = { ...base, gapCm: 0, between: 'iron' };
    const html = macro(v, at(v, 0));
    const sheetY = num(html, /data-testid="between"[^>]*><rect x="[\d.]+" y="([\d.-]+)"/);
    // 시작(5 cm): 철판 아래 면 = 더미 위 90
    expect(sheetY + SHEET_T.iron).toBeCloseTo(PILE_TOP - 5 * PX_PER_CM, 6);
    const html3 = macro(v, at(v, 3));
    expect(num(html3, /data-testid="between"[^>]*><rect x="[\d.]+" y="([\d.-]+)"/) + SHEET_T.iron).toBeCloseTo(PILE_TOP, 6);
  });

  it('철판이면 클립이 없다', () => {
    const v = { ...base, between: 'iron' };
    expect(macro(v, last(v))).toContain('data-count="0"');
    expect(macro(v, last(v))).toContain('붙은 클립 0개');
  });
});

describe('자석의 힘이 미치는 곳', () => {
  it('라벨(자석, 클립, 사이 물체 이름)과 설명 문구는 실험 뒤에만', () => {
    const html = reach(base, last(base));
    for (const t of ['>자석<', '>클립<', '>N<', '>S<']) expect(html).toContain(t);
    expect(html).toContain('자석의 힘은 자석에서 멀어질수록 약해져요.');
    expect(html).toContain('자석의 힘이 미치는 곳');
    for (const [b, label] of [['paper', '종이'], ['plastic', '플라스틱 판'], ['iron', '얇은 철판']] as const) expect(reach({ ...base, between: b }, last(base))).toContain(`>${label}<`);
    expect(reach({ ...base, magnets: 2 }, last(base))).toContain('>자석 2개<');
  });

  it('실험 전에는 점 무늬도 설명 문구도 없다 (답을 미리 보여 주지 않음)', () => {
    const html = reach(base, null, false);
    expect(html).toContain('data-count="0"');
    expect(html).not.toContain('멀어질수록');
    expect(html).toContain('실험하면 자석의 힘이 미치는 곳이 나타나요.');
    expect(count(html, 'pile-marker')).toBe(1);
  });

  it('무늬가 퍼진 정도는 reach에 비례한다 (자석 2개는 1개의 1.6배)', () => {
    expect(extentPx(1.6) / extentPx(1)).toBeCloseTo(1.6, 9);
    const depth = (reachV: number) => Math.max(...patternDots(reachV, 'none').map((d) => d.y));
    expect(depth(1.6) / depth(1)).toBeGreaterThan(1.55);
    expect(depth(1.6) / depth(1)).toBeLessThan(1.65);
    const two = { ...base, magnets: 2 };
    expect(num(reach(two, last(two)), /data-extent="([\d.]+)"/) / num(reach(base, last(base)), /data-extent="([\d.]+)"/)).toBeCloseTo(1.6, 1);
  });

  it('클립 더미 위치 표시는 거리에 따라 멀어진다', () => {
    const y = (g: number) => num(reach({ ...base, gapCm: g }, last(base)), /data-testid="pile-marker" data-y="([\d.]+)"/);
    expect(y(2) - y(0)).toBeCloseTo(72, 6);
    expect(y(0.5)).toBeLessThan(y(1));
  });

  it('철판이면 무늬가 철판 안에 모이고 아래로는 거의 없다', () => {
    const dots = patternDots(0, 'iron');
    const inside = dots.filter((d) => d.y <= 0);
    const below = dots.filter((d) => d.y > 0);
    expect(inside.length).toBeGreaterThanOrEqual(16);
    expect(below.length).toBeLessThanOrEqual(3);
    expect(Math.max(...below.map((d) => d.y))).toBeLessThan(8);
    // 철판 안의 점은 철판 두께(10) 안에 있다
    for (const d of inside) expect(d.y).toBeGreaterThanOrEqual(-10);
    const iron = reach({ ...base, between: 'iron' }, last({ ...base, between: 'iron' }));
    expect(num(iron, /data-extent="([\d.]+)"/)).toBe(0);
  });

  it('종이·플라스틱은 없음과 같은 무늬 (reach 같음)', () => {
    expect(patternDots(1, 'paper')).toEqual(patternDots(1, 'none'));
  });
});

describe('그래프', () => {
  const trial = (v: typeof base): Trial<MagnetSample, never> => ({ id: 't', index: 1, values: v, ivKey: null, prediction: null, samples: sim(v).samples, result: sim(v).result, analysis: { kind: 'first-trial', changed: [] } }) as never;
  const html = (v: typeof base) =>
    renderToStaticMarkup(createElement(GraphView, { module: magnetDistanceModule as never, experiment, trial: trial(v), prev: undefined, playhead: 0, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));

  it('x축 0~6초, y축 정수 눈금, 표식 3초·4초 라벨', () => {
    const h = html(base);
    expect(h).toContain('붙은 클립의 수(개)');
    expect(h).toContain('시간(초)');
    expect(h).toContain('가장 가까이');
    expect(h).toContain('들어 올리기');
    const xTicks = [...h.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">([\d.]+)<\/text>/g)].filter((m) => Number(m[2]) > 100).map((m) => m[3]);
    expect(xTicks).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    const yTicks = [...h.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]!);
    const yNums = yTicks.filter((t) => /^[\d.]+$/.test(t));
    expect(yNums[0]).toBe('0');
    expect(yNums.every((t) => Number.isInteger(Number(t)))).toBe(true);
  });
});

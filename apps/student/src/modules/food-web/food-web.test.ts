import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateFoodWeb, type FoodWebSample } from '@sci/engine-life';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { foodWebModule } from './index';
import { foodWebNote } from './initial';
import { FieldMacroView, drawn, grassColor, tuftCount } from './FieldMacroView';
import { FoodWebMicroView, boxSize } from './FoodWebMicroView';

const unit = UNITS.find((u) => u.id === 'g4-ecosystem')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-ecosystem이 없어요');
const experiment = unit.experiment;
const base = { rabbits0: 10, foxes0: 2, rain: 'normal', furColor: 'white' };
type V = typeof base;
const sim = (v: V) => simulateFoodWeb(v as never);
const at = (v: V, t: number): FoodWebSample => sim(v).samples.find((s) => s.t === t)!;
const sample = (grassPct: number, rabbits: number, foxes: number, t = 5): FoodWebSample => ({ t, grassPct, rabbits, foxes });

const macro = (values: V, snapshot: FoodWebSample | null) =>
  renderToStaticMarkup(createElement(FieldMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const micro = (values: V, snapshot: FoodWebSample | null) =>
  renderToStaticMarkup(createElement(FoodWebMicroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g4-ecosystem은 food-web 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(4);
    expect(unit.module).toBe(foodWebModule);
    expect(MODULES['food-web'].kind).toBe('food-web');
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 기준 시행, 여우 0마리, 털 색 갈색', () => {
    const cols = foodWebModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['60일 뒤 풀(%)', '60일 뒤 토끼(마리)', '60일 뒤 여우(마리)', '가장 많았던 토끼(마리)']);
    expect(cols.map((c) => c.value(sim(base).result))).toEqual(['71', '6', '2', '10']);
    expect(cols.map((c) => c.value(sim({ ...base, foxes0: 0 }).result))).toEqual(['4', '6', '0', '22']);
    expect(cols.map((c) => c.value(sim({ ...base, furColor: 'brown' }).result))).toEqual(['71', '6', '2', '10']);
  });

  it('결과 열이 시행마다 같은 값으로 고정되지 않는다', () => {
    const cols = foodWebModule.resultColumns(experiment);
    const runs = [base, { ...base, foxes0: 0 }, { ...base, rain: 'high' }, { ...base, rabbits0: 20, foxes0: 4 }].map((v) => sim(v).result);
    for (const c of cols) expect(new Set(runs.map((r) => c.value(r))).size, c.label).toBeGreaterThan(1);
  });

  it('센서가 없다', () => {
    expect(foodWebModule.sensors(null, base)).toEqual([]);
    expect(foodWebModule.sensors(at(base, 30), base)).toEqual([]);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = foodWebModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks]).toEqual(['수(마리) / 풀의 양(%)', 0, [0, 20, 40, 60, 80, 100], '날짜(일)', [0, 10, 20, 30, 40, 50, 60]]);
    expect(g.series?.map((s) => [s.key, s.label])).toEqual([['grassPct', '풀의 양(%)'], ['rabbits', '토끼 수(마리)'], ['foxes', '여우 수(마리)']]);
    expect(new Set(g.series!.map((s) => s.color)).size).toBe(3);
    expect(new Set(g.series!.map((s) => s.dash ?? 'solid')).size).toBe(3);
    expect(foodWebModule.restPlayhead).toBe(60);
    expect(foodWebModule.metric).toMatchObject({ sampleKey: 'grassPct', resultKey: 'grassDay60' });
    expect(foodWebModule.metric.sameThreshold(experiment)).toBe(2);
  });
});

describe('눈으로 보기', () => {
  it('실험 전에는 0일째 풀 80%, 토끼 10마리, 여우 2마리', () => {
    expect(foodWebNote(at(base, 0))).toBe('0일째 · 풀 80% · 토끼 10마리 · 여우 2마리');
    const html = macro(base, null);
    expect(html).toContain('0일째 · 풀 80% · 토끼 10마리 · 여우 2마리');
    expect(count(html, 'rabbit')).toBe(10);
    expect(count(html, 'fox')).toBe(2);
  });

  it('60일째 문구는 반올림한 수를 쓴다', () => {
    expect(foodWebNote(at(base, 60))).toBe('60일째 · 풀 71% · 토끼 6마리 · 여우 2마리');
    expect(foodWebNote(sample(33.4, 2.5, 0.49, 12.4))).toBe('12일째 · 풀 33% · 토끼 3마리 · 여우 0마리');
  });

  it('풀 무더기 수와 색은 풀의 양에 비례한다', () => {
    expect([0, 25, 50, 80, 100].map(tuftCount)).toEqual([0, 6, 12, 19, 24]);
    expect(count(macro(base, sample(50, 5, 1)), 'tuft')).toBe(12);
    expect(count(macro(base, sample(0, 5, 1)), 'tuft')).toBe(0);
    // 많을수록 진하다(빨강 성분이 줄어든다)
    const red = (g: number) => Number(/rgb\((\d+),/.exec(grassColor(g))![1]);
    expect(red(0)).toBeGreaterThan(red(50));
    expect(red(50)).toBeGreaterThan(red(100));
  });

  it('토끼는 최대 30마리, 여우는 최대 10마리만 그리고 넘으면 +n을 붙인다', () => {
    expect(drawn(32, 30)).toEqual({ shown: 30, extra: 2 });
    expect(drawn(5, 30)).toEqual({ shown: 5, extra: 0 });
    const many = macro(base, sample(50, 33, 12));
    expect(count(many, 'rabbit')).toBe(30);
    expect(count(many, 'fox')).toBe(10);
    expect(many).toContain('토끼 +3');
    expect(many).toContain('여우 +2');
    const few = macro(base, sample(50, 29.6, 0));
    expect(count(few, 'rabbit')).toBe(30);
    expect(few).not.toContain('토끼 +');
    expect(count(few, 'rabbits-extra')).toBe(0);
  });

  it('비는 구름과 빗줄기 개수, 글자 라벨로 보여 준다', () => {
    const counts = (rain: string) => {
      const html = macro({ ...base, rain }, null);
      return [count(html, 'cloud'), count(html, 'rain-line'), html.includes(`비 ${{ low: '적게', normal: '보통', high: '많이' }[rain]}`)];
    };
    expect(counts('low')).toEqual([1, 3, true]);
    expect(counts('normal')).toEqual([2, 6, true]);
    expect(counts('high')).toEqual([3, 10, true]);
  });

  it('토끼 털 색을 그림과 글자에 반영한다', () => {
    const white = macro({ ...base, furColor: 'white' }, null);
    const brown = macro({ ...base, furColor: 'brown' }, null);
    expect(white).toContain('data-fur="white"');
    expect(white).toContain('토끼 털 색: 흰색');
    expect(brown).toContain('data-fur="brown"');
    expect(brown).toContain('토끼 털 색: 갈색');
    expect(white).not.toBe(brown);
  });

  it('여우가 0마리이면 "여우가 없어요"를 쓴다', () => {
    expect(macro({ ...base, foxes0: 0 }, sample(80, 10, 0))).toContain('여우가 없어요');
    expect(macro(base, null)).not.toContain('여우가 없어요');
  });
});

describe('먹이 그물로 보기', () => {
  it('칸 크기는 수에 비례하되 최소·최대로 제한된다', () => {
    const a = boxSize(0, 30);
    const b = boxSize(15, 30);
    const c = boxSize(30, 30);
    const d = boxSize(99, 30);
    expect(a.w).toBeLessThan(b.w);
    expect(b.w).toBeLessThan(c.w);
    expect(d).toEqual(c);
    expect(a).toEqual(boxSize(-5, 30));
    expect(b.w).toBeCloseTo((a.w + c.w) / 2, 9);
  });

  it('칸마다 현재 수를 쓰고 화살표와 안내 문구가 있다', () => {
    const html = micro(base, sample(71.4, 5.6, 2.2));
    expect(html).toContain('>71%<');
    expect(html).toContain('>6마리<');
    expect(html).toContain('>2마리<');
    expect(html).toContain('>먹힘<');
    expect(count(html, 'arrow')).toBe(4);
    expect(html).toContain('비생물 요소');
    expect(html).toContain('>해<');
    expect(html).toContain('비 보통');
    expect(html).toContain('화살표는 먹고 먹히는 관계를 나타내요.');
    expect(html).toContain('data-empty="false"');
  });

  it('여우가 0이면 여우 칸을 점선으로 그리고 "없음"이라고 쓴다', () => {
    const html = micro({ ...base, foxes0: 0 }, sample(80, 10, 0.2));
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('>없음<');
    expect(html).not.toContain('>0마리<');
  });

  it('칸 크기가 수에 따라 커진다', () => {
    const w = (html: string, id: string) => Number(new RegExp(`data-testid="${id}"[^>]*data-w="([\\d.]+)"`).exec(html)![1]);
    const small = micro(base, sample(10, 2, 1));
    const big = micro(base, sample(90, 25, 8));
    for (const id of ['grass-box', 'rabbit-box', 'fox-box']) expect(w(big, id), id).toBeGreaterThan(w(small, id));
  });

  it('비가 많을수록 비 화살표가 굵다', () => {
    const width = (rain: string) => Number(/data-testid="rain-arrow" data-width="([\d.]+)"/.exec(micro({ ...base, rain }, null))![1]);
    expect(width('low')).toBeLessThan(width('normal'));
    expect(width('normal')).toBeLessThan(width('high'));
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateGermination, type GerminationSample } from '@sci/engine-life';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { germinationModule } from './index';
import { seedStage, tempPlace } from './initial';
import { GerminationMacroView, germinationNote } from './GerminationMacroView';
import { SeedMicroView } from './SeedMicroView';

const unit = UNITS.find((u) => u.id === 'g3-lifecycle')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g3-lifecycle이 없어요');
const experiment = unit.experiment;
const base = { water: 'water', tempC: 20, light: 'bright' };
const sim = (v: typeof base) => simulateGermination(v as never);
const at = (v: typeof base, t: number): GerminationSample => sim(v).samples.find((s) => s.t === t)!;

const macro = (values: typeof base, snapshot: GerminationSample | null) =>
  renderToStaticMarkup(createElement(GerminationMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const micro = (values: typeof base, snapshot: GerminationSample | null) =>
  renderToStaticMarkup(createElement(SeedMicroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g3-lifecycle은 germination 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(3);
    expect(unit.module).toBe(germinationModule);
    expect(MODULES.germination.kind).toBe('germination');
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 기준 시행과 물 없음, 어두운 곳', () => {
    const cols = germinationModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['7일째 싹 튼 씨앗 수(개)', '처음 싹 튼 날(일)', '떡잎 색']);
    expect(cols.map((c) => c.value(sim(base).result))).toEqual(['9', '1.8', '초록색']);
    expect(cols.map((c) => c.value(sim({ ...base, light: 'dark' }).result))).toEqual(['9', '1.8', '노란색']);
    expect(cols.map((c) => c.value(sim({ ...base, water: 'none' }).result))).toEqual(['0', '–', '–']);
    expect(cols.map((c) => c.value(sim({ ...base, tempC: 30 }).result))).toEqual(['9', '1.1', '초록색']);
  });

  it('결과 열이 시행마다 같은 값으로 고정되지 않는다', () => {
    const cols = germinationModule.resultColumns(experiment);
    const runs = [base, { ...base, water: 'none' }, { ...base, tempC: 30 }, { ...base, light: 'dark' }].map((v) => sim(v).result);
    for (const c of cols) expect(new Set(runs.map((r) => c.value(r))).size, c.label).toBeGreaterThan(1);
  });

  it('센서: 온도계는 고른 온도, 빛 센서는 밝은 곳 80 %, 어두운 곳 2 %', () => {
    const [t, l] = germinationModule.sensors(null, base);
    expect([t!.kind, t!.unit, t!.label, t!.source]).toEqual(['temperature', '°C', '가상 온도계', 20]);
    expect([l!.kind, l!.unit, l!.label, l!.source]).toEqual(['light', '%', '가상 빛 센서', 80]);
    const dark = germinationModule.sensors(null, { ...base, tempC: 5, light: 'dark' });
    expect([dark[0]!.source, dark[1]!.source]).toEqual([5, 2]);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = germinationModule.graph;
    expect([g.yLabel, g.yMin, g.integerTicks, g.xLabel, g.xTicks]).toEqual(['싹 튼 씨앗 수(개)', 0, true, '날짜(일)', [0, 2, 4, 6, 8, 10]]);
    expect(g.markers).toEqual([{ t: 7, label: '7일째' }]);
    expect(germinationModule.restPlayhead).toBe(7);
    expect(germinationModule.metric.sameThreshold(experiment)).toBe(0.5);
  });
});

describe('눈으로 보기', () => {
  it('실험 전에는 0일째, 7일째에는 9개가 싹 터 있다', () => {
    const before = macro(base, null);
    expect(before).toContain('0일째 · 싹 튼 씨앗 0개');
    expect(count(before, 'seed')).toBe(10);
    expect(count(before, 'sprout')).toBe(0);
    const day7 = macro(base, at(base, 7));
    expect(day7).toContain('7일째 · 싹 튼 씨앗 9개');
    expect(count(day7, 'sprout')).toBe(9);
    expect(count(day7, 'seed')).toBe(1);
    expect(germinationNote({ t: 3.45, sprouted: 2.6, greenness: 1, stemMm: 5 })).toBe('3.5일째 · 싹 튼 씨앗 3개');
  });

  it('줄기 길이는 stemMm에 비례하고 어두우면 더 길다', () => {
    const len = (html: string) => {
      const m = /data-testid="stem" x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/.exec(html)!;
      return Number(m[1]) - Number(m[2]);
    };
    const bright = len(macro(base, at(base, 7)));
    const dark = len(macro({ ...base, light: 'dark' }, at({ ...base, light: 'dark' }, 7)));
    expect(bright).toBeCloseTo(at(base, 7).stemMm, 6);
    expect(dark).toBeGreaterThan(bright);
  });

  it('어두운 곳: 상자를 덮음 라벨과 노란 떡잎, 밝은 곳에는 상자가 없다', () => {
    const d = { ...base, light: 'dark' };
    const html = macro(d, at(d, 7));
    expect(html).toContain('상자를 덮음');
    expect(html).toContain('떡잎 노란색');
    expect(html).toContain('#e5c100');
    const b = macro(base, at(base, 7));
    expect(b).not.toContain('상자를 덮음');
    expect(b).toContain('떡잎 초록색');
  });

  it('물 줌/안 줌은 솜과 글자로, 온도는 테두리와 글자로 보인다', () => {
    expect(macro(base, null)).toContain('젖은 솜');
    expect(macro({ ...base, water: 'none' }, null)).toContain('마른 솜');
    expect(macro({ ...base, tempC: 5 }, null)).toContain('냉장고 5 °C');
    expect(macro({ ...base, tempC: 5 }, null)).toContain('data-place="cold"');
    expect(macro({ ...base, tempC: 30 }, null)).toContain('따뜻한 곳 30 °C');
    expect(macro(base, null)).toContain('실온 20 °C');
    expect([5, 20, 30].map(tempPlace)).toEqual(['cold', 'room', 'warm']);
  });

  it('싹이 안 튼 조건(물 없음)은 7일째에도 싹이 없다', () => {
    const v = { ...base, water: 'none' };
    const html = macro(v, at(v, 7));
    expect(count(html, 'sprout')).toBe(0);
    expect(html).toContain('7일째 · 싹 튼 씨앗 0개');
  });
});

describe('씨 하나 확대해 보기', () => {
  it('단계: 싹 안 트면 씨, 기준 시행은 시간에 따라 뿌리 → 떡잎 → 본잎', () => {
    expect(seedStage(at(base, 0), 'bright')).toBe(0);
    expect(seedStage(at({ ...base, water: 'none' }, 10), 'bright')).toBe(0);
    expect(seedStage(at(base, 1.8), 'bright')).toBe(0);
    expect(seedStage(at(base, 2.0), 'bright')).toBe(1);
    expect(seedStage(at(base, 3.5), 'bright')).toBe(2);
    expect(seedStage(at(base, 7), 'bright')).toBe(3);
    // 어두우면 줄기가 빨리 자라 단계가 더 빨리 넘어간다.
    const d = { ...base, light: 'dark' };
    expect(seedStage(at(d, 3), 'dark')).toBeGreaterThanOrEqual(seedStage(at(base, 3), 'bright'));
  });

  it('네 단계 이름이 글자로 있고 현재 단계가 표시되며 떡잎 색을 반영한다', () => {
    const html = micro(base, at(base, 7));
    for (const w of ['① 씨', '② 뿌리가 나옴', '③ 떡잎이 나옴', '④ 본잎']) expect(html).toContain(w);
    expect(html).toContain('지금 단계: 본잎');
    expect(html).toContain('떡잎 색: 초록색');
    expect((html.match(/data-current="true"/g) ?? []).length).toBe(1);
    expect(micro({ ...base, light: 'dark' }, at({ ...base, light: 'dark' }, 7))).toContain('떡잎 색: 노란색');
    const none = micro({ ...base, water: 'none' }, null);
    expect(none).toContain('지금 단계: 씨');
    expect(none).toContain('떡잎 색: 아직 없어요');
  });
});

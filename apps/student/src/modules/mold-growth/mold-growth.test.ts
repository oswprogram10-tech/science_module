import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateMold, type MoldSample } from '@sci/engine-life';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { moldGrowthModule } from './index';
import { moldColor } from './initial';
import { MAGNIFICATIONS, MoldMicroView, buildHyphae, sporeCount } from './MoldMicroView';
import { MoldMacroView, SPOT_COUNT, moldNote, spotCount } from './MoldMacroView';

const unit = UNITS.find((u) => u.id === 'g4-microbe')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-microbe가 없어요');
const experiment = unit.experiment;
const base = { moisture: 'wet', tempC: 20, light: 'bright' };
const sim = (v: typeof base) => simulateMold(v as never);
const at = (v: typeof base, t: number): MoldSample => sim(v).samples.find((s) => s.t === t)!;

const macro = (values: typeof base, snapshot: MoldSample | null) =>
  renderToStaticMarkup(createElement(MoldMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const micro = (values: typeof base, snapshot: MoldSample | null) =>
  renderToStaticMarkup(createElement(MoldMicroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g4-microbe는 mold-growth 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(4);
    expect(unit.module).toBe(moldGrowthModule);
    expect(MODULES['mold-growth'].kind).toBe('mold-growth');
    expect(experiment.safety).toEqual(['microbe']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 사양 기준값 여섯 줄', () => {
    const cols = moldGrowthModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['7일째 곰팡이 넓이(%)', '10일째 넓이(%)', '처음 보인 날(일)']);
    const row = (moisture: string, tempC: number) => cols.map((c) => c.value(sim({ ...base, moisture, tempC }).result));
    expect(row('dry', 5)).toEqual(['0', '0', '–']);
    expect(row('dry', 20)).toEqual(['1', '2', '6.7']);
    expect(row('dry', 30)).toEqual(['2', '5', '5.1']);
    expect(row('wet', 5)).toEqual(['0', '2', '8.0']);
    expect(row('wet', 20)).toEqual(['48', '93', '2.0']);
    expect(row('wet', 30)).toEqual(['86', '100', '1.5']);
  });

  it('센서: 온도계는 고른 온도, 습도 센서는 마른 빵 40 %, 물을 뿌린 빵 90 %', () => {
    const [t, h] = moldGrowthModule.sensors(null, base);
    expect([t!.kind, t!.unit, t!.label, t!.source]).toEqual(['temperature', '°C', '가상 온도계', 20]);
    expect([h!.kind, h!.unit, h!.label, h!.source]).toEqual(['humidity', '%', '가상 습도 센서: 봉지 안', 90]);
    const dry = moldGrowthModule.sensors(null, { ...base, tempC: 5, moisture: 'dry' });
    expect([dry[0]!.source, dry[1]!.source]).toEqual([5, 40]);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = moldGrowthModule.graph;
    expect([g.yLabel, g.yMin, g.xLabel, g.xTicks]).toEqual(['곰팡이가 덮은 넓이(%)', 0, '날짜(일)', [0, 2, 4, 6, 8, 10]]);
    expect(g.markers).toEqual([{ t: 7, label: '7일째' }]);
    expect(moldGrowthModule.restPlayhead).toBe(7);
    expect(moldGrowthModule.metric).toMatchObject({ sampleKey: 'coverPct', resultKey: 'cover7' });
    expect(moldGrowthModule.metric.sameThreshold(experiment)).toBe(2);
  });
});

describe('눈으로 보기', () => {
  it('아래 문구와 얼룩 수: 0일째는 없고 7일째 48 %는 그에 맞는 수', () => {
    expect(moldNote({ t: 7, coverPct: 47.6, spores: 0.3 })).toBe('7일째 · 곰팡이가 덮은 넓이 48%');
    const before = macro(base, null);
    expect(before).toContain('0일째 · 곰팡이가 덮은 넓이 0%');
    expect(count(before, 'mold-spot')).toBe(0);
    const day7 = macro(base, at(base, 7));
    expect(day7).toContain('7일째 · 곰팡이가 덮은 넓이 48%');
    expect(count(day7, 'mold-spot')).toBe(spotCount(at(base, 7).coverPct));
    expect(spotCount(0)).toBe(0);
    expect(spotCount(0.3)).toBe(1);
    expect(spotCount(100)).toBe(SPOT_COUNT);
  });

  it('얼룩 수는 덮은 넓이가 늘수록 늘고, 같은 입력은 같은 그림이다', () => {
    const n = [2, 4, 6, 8, 10].map((t) => count(macro(base, at(base, t)), 'mold-spot'));
    expect(n).toEqual([...n].sort((a, b) => a - b));
    expect(n[n.length - 1]).toBeGreaterThan(n[0]!);
    expect(macro(base, at(base, 7))).toBe(macro(base, at(base, 7)));
  });

  it('포자가 많을수록 얼룩 색이 짙어진다', () => {
    const channel = (c: string) => Number(/rgb\((\d+)/.exec(c)![1]);
    expect(channel(moldColor(1))).toBeLessThan(channel(moldColor(0)));
    expect(moldColor(0)).not.toBe(moldColor(1));
  });

  it('물을 뿌린 빵은 물방울과 글자 라벨, 마른 빵은 물방울이 없다', () => {
    const wet = macro(base, null);
    expect(count(wet, 'drop')).toBeGreaterThan(0);
    expect(wet).toContain('물을 뿌린 빵');
    const dry = macro({ ...base, moisture: 'dry' }, null);
    expect(count(dry, 'drop')).toBe(0);
    expect(dry).toContain('마른 빵');
  });

  it('온도는 테두리와 글자로, 빛은 표시와 글자로 보인다', () => {
    expect(macro({ ...base, tempC: 5 }, null)).toContain('냉장고 5 °C');
    expect(macro({ ...base, tempC: 5 }, null)).toContain('data-place="cold"');
    expect(macro({ ...base, tempC: 30 }, null)).toContain('따뜻한 곳 30 °C');
    expect(macro({ ...base, tempC: 30 }, null)).toContain('data-place="warm"');
    expect(macro(base, null)).toContain('실온 20 °C');
    const bright = macro(base, null);
    expect(bright).toContain('밝은 곳');
    expect(count(bright, 'dark-overlay')).toBe(0);
    const dark = macro({ ...base, light: 'dark' }, null);
    expect(dark).toContain('어두운 곳');
    expect(count(dark, 'dark-overlay')).toBe(1);
  });
});

describe('가상 현미경으로 보기', () => {
  it('곰팡이가 없으면 안내 문구만 있고 균사·포자는 그리지 않는다', () => {
    const html = micro(base, null);
    expect(html).toContain('아직 곰팡이가 보이지 않아요');
    expect(count(html, 'hypha')).toBe(0);
    expect(count(html, 'spore')).toBe(0);
  });

  it('균사 가닥 수와 길이는 덮은 넓이에 따라 늘고, 포자 덩어리 수는 spores에 따라 는다', () => {
    const sizes = [2, 4, 6, 8, 10].map((t) => {
      const s = at(base, t);
      const h = buildHyphae(s.coverPct);
      const len = Math.hypot(h.segments[0]!.x2 - h.segments[0]!.x1, h.segments[0]!.y2 - h.segments[0]!.y1);
      return { n: h.segments.length, len, spores: sporeCount(s.spores, h.tips.length) };
    });
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!.n).toBeGreaterThanOrEqual(sizes[i - 1]!.n);
      expect(sizes[i]!.len).toBeGreaterThan(sizes[i - 1]!.len);
      expect(sizes[i]!.spores).toBeGreaterThanOrEqual(sizes[i - 1]!.spores);
    }
    expect(sizes[4]!.spores).toBeGreaterThan(sizes[0]!.spores);
    expect(sporeCount(0, 40)).toBe(0);
    const html = micro(base, at(base, 10));
    expect(count(html, 'hypha')).toBe(buildHyphae(at(base, 10).coverPct).segments.length);
    expect(count(html, 'spore')).toBe(sporeCount(at(base, 10).spores, buildHyphae(at(base, 10).coverPct).tips.length));
  });

  it('라벨, 기본 배율 ×100, 축척 글자, 설명 문구, 배율 버튼 세 개(aria-pressed)', () => {
    const html = micro(base, at(base, 7));
    expect(html).toContain('>균사<');
    expect(html).toContain('>포자<');
    expect(html).toContain('곰팡이는 가는 실 같은 균사로 퍼지고, 포자로 퍼져 나가요.');
    expect(html).toMatch(/data-testid="scope-mag"[^>]*>×100</);
    expect(html).toMatch(/data-testid="scope-scale"[^>]*>0.2 mm</);
    expect(MAGNIFICATIONS.map((m) => m.label)).toEqual(['×40', '×100', '×400']);
    expect((html.match(/<button/g) ?? []).length).toBe(3);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>×100</);
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateTranspiration, type TranspirationSample } from '@sci/engine-life';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { transpirationModule } from './index';
import { humidityPct, transpirationRate, vaporPerStoma } from './initial';
import { CylinderMacroView, dropletCount, transpirationNote, yOfMl } from './CylinderMacroView';
import { LeafMicroView, slitRy, vaporPoint } from './LeafMicroView';

const unit = UNITS.find((u) => u.id === 'g6-plant')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g6-plant가 없어요');
const experiment = unit.experiment;
const base = { leaves: 8, light: 'bright', wind: 'off', startMl: 100 };
type V = typeof base;
const sim = (v: V) => simulateTranspiration(v as never);
const at = (v: V, t: number): TranspirationSample => sim(v).samples.find((s) => s.t === t)!;

const macro = (values: V, snapshot: TranspirationSample | null) =>
  renderToStaticMarkup(createElement(CylinderMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const micro = (values: V, snapshot: TranspirationSample | null) =>
  renderToStaticMarkup(createElement(LeafMicroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g6-plant는 transpiration 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(6);
    expect(unit.module).toBe(transpirationModule);
    expect(MODULES.transpiration.kind).toBe('transpiration');
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 기준 시행, 잎 0장, 어두운 곳, 처음 물 150 mL', () => {
    const cols = transpirationModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['이틀 동안 줄어든 물(mL)', '남은 물(mL)', '비닐봉지 속 물방울']);
    expect(cols.map((c) => c.value(sim(base).result))).toEqual(['19.2', '80.8', '많음']);
    expect(cols.map((c) => c.value(sim({ ...base, leaves: 0 }).result))).toEqual(['0.0', '100.0', '없음']);
    expect(cols.map((c) => c.value(sim({ ...base, light: 'dark' }).result))).toEqual(['4.8', '95.2', '조금']);
    expect(cols.map((c) => c.value(sim({ ...base, startMl: 150 }).result))).toEqual(['19.2', '130.8', '많음']);
  });

  it('결과 열이 시행마다 같은 값으로 고정되지 않는다', () => {
    const cols = transpirationModule.resultColumns(experiment);
    const runs = [base, { ...base, leaves: 0 }, { ...base, light: 'dark' }, { ...base, startMl: 150 }].map((v) => sim(v).result);
    for (const c of cols) expect(new Set(runs.map((r) => c.value(r))).size, c.label).toBeGreaterThan(1);
  });

  it('센서: 습도는 fog × 60 + 35 %(humidity), 빛 센서는 밝은 곳 80 %, 어두운 곳 2 %', () => {
    const [h, l] = transpirationModule.sensors(null, base);
    expect([h!.kind, h!.unit, h!.label, h!.source]).toEqual(['humidity', '%', '가상 습도 센서: 비닐봉지 안', 35]);
    expect([l!.kind, l!.unit, l!.label, l!.source]).toEqual(['light', '%', '가상 빛 센서', 80]);
    const end = transpirationModule.sensors(at(base, 48), { ...base, light: 'dark' });
    expect([end[0]!.source, end[1]!.source]).toEqual([95, 2]);
    expect(humidityPct(0.5)).toBe(65);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = transpirationModule.graph;
    expect([g.yLabel, g.yMin, g.integerTicks, g.xLabel, g.xTicks]).toEqual(['남은 물의 양(mL)', 0, undefined, '시간(시간)', [0, 12, 24, 36, 48]]);
    expect(g.markers).toEqual([{ t: 24, label: '하루' }]);
    expect(transpirationModule.restPlayhead).toBe(48);
    expect(transpirationModule.metric).toMatchObject({ sampleKey: 'remainingMl', resultKey: 'lostMl' });
    expect(transpirationModule.metric.sameThreshold(experiment)).toBe(0.5);
  });
});

describe('눈으로 보기', () => {
  it('실험 전에는 0시간째 100 mL, 48시간째에는 80.8 mL', () => {
    const before = macro(base, null);
    expect(before).toContain('0시간 · 남은 물 100.0 mL');
    expect(count(before, 'droplet')).toBe(0);
    const end = macro(base, at(base, 48));
    expect(end).toContain('48시간 · 남은 물 80.8 mL');
    expect(count(end, 'droplet')).toBe(18);
    expect(transpirationNote({ t: 12.5, remainingMl: 90.04, lostMl: 9.96, fog: 1, stomata: 1 })).toBe('12.5시간 · 남은 물 90.0 mL');
  });

  it('잎은 leaves 수만큼, 0장이면 잎을 딴 자국', () => {
    for (const n of [0, 4, 8]) expect(count(macro({ ...base, leaves: n }, null), 'leaf')).toBe(n);
    expect(macro(base, null)).not.toContain('잎을 딴 자국');
    const none = macro({ ...base, leaves: 0 }, null);
    expect(none).toContain('잎을 딴 자국');
    expect(count(none, 'leaf-scars')).toBe(1);
  });

  it('물방울 점은 fog에 비례한다', () => {
    expect([0, 0.25, 0.5, 1].map(dropletCount)).toEqual([0, 5, 9, 18]);
    const d = { ...base, light: 'dark' };
    expect(count(macro(d, at(d, 48)), 'droplet')).toBe(dropletCount(0.48));
    expect(count(macro({ ...base, leaves: 0 }, at({ ...base, leaves: 0 }, 48)), 'droplet')).toBe(0);
  });

  it('물 높이는 remainingMl, 위에 식용유 층이 있다', () => {
    expect(yOfMl(150)).toBeLessThan(yOfMl(100));
    expect(yOfMl(0) - yOfMl(75)).toBeCloseTo(yOfMl(75) - yOfMl(150), 9);
    const html = macro(base, at(base, 48));
    expect(html).toContain('식용유');
    expect(count(html, 'oil')).toBe(1);
    for (const n of ['0', '25', '50', '75', '100', '125', '150']) expect(html).toContain(`>${n}</text>`);
  });

  it('어두운 곳은 배경과 "어두운 곳" 라벨, 바람은 선풍기와 바람 선', () => {
    expect(macro(base, null)).not.toContain('data-testid="dark-bg"');
    expect(macro(base, null)).not.toContain('선풍기');
    const d = macro({ ...base, light: 'dark', wind: 'on' }, null);
    expect(d).toContain('data-testid="dark-bg"');
    expect(d).toContain('>어두운 곳</text>');
    expect(d).toContain('data-testid="fan"');
    expect(d).toContain('data-testid="wind-lines"');
    expect(d).toContain('>선풍기</text>');
  });
});

describe('잎 확대해 보기', () => {
  it('기공·물관·수증기 라벨과 문구, 기공 네 개', () => {
    const html = micro(base, null);
    for (const w of ['기공', '물관', '수증기']) expect(html).toContain(`>${w}</text>`);
    expect(html).toContain('물은 뿌리와 줄기를 거쳐 잎의 기공으로 빠져나가요.');
    expect(count(html, 'stoma')).toBe(4);
    expect(count(html, 'water-arrow')).toBe(3);
  });

  it('기공 열림은 stomata에 비례한다(어두우면 틈이 좁다)', () => {
    expect(slitRy(1)).toBe(8);
    expect(slitRy(0.25)).toBe(2.75);
    const ry = (html: string) => Number(/data-testid="stoma-slit"[^>]* ry="([\d.]+)"/.exec(html)![1]);
    expect(ry(micro(base, at(base, 48)))).toBe(8);
    const d = { ...base, light: 'dark' };
    expect(ry(micro(d, at(d, 48)))).toBe(2.75);
    expect(micro(base, null)).toContain('기공이 활짝 열렸어요');
    expect(micro(d, null)).toContain('기공이 조금만 열렸어요');
  });

  it('수증기 점의 개수는 증산량에 비례한다', () => {
    const dots = (v: V) => count(micro(v, null), 'vapor-dot');
    const brightWind = dots({ ...base, wind: 'on' });
    const bright = dots(base);
    const darkWind = dots({ ...base, light: 'dark', wind: 'on' });
    const dark = dots({ ...base, light: 'dark' });
    expect([brightWind, bright, darkWind, dark]).toEqual([24, 16, 8, 4]);
    expect(brightWind).toBeGreaterThan(bright);
    expect(bright).toBeGreaterThan(darkWind);
    expect(darkWind).toBeGreaterThan(dark);
    expect(transpirationRate(0, 'bright', 'on')).toBe(0);
    expect(vaporPerStoma(0)).toBe(0);
  });

  it('수증기 점은 위상에 따라 위로 올라간다', () => {
    const y = (phase: number) => vaporPoint(100, 0, 1, phase)[1];
    expect(y(0.5)).toBeLessThan(y(0));
  });

  it('잎이 없으면 "잎이 없어요" 상태이고 기공·수증기가 없으며 물관은 보인다', () => {
    const html = micro({ ...base, leaves: 0 }, null);
    expect(html).toContain('>잎이 없어요</text>');
    expect(count(html, 'no-leaf')).toBe(1);
    expect(count(html, 'stoma')).toBe(0);
    expect(count(html, 'vapor-dot')).toBe(0);
    expect(count(html, 'water-arrow')).toBe(0);
    expect(html).toContain('>물관</text>');
  });
});

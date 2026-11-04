import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateSunAngle, type SunAngleSample } from '@sci/engine-earth';
import { UNITS } from '../../units';
import { sunAngleModule } from './index';
import { clockText, dayLengthText } from './initial';
import { SunMacroView, sunNote } from './SunMacroView';
import { SunSpaceView, orbitPoint } from './SunSpaceView';

const unit = UNITS.find((u) => u.id === 'g6-seasons')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g6-seasons가 없어요');
const experiment = unit.experiment;
const base = { season: 'spring', tiltDeg: 23.44, stickCm: 10 };
const at = (values: typeof base, t: number): SunAngleSample => simulateSunAngle(values as never).samples.find((s) => s.t === t)!;

const macro = (values: typeof base, snapshot: SunAngleSample | null) =>
  renderToStaticMarkup(createElement(SunMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const space = (values: typeof base) =>
  renderToStaticMarkup(createElement(SunSpaceView, { experiment, trial: undefined, snapshot: null, values, playhead: 0 }));

describe('시각·낮 길이 글자', () => {
  it('"14시간 35분", "12시 0분"', () => {
    expect(dayLengthText(14.59)).toBe('14시간 35분');
    expect(dayLengthText(9.41)).toBe('9시간 25분');
    expect(dayLengthText(12)).toBe('12시간 0분');
    expect(clockText(12)).toBe('12시 0분');
    expect(clockText(7.3)).toBe('7시 18분');
  });
});

describe('결과 열·센서', () => {
  it('결과 열 네 개의 글자', () => {
    const { result } = simulateSunAngle({ ...base, season: 'summer' } as never);
    const cols = sunAngleModule.resultColumns(experiment);
    expect(cols.map((c) => c.value(result))).toEqual(['75.9', '2.5', '14시간 35분', '145']);
    expect(cols.map((c) => c.label)).toEqual(['남중 고도(°)', '낮 12시 그림자(cm)', '낮의 길이', '하루 동안 받은 에너지(봄 = 100)']);
  });

  it('빛 세기 센서는 light 종류, 실험 전에는 고른 조건의 낮 12시 값, 실행 중에는 스냅샷 값', () => {
    const before = sunAngleModule.sensors(null, base)[0]!;
    expect([before.kind, before.unit, before.label]).toEqual(['light', '%', '가상 빛 세기 센서']);
    expect(before.source).toBeCloseTo(at(base, 12).lightPct, 9);
    expect(sunAngleModule.sensors(at(base, 8), base)[0]!.source).toBeCloseTo(at(base, 8).lightPct, 9);
    expect(sunAngleModule.sensors(at(base, 2), base)[0]!.source).toBe(0);
  });

  it('그래프 설정: 태양 고도, yMin 0, 시각(시), 0·6·12·18·24, 12시 남중', () => {
    const g = sunAngleModule.graph;
    expect([g.yLabel, g.yMin, g.xLabel, g.xTicks]).toEqual(['태양 고도(°)', 0, '시각(시)', [0, 6, 12, 18, 24]]);
    expect(g.markers).toEqual([{ t: 12, label: '남중' }]);
    expect(sunAngleModule.metric.sameThreshold(experiment)).toBe(0.5);
  });
});

describe('눈으로 보기', () => {
  it('실험 전에는 낮 12시: 태양 고도와 그림자 문구, 태양·그림자·각호', () => {
    const html = macro(base, null);
    expect(html).toContain('12시 0분 · 태양 고도 52.5° · 그림자 7.7 cm');
    expect(html).toContain('data-testid="sun"');
    expect(html).toContain('data-testid="shadow"');
    expect(html).toContain('52.5°');
    expect(html).toContain('막대 10 cm');
    expect(html).not.toContain('더 길어요');
  });

  it('막대 길이는 비례해서 그리고, 그림자는 두 배 길이다', () => {
    const y2 = (html: string) => Number(/data-testid="stick" x1="[\d.]+" y1="[\d.]+" x2="[\d.]+" y2="([\d.]+)"/.exec(html)![1]);
    expect(196 - y2(macro({ ...base, stickCm: 20 }, null))).toBe(2 * (196 - y2(macro(base, null))));
    const len = (html: string) => {
      const m = /data-testid="shadow"[^>]*x1="([\d.]+)"[^>]*x2="([\d.]+)"/.exec(html)!;
      return Number(m[2]) - Number(m[1]);
    };
    // 여름: 2.5 cm와 5.0 cm (판을 넘지 않는다)
    const summer = { ...base, season: 'summer' };
    expect(len(macro({ ...summer, stickCm: 20 }, null))).toBeCloseTo(2 * len(macro(summer, null)), 6);
  });

  it('밤(고도 0)이면 태양을 그리지 않고 "태양이 지평선 아래에 있어요"', () => {
    const html = macro(base, at(base, 2));
    expect(html).not.toContain('data-testid="sun"');
    expect(html).not.toContain('data-testid="shadow"');
    expect(html).toContain('2시 0분 · 태양이 지평선 아래에 있어요');
  });

  it('그림자가 판을 넘으면 판 끝까지 그리고 "→ 더 길어요", 그림자 −1은 "그림자가 아주 길어요"', () => {
    const winter = { season: 'winter', tiltDeg: 30, stickCm: 20 };
    const html = macro(winter, null); // 24.1 cm × 2 = 48.2 cm × 4 px > 판
    expect(html).toContain('→ 더 길어요');
    expect(html).toContain('data-clipped="true"');
    const low = { t: 7, sunAltDeg: 1.2, shadowCm: -1, lightPct: 2 };
    expect(sunNote(low)).toBe('7시 0분 · 태양 고도 1.2° · 그림자가 아주 길어요');
    expect(macro(base, low)).toContain('→ 더 길어요');
  });
});

describe('우주에서 보기', () => {
  it('네 계절의 지구, 선택한 계절 강조, 자전축 기울기 글자', () => {
    const html = space({ ...base, season: 'summer' });
    expect((html.match(/data-testid="earth"/g) ?? []).length).toBe(4);
    expect(html).toMatch(/data-season="summer" data-selected="true"/);
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1);
    for (const w of ['봄', '여름', '가을', '겨울']) expect(html).toContain(`>${w}<`);
    expect(html).toContain('자전축 기울기 23.5°');
    expect(html).toContain('같은 양의 빛이 닿는 넓이');
    expect(html).toContain('좁을수록 땅이 더 따뜻해져요');
  });

  it('넓이는 봄 = 1.00배, 여름은 더 좁고 겨울은 더 넓다', () => {
    const label = (v: typeof base) => /넓이: 봄의 ([\d.]+)배/.exec(space(v))![1]!;
    expect(label(base)).toBe('1.00');
    expect(Number(label({ ...base, season: 'summer' }))).toBeLessThan(1);
    expect(Number(label({ ...base, season: 'winter' }))).toBeGreaterThan(1);
    expect(label({ ...base, season: 'summer' })).toBe('0.82');
    expect(label({ ...base, season: 'winter' })).toBe('1.63');
  });

  it('기울기 0°: 자전축이 궤도면에 수직(세로선)이고, 네 계절의 넓이가 같다', () => {
    const html = space({ ...base, tiltDeg: 0, season: 'summer' });
    for (const m of html.matchAll(/data-testid="earth-axis" x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/g)) expect(m[1]).toBe(m[2]);
    const ratios = ['spring', 'summer', 'autumn', 'winter'].map((season) => /넓이: 봄의 ([\d.]+)배/.exec(space({ ...base, tiltDeg: 0, season }))![1]);
    expect(new Set(ratios)).toEqual(new Set(['1.00']));
    expect(html).toContain('자전축 기울기 0°');
  });

  it('기울기가 있으면 네 위치의 자전축이 모두 같은 방향으로 기운다', () => {
    const html = space({ ...base, tiltDeg: 30 });
    const dirs = [...html.matchAll(/data-testid="earth-axis" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => [
      Number(m[3]) - Number(m[1]),
      Number(m[2]) - Number(m[4]),
    ]);
    expect(dirs).toHaveLength(4);
    for (const d of dirs) {
      expect(d[0]).toBeCloseTo(dirs[0]![0]!, 6);
      expect(d[1]).toBeCloseTo(dirs[0]![1]!, 6);
      expect(d[0]!).toBeGreaterThan(0);
    }
  });

  it('궤도 위치: 봄은 위, 여름은 왼쪽, 가을은 아래, 겨울은 오른쪽', () => {
    const [sp, su, au, wi] = (['spring', 'summer', 'autumn', 'winter'] as const).map(orbitPoint);
    expect(su!.x).toBeLessThan(wi!.x);
    expect(sp!.y).toBeLessThan(au!.y);
    expect(sp!.x).toBeCloseTo(au!.x, 6);
    expect(su!.y).toBeCloseTo(wi!.y, 6);
  });
});

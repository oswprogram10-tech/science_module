import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import {
  interpolateGermination,
  simulateGermination,
  temperatureFactors,
  validateGerminationExperiment,
  type GerminationParams,
  type LightKind,
  type WaterKind,
} from './germination';
import lifecycleJson from '../../../../content/units/g3-lifecycle/manifest.json';

const p = (water: WaterKind, tempC: number, light: LightKind): GerminationParams => ({ water, tempC, light });

// 사양 §2.2: [물, 온도, 7일째 싹 튼 수, 처음 싹 튼 날]
const TABLE: [WaterKind, number, number, number | null][] = [
  ['none', 5, 0, null],
  ['none', 20, 0, null],
  ['none', 30, 0, null],
  ['water', 5, 0, null],
  ['water', 20, 9, 1.8],
  ['water', 30, 9, 1.1],
];

describe('싹 트기 모델: 사양 기준값(빛 두 가지 각각)', () => {
  for (const light of ['bright', 'dark'] as const) {
    for (const [water, tempC, day7, first] of TABLE) {
      it(`${water} ${tempC} °C ${light}`, () => {
        const r = simulateGermination(p(water, tempC, light)).result;
        expect(r.sproutedDay7).toBe(day7);
        expect(r.firstDay).toBe(first);
        expect(r.leafColor).toBe(first === null ? null : light === 'bright' ? 'green' : 'yellow');
      });
    }
  }

  it('빛만 바꾸면 7일째 수와 처음 싹 튼 날은 같고 떡잎 색만 다르다', () => {
    for (const [water, tempC] of TABLE) {
      const a = simulateGermination(p(water, tempC, 'bright'));
      const b = simulateGermination(p(water, tempC, 'dark'));
      expect(b.result.sproutedDay7).toBe(a.result.sproutedDay7);
      expect(b.result.firstDay).toBe(a.result.firstDay);
      expect(a.samples.map((s) => s.sprouted)).toEqual(b.samples.map((s) => s.sprouted));
    }
    const g = simulateGermination(p('water', 20, 'bright')).result;
    const d = simulateGermination(p('water', 20, 'dark')).result;
    expect([g.leafColor, d.leafColor]).toEqual(['green', 'yellow']);
  });
});

describe('샘플', () => {
  const cases = TABLE.flatMap(([water, tempC]) => (['bright', 'dark'] as const).map((l) => p(water, tempC, l)));
  it('모든 샘플에서 싹 튼 수는 단조 증가하고 0 이상 씨앗 수 이하이다', () => {
    for (const c of cases) {
      const { samples } = simulateGermination(c);
      expect(samples[0]!.t).toBe(0);
      expect(samples[samples.length - 1]!.t).toBe(10);
      expect(samples[0]!.sprouted).toBe(0);
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!;
        expect(s.sprouted).toBeGreaterThanOrEqual(0);
        expect(s.sprouted).toBeLessThanOrEqual(10);
        if (i > 0) expect(s.sprouted).toBeGreaterThanOrEqual(samples[i - 1]!.sprouted);
      }
    }
  });

  it('줄기는 싹 튼 뒤에만 자라고, 어두우면 더 빨리 길어지며 60 mm가 최대이고, 어두우면 초록 정도가 0이다', () => {
    const bright = simulateGermination(p('water', 30, 'bright')).samples;
    const dark = simulateGermination(p('water', 30, 'dark')).samples;
    expect(bright[0]!.stemMm).toBe(0);
    expect(bright[bright.length - 1]!.stemMm).toBeCloseTo((10 - 1.09) * 5, 0);
    expect(dark[dark.length - 1]!.stemMm).toBeGreaterThan(bright[bright.length - 1]!.stemMm);
    expect(Math.max(...dark.map((s) => s.stemMm))).toBeLessThanOrEqual(60);
    expect(dark.every((s) => s.greenness === 0)).toBe(true);
    expect(bright[bright.length - 1]!.greenness).toBe(1);
    const none = simulateGermination(p('none', 20, 'bright')).samples;
    expect(none.every((s) => s.stemMm === 0 && s.greenness === 0)).toBe(true);
  });

  it('옵션: 씨앗 수와 기간을 바꿀 수 있고, 잘못된 값은 거부한다', () => {
    expect(simulateGermination(p('water', 20, 'bright'), { seeds: 20 }).result.sproutedDay7).toBe(17);
    expect(simulateGermination(p('water', 20, 'bright'), { days: 14 }).samples.at(-1)!.t).toBe(14);
    expect(() => simulateGermination(p('water', 20, 'bright'), { days: 5 })).toThrow(RangeError);
    expect(() => simulateGermination(p('water', 20, 'bright'), { seeds: 0 })).toThrow(RangeError);
    expect(() => simulateGermination(p('water', 20, 'bright'), { spread: 0 })).toThrow(RangeError);
  });

  it('잘못된 조건은 거부한다', () => {
    expect(() => simulateGermination({ water: 'x' as WaterKind, tempC: 20, light: 'bright' })).toThrow(RangeError);
    expect(() => simulateGermination(p('water', 45, 'bright'))).toThrow(RangeError);
    expect(() => simulateGermination(p('water', 20, 'x' as LightKind))).toThrow(RangeError);
  });

  it('같은 입력은 같은 출력이다(난수 없음)', () => {
    expect(simulateGermination(p('water', 20, 'dark'))).toEqual(simulateGermination(p('water', 20, 'dark')));
  });
});

describe('온도 보간', () => {
  it('표의 점과 그 사이, 범위 밖', () => {
    expect(temperatureFactors(5)).toEqual({ pmax: 0, rate: 0 });
    expect(temperatureFactors(20)).toEqual({ pmax: 1, rate: 1 });
    expect(temperatureFactors(30)).toEqual({ pmax: 1, rate: 1.3 });
    expect(temperatureFactors(12.5).pmax).toBeCloseTo(0.5, 9);
    expect(temperatureFactors(25).rate).toBeCloseTo(1.15, 9);
    expect(temperatureFactors(35).pmax).toBeCloseTo(0.5, 9);
    expect(temperatureFactors(0)).toEqual({ pmax: 0, rate: 0 });
    expect(temperatureFactors(40)).toEqual({ pmax: 0, rate: 0 });
    expect(temperatureFactors(-3)).toEqual({ pmax: 0, rate: 0 });
  });
});

describe('보간과 매니페스트 검증', () => {
  it('interpolateGermination은 선형 보간이다', () => {
    const a = { t: 0, sprouted: 0, greenness: 0, stemMm: 0 };
    const b = { t: 1, sprouted: 4, greenness: 1, stemMm: 10 };
    expect(interpolateGermination(a, b, 0.5)).toEqual({ t: 0.5, sprouted: 2, greenness: 0.5, stemMm: 5 });
  });

  const exp = () => JSON.parse(JSON.stringify(parseManifest(lifecycleJson).experiments[0])) as VariableExperiment;

  it('g3-lifecycle 매니페스트는 통과한다', () => {
    expect(validateGerminationExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const e = exp();
    e.variables = e.variables.filter((v) => v.key !== 'light');
    expect(validateGerminationExperiment(e).join()).toContain('"light"');
    const f = exp();
    f.variables.find((v) => v.key === 'tempC')!.options.push({ value: 60, label: '60' });
    f.variables.find((v) => v.key === 'water')!.options.push({ value: 'ice', label: 'x' });
    f.variables.find((v) => v.key === 'light')!.options.push({ value: 1, label: 'y' });
    expect(validateGerminationExperiment(f)).toHaveLength(3);
    const g = exp();
    g.params = { seeds: 0, days: 3 };
    expect(validateGerminationExperiment(g)).toHaveLength(2);
  });
});

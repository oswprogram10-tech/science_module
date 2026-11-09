import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import {
  interpolateMold,
  moldMoistureFactor,
  moldTemperatureFactor,
  simulateMold,
  validateMoldExperiment,
  type MoistureKind,
  type MoldLightKind,
  type MoldParams,
} from './mold';
import microbeJson from '../../../../content/units/g4-microbe/manifest.json';

const p = (moisture: MoistureKind, tempC: number, light: MoldLightKind): MoldParams => ({ moisture, tempC, light });

// 사양 §2.1: [빵, 온도, 7일째 넓이, 10일째 넓이, 처음 보인 날]
const TABLE: [MoistureKind, number, number, number, number | null][] = [
  ['dry', 5, 0, 0, null],
  ['dry', 20, 1, 2, 6.7],
  ['dry', 30, 2, 5, 5.1],
  ['wet', 5, 0, 2, 8.0],
  ['wet', 20, 48, 93, 2.0],
  ['wet', 30, 86, 100, 1.5],
];

describe('곰팡이 모델: 사양 기준값(빛 두 가지 각각)', () => {
  for (const light of ['bright', 'dark'] as const) {
    for (const [moisture, tempC, c7, c10, first] of TABLE) {
      it(`${moisture} ${tempC} °C ${light}`, () => {
        const r = simulateMold(p(moisture, tempC, light)).result;
        expect(r).toEqual({ cover7: c7, cover10: c10, firstDay: first });
      });
    }
  }

  it('빛만 바꾸면 결과와 샘플이 모두 같다', () => {
    for (const [moisture, tempC] of TABLE) {
      expect(simulateMold(p(moisture, tempC, 'dark'))).toEqual(simulateMold(p(moisture, tempC, 'bright')));
    }
  });
});

describe('샘플', () => {
  const cases = TABLE.flatMap(([m, t]) => (['bright', 'dark'] as const).map((l) => p(m, t, l)));

  it('coverPct는 0~100 안에서 단조 증가하고 spores는 0~1이다', () => {
    for (const c of cases) {
      const { samples } = simulateMold(c);
      expect(samples[0]!.t).toBe(0);
      expect(samples[samples.length - 1]!.t).toBe(10);
      expect(samples[0]!.coverPct).toBe(0);
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!;
        expect(s.coverPct).toBeGreaterThanOrEqual(0);
        expect(s.coverPct).toBeLessThanOrEqual(100);
        expect(s.spores).toBeGreaterThanOrEqual(0);
        expect(s.spores).toBeLessThanOrEqual(1);
        if (i > 0) expect(s.coverPct).toBeGreaterThanOrEqual(samples[i - 1]!.coverPct);
      }
    }
  });

  it('지체 기간 동안은 0이고 그 뒤 1 %에서 시작한다. 포자는 20 %를 넘어야 생긴다', () => {
    const { samples } = simulateMold(p('wet', 20, 'bright'));
    const at = (t: number) => samples.find((s) => s.t === t)!;
    expect(at(1.9).coverPct).toBe(0);
    expect(at(2).coverPct).toBeCloseTo(1, 9);
    expect(at(2).spores).toBe(0);
    expect(at(10).spores).toBeCloseTo((at(10).coverPct - 20) / 80, 9);
    expect(at(10).spores).toBeGreaterThan(0.8);
  });

  it('옵션: 기간을 바꿀 수 있고, 잘못된 값은 거부한다', () => {
    expect(simulateMold(p('wet', 20, 'bright'), { days: 14 }).samples.at(-1)!.t).toBe(14);
    expect(simulateMold(p('dry', 5, 'bright'), { days: 30 }).result.firstDay).toBe(26.7);
    expect(() => simulateMold(p('wet', 20, 'bright'), { days: 5 })).toThrow(RangeError);
    expect(() => simulateMold(p('wet', 20, 'bright'), { sampleEveryDay: 0 })).toThrow(RangeError);
  });

  it('잘못된 조건은 거부한다', () => {
    expect(() => simulateMold({ moisture: 'x' as MoistureKind, tempC: 20, light: 'bright' })).toThrow(RangeError);
    expect(() => simulateMold(p('wet', Number.NaN, 'bright'))).toThrow(RangeError);
    expect(() => simulateMold(p('wet', 20, 'x' as MoldLightKind))).toThrow(RangeError);
  });

  it('같은 입력은 같은 출력이다(난수 없음)', () => {
    expect(simulateMold(p('wet', 30, 'dark'))).toEqual(simulateMold(p('wet', 30, 'dark')));
  });
});

describe('자람 정도', () => {
  it('온도: 표의 점과 그 사이, 범위 밖', () => {
    expect(moldTemperatureFactor(5)).toBe(0.25);
    expect(moldTemperatureFactor(20)).toBe(1);
    expect(moldTemperatureFactor(30)).toBe(1.3);
    expect(moldTemperatureFactor(12.5)).toBeCloseTo(0.625, 9);
    expect(moldTemperatureFactor(25)).toBeCloseTo(1.15, 9);
    expect(moldTemperatureFactor(0)).toBe(0);
    expect(moldTemperatureFactor(-4)).toBe(0);
    expect(moldTemperatureFactor(40)).toBe(0.5);
    expect(moldTemperatureFactor(55)).toBe(0.5);
  });

  it('물기: 마른 빵 0.3, 물을 뿌린 빵 1', () => {
    expect([moldMoistureFactor('dry'), moldMoistureFactor('wet')]).toEqual([0.3, 1]);
  });
});

describe('보간과 매니페스트 검증', () => {
  it('interpolateMold는 선형 보간이다', () => {
    expect(interpolateMold({ t: 0, coverPct: 0, spores: 0 }, { t: 1, coverPct: 40, spores: 0.5 }, 0.5)).toEqual({ t: 0.5, coverPct: 20, spores: 0.25 });
  });

  const exp = () => JSON.parse(JSON.stringify(parseManifest(microbeJson).experiments[0])) as VariableExperiment;

  it('g4-microbe 매니페스트는 통과한다', () => {
    expect(validateMoldExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const e = exp();
    e.variables = e.variables.filter((v) => v.key !== 'light');
    expect(validateMoldExperiment(e).join()).toContain('"light"');
    const f = exp();
    f.variables.find((v) => v.key === 'tempC')!.options.push({ value: 60, label: '60' });
    f.variables.find((v) => v.key === 'moisture')!.options.push({ value: 'ice', label: 'x' });
    f.variables.find((v) => v.key === 'light')!.options.push({ value: 1, label: 'y' });
    expect(validateMoldExperiment(f)).toHaveLength(3);
    const g = exp();
    g.params = { days: 3 };
    expect(validateMoldExperiment(g)).toHaveLength(1);
  });
});

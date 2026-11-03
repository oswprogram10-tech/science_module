import { describe, expect, it } from 'vitest';
import {
  capacityG,
  simulateDissolution,
  solubilityPer100g,
  type DissolutionParams,
  validateDissolutionExperiment,
  type Solute,
} from './index';
import { parseManifest, type Experiment } from '@sci/schema';
import manifestJson from '../../../../content/units/g5-solution/manifest.json';

const SPOON = 2;
const base: DissolutionParams = { solute: 'salt', waterMl: 100, waterTempC: 20, stir: 1 };
const run = (p: Partial<DissolutionParams>) => simulateDissolution({ ...base, ...p });

describe('solubilityPer100g', () => {
  it('표 값과 선형 보간', () => {
    expect(solubilityPer100g('salt', 20)).toBe(35.9);
    expect(solubilityPer100g('alum', 15)).toBeCloseTo(9.5, 6);
  });
  it('범위 밖이면 RangeError', () => {
    expect(() => solubilityPer100g('salt', 5)).toThrow(RangeError);
    expect(() => solubilityPer100g('salt', 61)).toThrow(RangeError);
  });
  it('용량 = 용해도 x 물의 양 / 100', () => {
    expect(capacityG('sugar', 20, 150)).toBeCloseTo(306, 6);
  });
});

describe('simulateDissolution', () => {
  it('백반: 온도가 오를수록 dissolvedG가 늘어난다(10~60 °C)', () => {
    const temps = [10, 20, 40, 60];
    const vals = temps.map((t) => run({ solute: 'alum', waterTempC: t }).result.dissolvedG);
    for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThan(vals[i - 1]!);
  });

  it('소금: 10 °C와 60 °C의 차이가 5% 이내', () => {
    const a = run({ waterTempC: 10 }).result.dissolvedG;
    const b = run({ waterTempC: 60 }).result.dissolvedG;
    expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.05);
  });

  it('물의 양 2배 -> dissolvedG 약 2배(숟가락 1개 이내)', () => {
    for (const solute of ['salt', 'alum', 'bakingSoda'] as Solute[]) {
      const a = run({ solute, waterMl: 50 }).result.dissolvedG;
      const b = run({ solute, waterMl: 100 }).result.dissolvedG;
      expect(Math.abs(b - 2 * a)).toBeLessThanOrEqual(SPOON);
    }
  });

  it('stir 0/1/2: dissolvedG는 같고 timeS는 stir가 클수록 짧다', () => {
    const r = [0, 1, 2].map((s) => run({ stir: s as 0 | 1 | 2 }).result);
    expect(Math.abs(r[0]!.dissolvedG - r[1]!.dissolvedG)).toBeLessThanOrEqual(SPOON);
    expect(Math.abs(r[1]!.dissolvedG - r[2]!.dissolvedG)).toBeLessThanOrEqual(SPOON);
    expect(r[0]!.timeS).toBeGreaterThan(r[1]!.timeS);
    expect(r[1]!.timeS).toBeGreaterThan(r[2]!.timeS);
  });

  it('질량 보존과 용량 상한', () => {
    for (const solute of ['salt', 'sugar', 'alum', 'bakingSoda'] as Solute[]) {
      for (const waterTempC of [10, 40, 60]) {
        const p = { ...base, solute, waterTempC, waterMl: 50 };
        const cap = capacityG(solute, waterTempC, 50);
        const { samples } = simulateDissolution(p);
        for (const s of samples) {
          expect(Math.abs(s.addedG - (s.dissolvedG + s.undissolvedG))).toBeLessThan(1e-6);
          expect(s.dissolvedG).toBeLessThanOrEqual(cap + 1e-9);
        }
      }
    }
  });

  it('포화로 끝나고 결과 필드가 맞다', () => {
    const { result, samples } = run({ solute: 'alum', waterMl: 50, waterTempC: 10 });
    expect(result.saturated).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.dissolvedG).toBe(3.8);
    expect(result.spoonsFullyDissolved).toBe(1);
    expect(samples[0]).toEqual({ t: 0, addedG: 2, dissolvedG: 0, undissolvedG: 2 });
    expect(samples[samples.length - 1]!.t).toBe(result.timeS);
  });

  it('maxTimeS를 넘으면 truncated', () => {
    const { result } = simulateDissolution(base, { maxTimeS: 5 });
    expect(result.truncated).toBe(true);
    expect(result.saturated).toBe(false);
  });

  it('결정적이다', () => {
    expect(run({ stir: 2 })).toEqual(run({ stir: 2 }));
  });
});

describe('결과값', () => {
  it('녹은 양 표시값은 최대량을 넘지 않고, 바닥에 남은 숟가락은 세지 않는다', () => {
    for (const solute of ['salt', 'sugar', 'alum', 'bakingSoda'] as Solute[]) {
      for (const waterMl of [50, 100, 150]) {
        for (const waterTempC of [10, 20, 40, 60]) {
          const out = run({ solute, waterMl, waterTempC, stir: 2 });
          const cap = capacityG(solute, waterTempC, waterMl);
          expect(out.result.dissolvedG).toBeLessThanOrEqual(cap + 1e-9);
          expect(out.result.spoonsFullyDissolved).toBe(Math.floor(cap / SPOON + 1e-9));
        }
      }
    }
  });
  it('소금 50 mL 20 °C: 17.9 g, 8숟가락', () => {
    const r = run({ waterMl: 50 }).result;
    expect(r.dissolvedG).toBe(17.9);
    expect(r.spoonsFullyDissolved).toBe(8);
  });
});

describe('입력 범위', () => {
  it('stir가 0/1/2가 아니면 RangeError', () => {
    expect(() => run({ stir: 3 as never })).toThrow(RangeError);
    expect(() => run({ stir: -1 as never })).toThrow(RangeError);
    expect(() => run({ stir: NaN as never })).toThrow(RangeError);
  });
  it('waterMl이 유한한 양수가 아니면 RangeError', () => {
    for (const waterMl of [NaN, 0, -5, Infinity]) {
      expect(() => run({ waterMl })).toThrow(RangeError);
    }
  });
});

describe('validateDissolutionExperiment', () => {
  const exp = parseManifest(manifestJson).experiments[0]!;
  const withOptions = (key: string, values: Array<string | number>): Experiment => ({
    ...exp,
    variables: exp.variables.map((v) =>
      v.key === key
        ? { ...v, options: values.map((value) => ({ value, label: String(value) })), default: values[0]! }
        : v,
    ),
  });
  it('현재 매니페스트는 통과', () => {
    expect(validateDissolutionExperiment(exp)).toEqual([]);
  });
  it('알 수 없는 용질', () => {
    const e = validateDissolutionExperiment(withOptions('solute', ['salt', 'pepper']));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('solute');
    expect(e[0]).toContain('pepper');
  });
  it('온도 범위·형식', () => {
    expect(validateDissolutionExperiment(withOptions('waterTempC', [20, 90]))).toHaveLength(1);
    expect(validateDissolutionExperiment(withOptions('waterTempC', [5, '20']))).toHaveLength(2);
  });
  it('물의 양은 양수', () => {
    expect(validateDissolutionExperiment(withOptions('waterMl', [50, 0, -1, 'x']))).toHaveLength(3);
  });
  it('젓기는 0,1,2', () => {
    const e = validateDissolutionExperiment(withOptions('stir', [0, 1, 3]));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('stir');
  });
  it('필수 변인 누락', () => {
    const e = validateDissolutionExperiment({
      ...exp,
      variables: exp.variables.filter((v) => v.key !== 'stir'),
    });
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('stir');
  });
});

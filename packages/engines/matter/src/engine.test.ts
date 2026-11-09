import { describe, expect, it } from 'vitest';
import {
  capacityG,
  interpolateDissolution,
  simulateDissolution,
  solubilityPer100g,
  type DissolutionParams,
  validateDissolutionExperiment,
  type Solute,
} from './index';
import { parseManifest, type VariableExperiment, type VariableExperiment as Experiment } from '@sci/schema';
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
  const exp = parseManifest(manifestJson).experiments[0]! as VariableExperiment;
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

// ---------- 기체 모델 ----------
import gasManifestJson from '../../../../content/units/g4-gases/manifest.json';
import { GAS_TYPES, interpolateGas, simulateGas, validateGasExperiment, type GasParams } from './index';

const gasBase: GasParams = { push: 0, bathTempC: 20, gasType: 'air', startMl: 30 };
const gas = (p: Partial<GasParams> = {}, o = {}) => simulateGas({ ...gasBase, ...p }, o);

describe('simulateGas', () => {
  it('누르는 힘 0→1→2: 부피가 줄어든다 (30 / 24 / 15 mL)', () => {
    const v = ([0, 1, 2] as const).map((push) => gas({ push }).result.volumeMl);
    expect(v[0]).toBeCloseTo(30.0, 1);
    expect(v[1]).toBeCloseTo(24.0, 1);
    expect(v[2]).toBeCloseTo(15.0, 1);
    expect(v[0]!).toBeGreaterThan(v[1]!);
    expect(v[1]!).toBeGreaterThan(v[2]!);
  });
  it('물의 온도 0→20→60: 부피가 늘어난다 (60 °C에서 약 34.1 mL)', () => {
    const v = [0, 20, 60].map((bathTempC) => gas({ bathTempC }).result.volumeMl);
    expect(v[0]!).toBeLessThan(v[1]!);
    expect(v[1]!).toBeLessThan(v[2]!);
    expect(v[2]!).toBeCloseTo((30 * 333.15) / 293.15, 0);
    expect(Math.abs(v[2]! - 34.1)).toBeLessThanOrEqual(0.1);
  });
  it('기체 종류만 바꾸면 결과가 똑같다', () => {
    const ref = gas({ push: 1, bathTempC: 60 });
    for (const gasType of GAS_TYPES) expect(gas({ push: 1, bathTempC: 60, gasType })).toEqual(ref);
  });
  it('처음 부피가 2배면 결과 부피도 비례한다', () => {
    for (const push of [0, 1, 2] as const) {
      for (const bathTempC of [0, 20, 60]) {
        const a = gas({ push, bathTempC, startMl: 25 }).result.volumeMl;
        const b = gas({ push, bathTempC, startMl: 50 }).result.volumeMl;
        expect(Math.abs(b - 2 * a)).toBeLessThanOrEqual(0.1);
      }
    }
  });
  it('모든 샘플에서 P×V/(T+273.15)가 일정하다 (압력·온도 동시 변화 포함)', () => {
    for (const p of [gasBase, { push: 2 as const, bathTempC: 60 }, { push: 1 as const, bathTempC: 0, startMl: 50 }]) {
      const { samples } = gas(p);
      const k = (s: (typeof samples)[number]) => (s.pressureAtm * s.volumeMl) / (s.gasTempC + 273.15);
      const k0 = k(samples[0]!);
      for (const s of samples) expect(Math.abs(k(s) - k0) / k0).toBeLessThan(1e-9);
    }
  });
  it('처음 상태와 샘플 간격', () => {
    const { samples } = gas({ push: 2, bathTempC: 60, startMl: 50 });
    expect(samples[0]).toEqual({ t: 0, volumeMl: 50, pressureAtm: 1, gasTempC: 20 });
    expect(samples[1]!.t).toBe(0.25);
    expect(samples[samples.length - 1]!.t).toBe(30);
  });
  it('결과: 변화량과 안정 시각', () => {
    const r = gas({ push: 1 }).result;
    expect(r.changeMl).toBeCloseTo(-6.0, 1);
    expect(r.settleS).toBeGreaterThan(0);
    expect(r.settleS).toBeLessThan(10);
    const slow = gas({ bathTempC: 60 }).result;
    expect(slow.settleS).toBeGreaterThan(r.settleS); // 온도 변화가 더 느리다
    expect(gas().result.settleS).toBe(0);
    expect(gas().result.changeMl).toBe(0);
  });
  it('결정적이다 (난수 없음)', () => {
    expect(gas({ push: 2, bathTempC: 0 })).toEqual(gas({ push: 2, bathTempC: 0 }));
  });
  it('주사기 눈금을 넘으면 RangeError', () => {
    expect(() => gas({ bathTempC: 80, startMl: 50 }, { syringeMaxMl: 55 })).toThrow(RangeError);
    expect(() => gas({ push: 3 as unknown as 0 })).toThrow(RangeError);
    expect(() => gas({ startMl: 0 })).toThrow(RangeError);
  });
  it('매니페스트의 모든 조합(3×3×3×2)에서 V ≤ 60', () => {
    const exp = parseManifest(gasManifestJson).experiments[0]! as VariableExperiment;
    const o = (k: string) => exp.variables.find((v) => v.key === k)!.options.map((x) => x.value);
    let n = 0;
    let max = 0;
    for (const push of o('push'))
      for (const bathTempC of o('bathTempC'))
        for (const gasType of o('gasType'))
          for (const startMl of o('startMl')) {
            const { samples } = simulateGas({ push, bathTempC, gasType, startMl } as GasParams);
            for (const s of samples) max = Math.max(max, s.volumeMl);
            n++;
          }
    expect(n).toBe(54);
    expect(max).toBeLessThanOrEqual(60);
    expect(max).toBeCloseTo((50 * 333.15) / 293.15, 0);
  });
});

describe('interpolateGas', () => {
  it('선형 보간', () => {
    const a = { t: 0, volumeMl: 10, pressureAtm: 1, gasTempC: 20 };
    const b = { t: 2, volumeMl: 20, pressureAtm: 2, gasTempC: 40 };
    expect(interpolateGas(a, b, 0.5)).toEqual({ t: 1, volumeMl: 15, pressureAtm: 1.5, gasTempC: 30 });
  });
});

describe('validateGasExperiment', () => {
  const clone = () => parseManifest(JSON.parse(JSON.stringify(gasManifestJson))).experiments[0]! as VariableExperiment;
  it('실제 매니페스트는 통과', () => {
    expect(validateGasExperiment(clone())).toEqual([]);
  });
  it('변인이 없거나 값이 범위 밖이면 오류', () => {
    const noKey = clone();
    noKey.variables = noKey.variables.filter((v) => v.key !== 'gasType');
    expect(validateGasExperiment(noKey).join()).toContain('gasType');
    const badTemp = clone();
    badTemp.variables.find((v) => v.key === 'bathTempC')!.options.push({ value: 99, label: '99' });
    expect(validateGasExperiment(badTemp).join()).toContain('0~80');
    const badGas = clone();
    badGas.variables.find((v) => v.key === 'gasType')!.options.push({ value: 'neon', label: '네온' });
    expect(validateGasExperiment(badGas).length).toBeGreaterThan(0);
    const badPush = clone();
    badPush.variables.find((v) => v.key === 'push')!.options.push({ value: 3, label: '3' });
    expect(validateGasExperiment(badPush).length).toBeGreaterThan(0);
    const badStart = clone();
    badStart.variables.find((v) => v.key === 'startMl')!.options.push({ value: 0, label: '0' });
    expect(validateGasExperiment(badStart).length).toBeGreaterThan(0);
  });
  it('최대 조합 부피가 syringeMaxMl을 넘으면 오류', () => {
    const e = clone();
    e.params = { syringeMaxMl: 50 };
    expect(validateGasExperiment(e).join()).toContain('주사기 눈금');
    e.params = {};
    expect(validateGasExperiment(e).join()).toContain('syringeMaxMl');
  });
});

describe('interpolateDissolution', () => {
  it('넣은 양은 계단식이다', () => {
    const a = { t: 0, addedG: 2, dissolvedG: 0, undissolvedG: 2 };
    const b = { t: 10, addedG: 4, dissolvedG: 3, undissolvedG: 1 };
    expect(interpolateDissolution(a, b, 0.5).addedG).toBe(2);
    expect(interpolateDissolution(a, b, 1).addedG).toBe(4);
  });
});

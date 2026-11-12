import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  GAS_BASE_G,
  GAS_CAPS,
  GAS_LABELS,
  GAS_PER_PUMP_G,
  GAS_PUMPS,
  GAS_X_MAX,
  GAS_Y_MAX_G,
  GAS_Y_MIN_G,
  interpolateGasWeight,
  simulateGasWeight,
  validateGasWeightExperiment,
  weightOfPressed,
  type GasCap,
  type GasFirm,
  type GasWeightParams,
} from './gasWeight';
import gasesJson from '../../../../content/units/g4-gases/manifest.json';

const p = (pumps: number, cap: GasCap = 'closed', label: 'red' | 'blue' = 'red'): GasWeightParams => ({ pumps, cap, label });

// 사양 §3 표: [누른 횟수, 닫아 둔 병의 무게(g), 단단함]
const CLOSED: [number, number, GasFirm][] = [
  [0, 45.3, 'soft'],
  [20, 45.8, 'slight'],
  [40, 46.3, 'firm'],
  [60, 46.8, 'hard'],
];

describe('공기를 넣은 페트병 모델: 45.3 + 0.025 × 횟수', () => {
  it('상수: 처음 45.3 g, 한 번에 0.025 g', () => {
    expect([GAS_BASE_G, GAS_PER_PUMP_G]).toEqual([45.3, 0.025]);
  });

  for (const label of GAS_LABELS) {
    for (const [pumps, weight, firm] of CLOSED) {
      it(`${label} 마개 닫음 ${pumps}번: ${weight} g · ${firm}`, () => {
        expect(simulateGasWeight(p(pumps, 'closed', label)).result).toEqual({ weight, firm });
      });
      it(`${label} 마개 열음 ${pumps}번: 횟수와 상관없이 45.3 g · 말랑함`, () => {
        expect(simulateGasWeight(p(pumps, 'open', label)).result).toEqual({ weight: 45.3, firm: 'soft' });
      });
    }
  }

  it('반올림 경계: 소수 첫째 자리 값이 정확히 떨어진다(20번마다 0.5 g)', () => {
    for (const [pumps, weight] of CLOSED) {
      const w = simulateGasWeight(p(pumps)).result.weight;
      expect(w).toBe(weight);
      expect(Math.abs(w * 10 - Math.round(w * 10))).toBeLessThan(1e-9);
    }
    // 저울 떨림이 없다: 같은 조건은 언제나 같은 값이다.
    expect(simulateGasWeight(p(40))).toEqual(simulateGasWeight(p(40)));
  });

  it('대조 변인: 띠지 색깔은 결과와 모든 표본에 영향이 없다', () => {
    for (const pumps of GAS_PUMPS) for (const cap of GAS_CAPS) expect(simulateGasWeight(p(pumps, cap, 'red'))).toEqual(simulateGasWeight(p(pumps, cap, 'blue')));
  });

  it('무게는 누른 횟수에 대해 늘기만 하고(닫아 둘 때), 마개를 열면 늘지 않는다', () => {
    const w = GAS_PUMPS.map((n) => simulateGasWeight(p(n)).result.weight);
    expect(w).toEqual([...w].sort((a, b) => a - b));
    expect(new Set(w).size).toBe(4);
    expect(new Set(GAS_PUMPS.map((n) => simulateGasWeight(p(n, 'open')).result.weight)).size).toBe(1);
  });
});

describe('표본: 가로축은 누른 횟수 0~60', () => {
  it('61개 표본(1회마다), 정한 횟수까지만 누르고 그 뒤에는 무게와 팽팽함이 그대로이다', () => {
    const sim = simulateGasWeight(p(20));
    expect(sim.samples).toHaveLength(GAS_X_MAX + 1);
    expect(sim.samples.map((s) => s.t)).toEqual(Array.from({ length: 61 }, (_, i) => i));
    expect(sim.samples[0]).toMatchObject({ t: 0, pressed: 0, weight: 45.3, taut: 0 });
    expect(sim.samples[20]).toMatchObject({ pressed: 20, weight: 45.8 });
    for (const s of sim.samples.filter((x) => x.t >= 20)) expect(s).toMatchObject({ pressed: 20, weight: 45.8 });
    expect(sim.samples.at(-1)!.weight).toBe(sim.result.weight);
  });
  it('0번이면 누르지 않아 모든 표본이 처음 무게이다', () => {
    expect(simulateGasWeight(p(0)).samples.every((s) => s.pressed === 0 && s.weight === 45.3 && s.taut === 0)).toBe(true);
  });
  it('팽팽함(taut)은 닫아 둔 병이 누른 횟수 ÷ 60이고, 마개를 열면 언제나 0이다', () => {
    expect(simulateGasWeight(p(60)).samples.at(-1)!.taut).toBe(1);
    expect(simulateGasWeight(p(40)).samples.at(-1)!.taut).toBeCloseTo(2 / 3, 8);
    expect(simulateGasWeight(p(60, 'open')).samples.every((s) => s.taut === 0)).toBe(true);
  });
  it('무게는 그래프 세로축(45.0~47.0 g) 안에 있다', () => {
    for (const pumps of GAS_PUMPS) for (const cap of GAS_CAPS) for (const s of simulateGasWeight(p(pumps, cap)).samples) {
      expect(s.weight).toBeGreaterThanOrEqual(GAS_Y_MIN_G);
      expect(s.weight).toBeLessThanOrEqual(GAS_Y_MAX_G);
    }
    expect(weightOfPressed(60)).toBeCloseTo(46.8, 9);
  });
});

describe('보간·검사', () => {
  it('두 표본 사이를 선형으로 보간한다', () => {
    const a = { t: 0, pressed: 0, weight: 45, taut: 0 };
    const b = { t: 10, pressed: 10, weight: 46, taut: 1 };
    expect(interpolateGasWeight(a, b, 0.5)).toEqual({ t: 5, pressed: 5, weight: 45.5, taut: 0.5 });
  });
  it('모델 밖의 값은 RangeError', () => {
    expect(() => simulateGasWeight(p(10))).toThrow(RangeError);
    expect(() => simulateGasWeight(p(0, 'x' as never))).toThrow(RangeError);
    expect(() => simulateGasWeight(p(0, 'closed', 'x' as never))).toThrow(RangeError);
  });
  it('매니페스트 검사: 저장소의 활동 2는 통과하고, 없는 변인·모르는 값은 잡는다', () => {
    const exp = (gasesJson.experiments as unknown as VariableExperiment[]).find((e) => e.id === 'gas-weight')!;
    expect(validateGasWeightExperiment(exp)).toEqual([]);
    expect(validateGasWeightExperiment({ ...exp, variables: exp.variables.filter((v) => v.key !== 'cap') })).toHaveLength(1);
    const bad = structuredClone(exp);
    bad.variables[0]!.options[0]!.value = 10;
    expect(validateGasWeightExperiment(bad).join()).toContain('10');
  });
});

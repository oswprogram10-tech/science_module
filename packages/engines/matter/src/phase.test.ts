import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { coolMin, endMin, frozenAt, interpolatePhase, simulatePhase, tempAt, validatePhaseExperiment, type PhaseParams, type PhaseProcess, type PhaseTube } from './phase';
import phaseJson from '../../../../content/units/g4-water-state/manifest.json';

const p = (process: PhaseProcess, startMl: number, tube: PhaseTube = 'glass'): PhaseParams => ({ process, startMl, tube });
const TUBES: PhaseTube[] = ['glass', 'plastic'];

// 사양 §2.1: [과정, 처음 양, 부피 변화, 나중 부피, 무게]
const TABLE: [PhaseProcess, number, number, number, string][] = [
  ['freeze', 10, 0.9, 10.9, '10.0 g → 10.0 g'],
  ['freeze', 20, 1.8, 21.8, '20.0 g → 20.0 g'],
  ['melt', 10, -0.9, 10.0, '10.0 g → 10.0 g'],
  ['melt', 20, -1.8, 20.0, '20.0 g → 20.0 g'],
];

describe('상태 변화 모델: 사양 기준값 4칸 × 시험관 두 가지', () => {
  for (const tube of TUBES) {
    for (const [process, ml, dV, volumeEnd, mass] of TABLE) {
      it(`${tube} ${process} ${ml} mL → ${dV}, ${volumeEnd}, ${mass}`, () => {
        const r = simulatePhase(p(process, ml, tube)).result;
        expect(r.dV).toBe(dV);
        expect(r.volumeEnd).toBe(volumeEnd);
        expect(r.mass).toBe(mass);
        expect(r.massStart).toBe(ml);
        expect(r.massEnd).toBe(ml);
      });
    }
  }

  it('시험관만 바꾸면 결과와 샘플이 완전히 같다', () => {
    for (const process of ['freeze', 'melt'] as const) {
      for (const ml of [10, 20]) {
        expect(simulatePhase(p(process, ml, 'plastic'))).toEqual(simulatePhase(p(process, ml, 'glass')));
      }
    }
  });

  it('시간 구간: 10 mL는 4/14분, 20 mL는 6/26분', () => {
    expect([coolMin(10), endMin(10), coolMin(20), endMin(20)]).toEqual([4, 14, 6, 26]);
  });

  it('샘플: 0.1분 간격, 마지막은 30분, 301개', () => {
    const s = simulatePhase(p('freeze', 10)).samples;
    expect(s).toHaveLength(301);
    expect(s[0]!.t).toBe(0);
    expect(s[1]!.t).toBe(0.1);
    expect(s.at(-1)!.t).toBe(30);
  });

  it('얼리기의 부피 변화는 단조 비감소, 녹이기는 단조 비증가', () => {
    for (const ml of [10, 20]) {
      const f = simulatePhase(p('freeze', ml)).samples;
      const m = simulatePhase(p('melt', ml)).samples;
      expect(f[0]!.dV).toBe(0);
      expect(m[0]!.dV).toBe(0);
      for (let i = 1; i < f.length; i++) {
        expect(f[i]!.dV).toBeGreaterThanOrEqual(f[i - 1]!.dV);
        expect(m[i]!.dV).toBeLessThanOrEqual(m[i - 1]!.dV);
      }
    }
  });

  it('식기 시작하는 때까지 부피는 그대로이고, 얼린 몫이 0 → 1(얼리기) 또는 1 → 0(녹이기)이다', () => {
    const f = simulatePhase(p('freeze', 10)).samples;
    expect(f.filter((s) => s.t <= 4).every((s) => s.dV === 0 && s.frozen === 0)).toBe(true);
    expect(f.find((s) => s.t === 9)!.frozen).toBeCloseTo(0.5, 9);
    expect(f.filter((s) => s.t >= 14).every((s) => s.frozen === 1)).toBe(true);
    const m = simulatePhase(p('melt', 10)).samples;
    expect(m[0]!.frozen).toBe(1);
    expect(m.filter((s) => s.t >= 14).every((s) => s.frozen === 0)).toBe(true);
    expect(frozenAt('melt', 20, 16)).toBeCloseTo(0.5, 9);
  });

  it('tCool ~ tEnd 동안 온도는 0 °C이다', () => {
    for (const process of ['freeze', 'melt'] as const) {
      for (const ml of [10, 20]) {
        const inside = simulatePhase(p(process, ml)).samples.filter((s) => s.t >= coolMin(ml) && s.t <= endMin(ml));
        expect(inside.length).toBeGreaterThan(50);
        for (const s of inside) expect(s.tempC).toBe(0);
      }
    }
  });

  it('온도: 얼리기 20 → 0 → −10 쪽, 녹이기 −8 → 0 → 25 쪽', () => {
    const f = simulatePhase(p('freeze', 10)).samples;
    expect(f[0]!.tempC).toBe(20);
    expect(f.at(-1)!.tempC).toBeCloseTo(-10 + 10 * Math.exp(-16 / 3), 9);
    expect(f.at(-1)!.tempC).toBeLessThan(-9);
    const m = simulatePhase(p('melt', 10)).samples;
    expect(m[0]!.tempC).toBe(-8);
    expect(m.at(-1)!.tempC).toBeCloseTo(25 - 25 * Math.exp(-16 / 8), 9);
    expect(tempAt('freeze', 10, 2)).toBe(10);
  });

  it('모든 샘플의 무게가 같다(처음 양 g)', () => {
    for (const process of ['freeze', 'melt'] as const) {
      for (const ml of [10, 20]) {
        for (const s of simulatePhase(p(process, ml)).samples) expect(s.massG).toBe(ml);
      }
    }
  });

  it('부피 = 처음 양 × (1 + 0.09 × 얼린 몫)', () => {
    for (const s of simulatePhase(p('melt', 20)).samples) expect(s.volume).toBeCloseTo(20 * (1 + 0.09 * s.frozen), 12);
  });

  it('범위 밖 값은 거부한다', () => {
    expect(() => simulatePhase(p('freeze', 4))).toThrow(RangeError);
    expect(() => simulatePhase(p('freeze', 26))).toThrow(RangeError);
    expect(() => simulatePhase(p('boil' as PhaseProcess, 10))).toThrow(RangeError);
    expect(() => simulatePhase(p('freeze', 10, 'steel' as PhaseTube))).toThrow(RangeError);
    // 25 mL는 tEnd = 32분이라 30분 안에 끝나지 않는다
    expect(() => simulatePhase(p('freeze', 25))).toThrow(RangeError);
  });

  it('보간은 양 끝에서 각 샘플, 가운데에서 평균이다', () => {
    const s = simulatePhase(p('freeze', 10)).samples;
    const a = s[50]!;
    const b = s[51]!;
    expect(interpolatePhase(a, b, 0)).toEqual(a);
    expect(interpolatePhase(a, b, 1)).toEqual(b);
    expect(interpolatePhase(a, b, 0.5).dV).toBeCloseTo((a.dV + b.dV) / 2, 12);
  });
});

describe('validatePhaseExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify((phaseJson as { experiments: unknown[] }).experiments[0])) as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validatePhaseExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류', () => {
    const noTube = exp();
    noTube.variables = noTube.variables.filter((v) => v.key !== 'tube');
    expect(validatePhaseExperiment(noTube).join(' ')).toContain('"tube"');
    const bad = exp();
    bad.variables.find((v) => v.key === 'startMl')!.options.push({ value: 30, label: '30 mL' });
    expect(validatePhaseExperiment(bad).join(' ')).toContain('5~25');
    const late = exp();
    late.variables.find((v) => v.key === 'startMl')!.options.push({ value: 25, label: '25 mL' });
    expect(validatePhaseExperiment(late).join(' ')).toContain('시행 길이');
    const proc = exp();
    proc.variables.find((v) => v.key === 'process')!.options.push({ value: 'boil', label: '끓이기' });
    expect(validatePhaseExperiment(proc).length).toBe(1);
    const noTotal = exp();
    noTotal.params = {};
    expect(validatePhaseExperiment(noTotal).join(' ')).toContain('totalMin');
  });
});

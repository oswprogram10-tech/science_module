import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  simulateCombustion,
  validateCombustionExperiment,
  type CombustionParams,
} from './combustion';
import combustionJson from '../../../../content/units/g6-combustion/manifest.json';

const base: CombustionParams = { jarMl: 500, candle: 'thin', candleCount: 1, candleColor: 'white' };
const run = (p: Partial<CombustionParams> = {}) => simulateCombustion({ ...base, ...p });
/** 반올림 전 꺼진 시각: 처음으로 lit = 0이 되는 샘플의 t */
const exactOut = (p: Partial<CombustionParams> = {}) => run(p).samples.find((s) => s.lit === 0)!.t;
const within = (a: number, b: number, rel = 0.01) => Math.abs(a - b) / b <= rel;

describe('연소 모델', () => {
  it('기준값: 가는 초 1개, 500 mL에서 17.2초에 꺼진다 (15~25초)', () => {
    const r = run().result;
    expect(r.extinguishS).toBeGreaterThanOrEqual(15);
    expect(r.extinguishS).toBeLessThanOrEqual(25);
    expect(r).toEqual({ extinguishS: 17.2, oxygenEndPct: 16, co2EndPct: 3.54, usedOxygenMl: 25 });
    expect(run({ jarMl: 1000 }).result.usedOxygenMl).toBe(50);
    expect(run({ candleCount: 2 }).result.usedOxygenMl).toBe(25);
  });

  it('집기병 250 → 500 → 1000 mL: 걸린 시간이 크기에 정확히 비례한다', () => {
    const t250 = exactOut({ jarMl: 250 });
    const t500 = exactOut({ jarMl: 500 });
    const t1000 = exactOut({ jarMl: 1000 });
    expect(within(t500, t250 * 2)).toBe(true);
    expect(within(t1000, t250 * 4)).toBe(true);
    expect(run({ jarMl: 250 }).result.extinguishS).toBeLessThan(run().result.extinguishS);
  });

  it('초 2개는 1개의 절반 시간, 굵은 초는 가는 초의 2.5/4.0배 시간', () => {
    for (const jarMl of [250, 500, 1000]) {
      const one = exactOut({ jarMl });
      expect(within(exactOut({ jarMl, candleCount: 2 }), one / 2)).toBe(true);
      expect(within(exactOut({ jarMl, candle: 'thick' }), (one * 2.5) / 4.0)).toBe(true);
    }
  });

  it('색깔만 바꾸면 결과가 똑같다', () => {
    expect(run({ candleColor: 'red' })).toEqual(run({ candleColor: 'white' }));
  });

  it('산소 비율은 단조 감소하고 out 아래로 내려가지 않으며 이산화 탄소는 단조 증가한다', () => {
    for (const jarMl of [250, 1000]) {
      for (const candle of ['thin', 'thick'] as const) {
        const { samples } = run({ jarMl, candle, candleCount: 2 });
        expect(samples[0]!.oxygenPct).toBe(21);
        expect(samples[0]!.co2Pct).toBeCloseTo(0.04, 10);
        for (let i = 1; i < samples.length; i++) {
          const a = samples[i - 1]!;
          const b = samples[i]!;
          expect(b.t).toBeGreaterThan(a.t);
          expect(b.oxygenPct).toBeLessThanOrEqual(a.oxygenPct);
          expect(b.co2Pct).toBeGreaterThanOrEqual(a.co2Pct);
          expect(b.fog).toBeGreaterThanOrEqual(a.fog);
          expect(b.oxygenPct).toBeGreaterThanOrEqual(16);
        }
        // 불이 켜진 동안에는 엄격하게 감소·증가
        const lit = samples.filter((s) => s.lit === 1);
        for (let i = 1; i < lit.length; i++) {
          expect(lit[i]!.oxygenPct).toBeLessThan(lit[i - 1]!.oxygenPct);
          expect(lit[i]!.co2Pct).toBeGreaterThan(lit[i - 1]!.co2Pct);
        }
      }
    }
  });

  it('꺼진 뒤 샘플은 flame = 0, lit = 0이고 tailS(3초) 동안 이어진다', () => {
    const { samples, result } = run();
    const out = samples.filter((s) => s.lit === 0);
    expect(out.length).toBeGreaterThan(5);
    for (const s of out) {
      expect(s.flame).toBe(0);
      expect(s.oxygenPct).toBeCloseTo(16, 10);
    }
    const tOut = out[0]!.t;
    expect(samples[samples.length - 1]!.t).toBeCloseTo(tOut + 3, 6);
    expect(Math.round(tOut * 10) / 10).toBe(result.extinguishS);
    // 켜진 샘플은 모두 불꽃이 있다
    for (const s of samples.filter((x) => x.lit === 1)) expect(s.flame).toBeGreaterThan(0);
  });

  it('난수가 없다: 두 번 돌려도 같다', () => {
    expect(run({ candle: 'thick', candleCount: 2 })).toEqual(run({ candle: 'thick', candleCount: 2 }));
  });

  it('범위 밖 입력은 RangeError', () => {
    expect(() => run({ jarMl: 50 })).toThrow(RangeError);
    expect(() => run({ jarMl: 6000 })).toThrow(RangeError);
    expect(() => run({ candleCount: 5 })).toThrow(RangeError);
    expect(() => run({ candleCount: 1.5 })).toThrow(RangeError);
    expect(() => run({ candle: 'huge' as 'thin' })).toThrow(RangeError);
    expect(() => simulateCombustion(base, { oxygenStartPct: 16, oxygenOutPct: 16 })).toThrow(RangeError);
  });
});

describe('validateCombustionExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(combustionJson.experiments[0])) as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validateCombustionExperiment(exp())).toEqual([]);
  });

  it('변인 누락·범위 밖 값·params 오류를 찾아낸다', () => {
    const noJar = exp();
    noJar.variables = noJar.variables.filter((v) => v.key !== 'jarMl');
    expect(validateCombustionExperiment(noJar).join()).toContain('jarMl');

    const bigJar = exp();
    bigJar.variables.find((v) => v.key === 'jarMl')!.options.push({ value: 9000, label: '아주 큼' });
    expect(validateCombustionExperiment(bigJar).join()).toContain('9000');

    const badCandle = exp();
    badCandle.variables.find((v) => v.key === 'candle')!.options[0]!.value = 'fat';
    expect(validateCombustionExperiment(badCandle).join()).toContain('fat');

    const badCount = exp();
    badCount.variables.find((v) => v.key === 'candleCount')!.options.push({ value: 5, label: '5개' });
    expect(validateCombustionExperiment(badCount).join()).toContain('candleCount');

    const badParams = exp();
    badParams.params = { oxygenStartPct: 16, oxygenOutPct: 16 };
    expect(validateCombustionExperiment(badParams).join()).toContain('oxygenStartPct');
  });
});

import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  interpolateConvexLens,
  simulateConvexLens,
  traceRay,
  validateConvexLensExperiment,
  type ConvexLensParams,
} from './optics';
import lightJson from '../../../../content/units/g5-light/manifest.json';

const SUN = 0.0093;
const run = (p: ConvexLensParams) => simulateConvexLens(p);
const lens = (curve: 'low' | 'high', diameterCm: number, distanceCm: number): ConvexLensParams => ({ curve, diameterCm, distanceCm });

// 사양 §2.3의 16칸: [볼록한 정도, 지름, 거리, spotMm, 배율, endC, 그을림]
const TABLE: [ 'low' | 'high', number, number, number, number, number, boolean ][] = [
  ['high', 4, 5, 20.0, 4, 30.0, false],
  ['high', 4, 10, 0.9, 1850, 235.1, true],
  ['high', 4, 15, 20.0, 4, 30.0, false],
  ['high', 4, 20, 40.0, 1, 25.0, false],
  ['high', 8, 5, 40.0, 4, 30.0, false],
  ['high', 8, 10, 0.9, 7400, 320.0, true],
  ['high', 8, 15, 40.0, 4, 30.0, false],
  ['high', 8, 20, 80.0, 1, 25.0, false],
  ['low', 4, 5, 26.7, 2, 27.5, false],
  ['low', 4, 10, 13.3, 9, 35.0, false],
  ['low', 4, 15, 1.4, 822, 163.4, false],
  ['low', 4, 20, 13.3, 9, 35.0, false],
  ['low', 8, 5, 53.3, 2, 27.5, false],
  ['low', 8, 10, 26.7, 9, 35.0, false],
  ['low', 8, 15, 1.4, 3289, 306.7, true],
  ['low', 8, 20, 26.7, 9, 35.0, false],
];

describe('볼록 렌즈 모델: 사양 기준값 16칸', () => {
  for (const [curve, d, dist, spot, conc, endC, scorched] of TABLE) {
    it(`${curve} 지름 ${d} cm, 거리 ${dist} cm`, () => {
      const r = run(lens(curve, d, dist)).result;
      expect(Math.abs(r.spotMm - spot)).toBeLessThanOrEqual(0.1);
      expect(r.concentration).toBe(conc);
      expect(Math.abs(r.endC - endC)).toBeLessThanOrEqual(0.1);
      expect(r.scorched).toBe(scorched);
    });
  }
});

describe('볼록 렌즈 모델: 성질', () => {
  const distances = Array.from({ length: 59 }, (_, i) => 1 + i * 0.5); // 1~30 cm

  it('같은 렌즈에서 온도가 가장 높은 거리는 f다 (해 크기 때문에 f 바로 옆 0.5 cm까지는 같을 수 있다)', () => {
    for (const [curve, f] of [['high', 10], ['low', 15]] as const) {
      for (const dia of [4, 8]) {
        const temps = distances.map((d) => run(lens(curve, dia, d)).result.endC);
        const max = Math.max(...temps);
        expect(run(lens(curve, dia, f)).result.endC).toBe(max);
        // 최댓값을 내는 거리는 모두 f에서 0.5 cm 이내이고, 그 밖은 모두 더 낮다.
        distances.forEach((d, i) => {
          if (temps[i] === max) expect(Math.abs(d - f)).toBeLessThanOrEqual(0.5);
          else expect(temps[i]).toBeLessThan(max);
        });
        // f에서 1 cm 이상 떨어지면 반드시 더 낮다.
        expect(run(lens(curve, dia, f - 1)).result.endC).toBeLessThan(max);
        expect(run(lens(curve, dia, f + 1)).result.endC).toBeLessThan(max);
      }
    }
  });

  it('f에서 같은 거리만큼 가깝거나 먼 두 위치는 원 지름과 온도가 같다', () => {
    for (const [curve, f] of [['high', 10], ['low', 15]] as const) {
      for (const off of [1, 2.5, 5, 7.5]) {
        const a = run(lens(curve, 8, f - off)).result;
        const b = run(lens(curve, 8, f + off)).result;
        expect(a.spotMm).toBeCloseTo(b.spotMm, 6);
        expect(a.endC).toBeCloseTo(b.endC, 6);
      }
    }
  });

  it('f가 아닌 거리에서는 지름만 바꿔도 밝기와 온도가 같고, f에서는 큰 렌즈가 더 뜨겁다', () => {
    for (const curve of ['low', 'high'] as const) {
      const f = curve === 'high' ? 10 : 15;
      for (const dist of [5, 7, 20, 25]) {
        if (dist === f) continue;
        const small = run(lens(curve, 4, dist)).result;
        const big = run(lens(curve, 8, dist)).result;
        expect(big.concentration).toBe(small.concentration);
        expect(big.endC).toBe(small.endC);
      }
      expect(run(lens(curve, 8, f)).result.endC).toBeGreaterThan(run(lens(curve, 4, f)).result.endC);
    }
  });

  it('spotMm는 f·10·sunAngle보다 작아지지 않는다', () => {
    for (const curve of ['low', 'high'] as const) {
      const f = curve === 'high' ? 10 : 15;
      for (const dist of distances) {
        // 표시값은 소수 첫째 자리 반올림이므로 반올림 오차(0.05)만큼 허용한다.
        expect(run(lens(curve, 4, dist)).result.spotMm).toBeGreaterThanOrEqual(f * 10 * SUN - 0.05);
      }
    }
  });

  it('샘플의 spotC는 단조 증가하고 roomC 이상 roomC+riseC 이하다', () => {
    for (const [curve, d, dist, , , endC] of TABLE) {
      const { samples } = run(lens(curve, d, dist));
      expect(samples[0]!.spotC).toBe(20);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.spotC).toBeGreaterThanOrEqual(samples[i - 1]!.spotC);
      const top = samples.at(-1)!.spotC;
      expect(top).toBeGreaterThanOrEqual(20);
      expect(top).toBeLessThanOrEqual(endC + 0.1);
      expect(samples.at(-1)!.t).toBe(60);
      expect(samples).toHaveLength(121);
    }
  });

  it('최대 상승은 300 °C로 제한되고, 그을림은 230 °C 이상에서 1이다', () => {
    const { samples, result } = run(lens('high', 8, 10));
    expect(result.endC).toBe(320);
    expect(samples.every((s) => s.scorched === (s.spotC >= 230 ? 1 : 0))).toBe(true);
    expect(samples[0]!.scorched).toBe(0);
    expect(samples.at(-1)!.scorched).toBe(1);
  });

  it('같은 입력은 같은 출력이다 (난수 없음)', () => {
    expect(run(lens('low', 4, 15))).toEqual(run(lens('low', 4, 15)));
  });

  it('범위를 벗어난 입력은 RangeError', () => {
    expect(() => run(lens('high', 4, 0))).toThrow(RangeError);
    expect(() => run(lens('high', 4, 51))).toThrow(RangeError);
    expect(() => run(lens('high', 0.5, 5))).toThrow(RangeError);
    expect(() => run(lens('high', 21, 5))).toThrow(RangeError);
    expect(() => run({ ...lens('high', 4, 5), curve: 'x' as 'low' })).toThrow(RangeError);
  });

  it('보간은 두 샘플 사이를 선형으로 잇는다', () => {
    const m = interpolateConvexLens({ t: 0, spotC: 20, scorched: 0 }, { t: 10, spotC: 40, scorched: 1 }, 0.25);
    expect(m).toEqual({ t: 2.5, spotC: 25, scorched: 0.25 });
  });
});

describe('traceRay', () => {
  it('높이 y로 들어온 광선은 d=f에서 0에 닿는다', () => {
    for (const f of [10, 15]) for (const y of [-40, -13.3, 0, 20, 40]) expect(traceRay(y, f, f).xAtPaperMm).toBeCloseTo(0, 9);
  });

  it('d=2f에서 −y에 닿는다', () => {
    for (const f of [10, 15]) for (const y of [-40, 20, 40]) expect(traceRay(y, f, 2 * f).xAtPaperMm).toBeCloseTo(-y, 9);
  });

  it('렌즈에 붙은 종이(d=0)에서는 들어온 높이 그대로다', () => {
    expect(traceRay(25, 10, 0).xAtPaperMm).toBe(25);
  });

  it('가장 바깥 광선이 종이에서 만드는 폭은 기하 지름과 같다', () => {
    for (const [curve, f] of [['high', 10], ['low', 15]] as const) {
      for (const dia of [4, 8]) {
        for (const d of [5, 10, 15, 20]) {
          const width = 2 * Math.abs(traceRay((dia / 2) * 10, f, d).xAtPaperMm);
          expect(width).toBeCloseTo((dia * 10 * Math.abs(d - f)) / f, 9);
          // 해 크기 보정 전의 값이므로 표의 원 지름은 이 값 이상이다.
          expect(run(lens(curve, dia, d)).result.spotMm).toBeGreaterThanOrEqual(Math.round(width * 10) / 10 - 0.05);
        }
      }
    }
  });
});

describe('볼록 렌즈 매니페스트 검증', () => {
  const exp = (lightJson as unknown as { experiments: VariableExperiment[] }).experiments[0]!;
  const clone = (): VariableExperiment => JSON.parse(JSON.stringify(exp));

  it('g5-light 매니페스트는 통과한다', () => {
    expect(validateConvexLensExperiment(exp)).toEqual([]);
  });

  it('변인이 없으면 오류', () => {
    const e = clone();
    e.variables = e.variables.filter((v) => v.key !== 'curve');
    expect(validateConvexLensExperiment(e)).toEqual(['변인 "curve"이(가) 없습니다.']);
  });

  it('허용 범위를 벗어난 값은 오류', () => {
    const e = clone();
    e.variables.find((v) => v.key === 'distanceCm')!.options.push({ value: 51, label: '51 cm' });
    e.variables.find((v) => v.key === 'diameterCm')!.options.push({ value: 21, label: '21 cm' });
    e.variables.find((v) => v.key === 'curve')!.options.push({ value: 'mid', label: '중간' });
    expect(validateConvexLensExperiment(e)).toHaveLength(3);
  });
});

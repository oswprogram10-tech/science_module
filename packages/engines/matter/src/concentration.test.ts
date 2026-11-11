import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  COLOR_MAX,
  CONC_CUPS,
  CONC_SPOONS,
  CONC_SUGARS,
  CONC_WATERS,
  FLOAT_MAX,
  colorLevelOf,
  densityOf,
  floatLevelOf,
  interpolateConcentration,
  mass20Of,
  simulateConcentration,
  sugarFraction,
  validateConcentrationExperiment,
  type ConcCup,
  type ConcSugar,
  type ConcentrationParams,
} from './concentration';
import solutionJson from '../../../../content/units/g5-solution/manifest.json';

const p = (spoons: number, waterMl: number, sugar: ConcSugar = 'brown', cup: ConcCup = 'low'): ConcentrationParams => ({ spoons, waterMl, sugar, cup });

// 사양 §4 표 고정: [물(mL), 숟가락, 뜬 높이, 20 mL의 무게(g), 황설탕 색의 진하기]
const TABLE: [number, number, number, number, number][] = [
  [100, 1, 0, 20.4, 2],
  [100, 3, 4, 21.0, 5],
  [100, 5, 9, 21.5, 8],
  [50, 1, 1, 20.7, 4],
  [50, 3, 10, 21.8, 9],
  [50, 5, 10, 22.5, 10],
];

describe('용액의 진하기 비교 모델: 사양 기준값 6칸 × 설탕 종류·비커 모양', () => {
  for (const sugar of CONC_SUGARS) {
    for (const cup of CONC_CUPS) {
      for (const [water, spoons, float, mass, color] of TABLE) {
        it(`${sugar} ${cup} ${spoons}숟가락 ${water} mL: 뜬 높이 ${float}, ${mass} g`, () => {
          expect(simulateConcentration(p(spoons, water, sugar, cup)).result).toEqual({ float, mass20: mass, color: sugar === 'brown' ? color : 0 });
        });
      }
    }
  }

  it('사양 표(100 mL): 1숟가락 c = 4.8 %·ρ = 1.018 → 0·20.4 g, 3숟가락 13.0 %·1.049 → 4·21.0 g, 5숟가락 20.0 %·1.076 → 9·21.5 g', () => {
    expect([sugarFraction(p(1, 100)), sugarFraction(p(3, 100)), sugarFraction(p(5, 100))].map((c) => Math.round(c * 1000) / 10)).toEqual([4.8, 13, 20]);
    expect([densityOf(p(1, 100)), densityOf(p(3, 100)), densityOf(p(5, 100))].map((x) => Math.round(x * 1000) / 1000)).toEqual([1.018, 1.05, 1.076]);
    // ρ(3숟가락) = 1.0496 은 사양의 근삿값 1.049와 반올림 자리만 다르다(뜬 높이는 같은 4).
    expect(densityOf(p(3, 100))).toBeCloseTo(1.0496, 4);
  });

  it('사양 표(50 mL): 1숟가락 c = 9.1 % → 1, 3·5숟가락 → 10 (상한)', () => {
    expect(Math.round(sugarFraction(p(1, 50)) * 1000) / 10).toBe(9.1);
    expect([1, 3, 5].map((s) => floatLevelOf(p(s, 50)))).toEqual([1, 10, 10]);
  });

  it('모든 조건(24가지)에서 뜬 높이는 0~10 정수, 색은 0~10 정수, 무게는 소수 첫째 자리다', () => {
    for (const s of CONC_SPOONS) for (const w of CONC_WATERS) for (const sugar of CONC_SUGARS) {
      const r = simulateConcentration(p(s, w, sugar)).result;
      expect(Number.isInteger(r.float) && r.float >= 0 && r.float <= FLOAT_MAX).toBe(true);
      expect(Number.isInteger(r.color) && r.color >= 0 && r.color <= COLOR_MAX).toBe(true);
      expect(Math.round(r.mass20 * 10) / 10).toBe(r.mass20);
    }
  });

  it('비커 모양은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const s of CONC_SPOONS) for (const w of CONC_WATERS) for (const sugar of CONC_SUGARS) expect(simulateConcentration(p(s, w, sugar, 'high'))).toEqual(simulateConcentration(p(s, w, sugar, 'low')));
  });

  it('설탕 종류는 색의 진하기만 바꾼다: 흰 설탕은 0, 뜬 높이와 무게는 같다', () => {
    for (const s of CONC_SPOONS) for (const w of CONC_WATERS) {
      const brown = simulateConcentration(p(s, w, 'brown')).result;
      const white = simulateConcentration(p(s, w, 'white')).result;
      expect(white.color).toBe(0);
      expect(white.float).toBe(brown.float);
      expect(white.mass20).toBe(brown.mass20);
    }
  });

  it('물을 줄이면(설탕은 같게) 뜬 높이·무게·색이 모두 같거나 커진다, 설탕을 늘려도 같다', () => {
    for (const s of CONC_SPOONS) {
      const a = simulateConcentration(p(s, 100)).result;
      const b = simulateConcentration(p(s, 50)).result;
      expect(b.float).toBeGreaterThanOrEqual(a.float);
      expect(b.mass20).toBeGreaterThan(a.mass20);
      expect(b.color).toBeGreaterThan(a.color);
    }
    for (const w of CONC_WATERS) {
      const r = CONC_SPOONS.map((s) => simulateConcentration(p(s, w)).result);
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.float).toBeGreaterThanOrEqual(r[i - 1]!.float);
        expect(r[i]!.mass20).toBeGreaterThan(r[i - 1]!.mass20);
        expect(r[i]!.color).toBeGreaterThanOrEqual(r[i - 1]!.color);
      }
    }
  });

  it('경계: 밀도가 1.03보다 작으면 0, 1.03 이상이면 반올림((ρ − 1.03) / 0.005), 반올림 경계와 상한', () => {
    expect(densityOf(p(1, 100))).toBeLessThan(1.03);
    expect(floatLevelOf(p(1, 100))).toBe(0);
    // 1숟가락 50 mL: (1.03455 − 1.03) / 0.005 = 0.91 → 1
    expect(floatLevelOf(p(1, 50))).toBe(1);
    // 3숟가락 100 mL: 3.9 → 4, 5숟가락 100 mL: 9.2 → 9
    expect([floatLevelOf(p(3, 100)), floatLevelOf(p(5, 100))]).toEqual([4, 9]);
    // 색: 황설탕 40c의 반올림(1숟가락 100 mL 1.9 → 2, 3숟가락 5.2 → 5, 5숟가락 8.0 → 8, 5숟가락 50 mL 13.3 → 10 상한)
    expect([colorLevelOf(p(1, 100)), colorLevelOf(p(3, 100)), colorLevelOf(p(5, 100)), colorLevelOf(p(5, 50))]).toEqual([2, 5, 8, 10]);
    expect(mass20Of(p(3, 100))).toBe(21);
  });
});

describe('용액의 진하기 비교 모델: 표본', () => {
  it('0~3초 0.05초 간격 61개이고, 바닥(0)에서 시작해 2초 안에 뜬 높이에 이르며 그 뒤 멈춰 있다', () => {
    for (const [water, spoons, float, mass] of TABLE) {
      const { samples } = simulateConcentration(p(spoons, water));
      expect(samples).toHaveLength(61);
      expect(samples[0]).toEqual({ t: 0, floatH: 0, mass20: mass });
      expect(samples.at(-1)!.t).toBe(3);
      expect(samples.at(-1)!.floatH).toBeCloseTo(float, 9);
      for (const s of samples.filter((x) => x.t >= 2)) expect(s.floatH).toBeCloseTo(float, 9);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.floatH - samples[i - 1]!.floatH).toBeGreaterThanOrEqual(-1e-9);
      for (const s of samples) {
        expect(s.floatH).toBeGreaterThanOrEqual(0);
        expect(s.floatH).toBeLessThanOrEqual(FLOAT_MAX);
        expect(s.mass20).toBe(mass);
      }
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateConcentration(p(5, 100));
    const m = interpolateConcentration(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.floatH).toBeCloseTo((samples[4]!.floatH + samples[5]!.floatH) / 2, 9);
    expect(m.mass20).toBe(21.5);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateConcentration(p(2, 100))).toThrow(RangeError);
    expect(() => simulateConcentration(p(1, 75))).toThrow(RangeError);
    expect(() => simulateConcentration({ ...p(1, 100), sugar: 'black' as never })).toThrow(RangeError);
    expect(() => simulateConcentration({ ...p(1, 100), cup: 'wide' as never })).toThrow(RangeError);
  });
});

describe('validateConcentrationExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(solutionJson.experiments[1])) as VariableExperiment;

  it('g5-solution 활동 2 매니페스트는 통과한다', () => {
    expect(validateConcentrationExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'cup');
    expect(validateConcentrationExperiment(a).join()).toContain('"cup"');
    const b = exp();
    b.variables.find((v) => v.key === 'spoons')!.options.push({ value: 2, label: 'x' });
    b.variables.find((v) => v.key === 'waterMl')!.options.push({ value: 75, label: 'y' });
    b.variables.find((v) => v.key === 'sugar')!.options.push({ value: 'black', label: 'z' });
    b.variables.find((v) => v.key === 'cup')!.options.push({ value: 'wide', label: 'w' });
    expect(validateConcentrationExperiment(b)).toHaveLength(4);
  });
});

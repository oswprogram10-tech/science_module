import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import { interpolateFoodWeb, simulateFoodWeb, validateFoodWebExperiment, type FoodWebParams, type RainKind } from './foodweb';
import ecosystemJson from '../../../../content/units/g4-ecosystem/manifest.json';

const p = (rabbits0: number, foxes0: number, rain: RainKind, furColor = 'white'): FoodWebParams => ({ rabbits0, foxes0, rain, furColor });

// 사양 §2.1: [처음 토끼, 처음 여우, 비, 60일 뒤 풀, 60일 뒤 토끼, 60일 뒤 여우, 가장 많았던 토끼]
const TABLE: [number, number, RainKind, number, number, number, number][] = [
  [10, 0, 'low', 3, 3, 0, 18],
  [10, 0, 'normal', 4, 6, 0, 22],
  [10, 0, 'high', 4, 11, 0, 28],
  [10, 2, 'low', 43, 4, 2, 10],
  [10, 2, 'normal', 71, 6, 2, 10],
  [10, 2, 'high', 82, 7, 3, 10],
  [10, 4, 'low', 73, 3, 2, 10],
  [10, 4, 'normal', 89, 3, 2, 10],
  [10, 4, 'high', 94, 3, 2, 10],
  [20, 0, 'low', 2, 1, 0, 27],
  [20, 0, 'normal', 5, 2, 0, 29],
  [20, 0, 'high', 10, 4, 0, 32],
  [20, 2, 'low', 33, 1, 2, 20],
  [20, 2, 'normal', 76, 2, 3, 20],
  [20, 2, 'high', 92, 2, 3, 20],
  [20, 4, 'low', 67, 1, 2, 20],
  [20, 4, 'normal', 92, 1, 2, 20],
  [20, 4, 'high', 97, 1, 2, 20],
];

describe('먹이 관계 모델: 사양 기준값 18칸(털 색 두 가지 각각, 허용 오차 없음)', () => {
  for (const fur of ['white', 'brown']) {
    for (const [r, f, rain, grass, rabbits, foxes, max] of TABLE) {
      it(`토끼 ${r} 여우 ${f} 비 ${rain} ${fur}`, () => {
        expect(simulateFoodWeb(p(r, f, rain, fur)).result).toEqual({ grassDay60: grass, rabbitsDay60: rabbits, foxesDay60: foxes, rabbitsMax: max });
      });
    }
  }

  it('털 색만 바꾸면 샘플과 결과가 모두 같다', () => {
    for (const [r, f, rain] of TABLE) {
      expect(simulateFoodWeb(p(r, f, rain, 'brown'))).toEqual(simulateFoodWeb(p(r, f, rain, 'white')));
    }
  });
});

describe('샘플', () => {
  it('날마다 61개(0~60일)이고 t는 정수이며 처음 값은 입력과 같다', () => {
    const { samples } = simulateFoodWeb(p(10, 2, 'normal'));
    expect(samples).toHaveLength(61);
    expect(samples.map((s) => s.t)).toEqual(Array.from({ length: 61 }, (_, i) => i));
    expect(samples[0]).toEqual({ t: 0, grassPct: 80, rabbits: 10, foxes: 2 });
  });

  it('모든 샘플이 범위 안에 있다(0 ≤ 풀 ≤ 100, 토끼 ≥ 0, 여우 ≥ 0)', () => {
    for (const [r, f, rain] of TABLE) {
      for (const s of simulateFoodWeb(p(r, f, rain)).samples) {
        expect(s.grassPct).toBeGreaterThanOrEqual(0);
        expect(s.grassPct).toBeLessThanOrEqual(100);
        expect(s.rabbits).toBeGreaterThanOrEqual(0);
        expect(s.foxes).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(s.grassPct + s.rabbits + s.foxes)).toBe(true);
      }
    }
  });

  it('여우가 0이면 여우는 계속 0이다', () => {
    expect(simulateFoodWeb(p(10, 0, 'normal')).samples.every((s) => s.foxes === 0)).toBe(true);
  });

  it('같은 입력은 같은 출력이다(난수 없음)', () => {
    expect(simulateFoodWeb(p(20, 4, 'low'))).toEqual(simulateFoodWeb(p(20, 4, 'low')));
  });

  it('옵션과 잘못된 입력', () => {
    expect(simulateFoodWeb(p(10, 2, 'normal'), { days: 30 }).samples).toHaveLength(31);
    expect(simulateFoodWeb(p(10, 2, 'normal'), { grass0: 50 }).samples[0]!.grassPct).toBe(50);
    expect(() => simulateFoodWeb(p(10, 2, 'normal'), { days: 0 })).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(10, 2, 'normal'), { dt: 0 })).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(10, 2, 'normal'), { grass0: 101 })).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(0, 2, 'normal'))).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(51, 2, 'normal'))).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(10, 11, 'normal'))).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(10, 1.5, 'normal'))).toThrow(RangeError);
    expect(() => simulateFoodWeb(p(10, 2, 'x' as RainKind))).toThrow(RangeError);
  });
});

describe('보간과 매니페스트 검증', () => {
  it('interpolateFoodWeb은 선형 보간이다', () => {
    const a = { t: 0, grassPct: 80, rabbits: 10, foxes: 2 };
    const b = { t: 1, grassPct: 60, rabbits: 14, foxes: 4 };
    expect(interpolateFoodWeb(a, b, 0.5)).toEqual({ t: 0.5, grassPct: 70, rabbits: 12, foxes: 3 });
  });

  const exp = () => JSON.parse(JSON.stringify(parseManifest(ecosystemJson).experiments[0])) as VariableExperiment;

  it('g4-ecosystem 매니페스트는 통과한다', () => {
    expect(validateFoodWebExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const e = exp();
    e.variables = e.variables.filter((v) => v.key !== 'rain');
    expect(validateFoodWebExperiment(e).join()).toContain('"rain"');
    const f = exp();
    f.variables.find((v) => v.key === 'rabbits0')!.options.push({ value: 0, label: 'a' }, { value: 51, label: 'b' });
    f.variables.find((v) => v.key === 'foxes0')!.options.push({ value: 11, label: 'c' }, { value: 1.5, label: 'd' });
    f.variables.find((v) => v.key === 'rain')!.options.push({ value: 'storm', label: 'e' });
    f.variables.find((v) => v.key === 'furColor')!.options.push({ value: 1, label: 'f' });
    expect(validateFoodWebExperiment(f)).toHaveLength(6);
    const g = exp();
    g.params = { days: 0 };
    expect(validateFoodWebExperiment(g)).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  EVAP_ML_PER_MIN,
  RIVER_G_PER_ML,
  SAME_G,
  SEA_G_PER_ML,
  SEA_SOLUTE_RATIO,
  crystalCount,
  dryMinutes,
  interpolateSeaWater,
  residueGrams,
  simulateSeaWater,
  validateSeaWaterExperiment,
  type SeaDishKind,
  type SeaWaterParams,
  type WaterKind,
} from './seaWater';
import seaJson from '../../../../content/units/g3-earth-sea/manifest.json';

const p = (water: WaterKind, volumeMl: number, dish: SeaDishKind = 'round'): SeaWaterParams => ({ water, volumeMl, dish });

// 사양 §0: [물의 종류, 물의 양(mL), 남은 가루(g, 표시), 마른 시간(분)]
const TABLE: [WaterKind, number, number, number][] = [
  ['river', 50, 0.0, 10],
  ['river', 100, 0.0, 20],
  ['sea', 50, 1.8, 10],
  ['sea', 100, 3.6, 20],
];

describe('바닷물과 강물 모델: 사양 기준값 4칸 (접시 두 가지 모두)', () => {
  for (const dish of ['round', 'square'] as const) {
    for (const [water, ml, g, min] of TABLE) {
      it(`${dish} ${water} ${ml} mL`, () => {
        const out = simulateSeaWater(p(water, ml, dish));
        expect(out.result).toEqual({ residue: g, dryMin: min });
        expect(out.result.residue.toFixed(1)).toBe(g.toFixed(1));
        const last = out.samples.at(-1)!;
        expect(last.t).toBe(20);
        expect(last.dishWaterMl).toBe(0);
        expect(last.heating).toBe(false);
      });
    }
  }
});

describe('바닷물과 강물 모델: 계산식과 반올림', () => {
  it('상수: 바닷물 1 mL = 1.025 g, 녹아 있는 것 3.5 %, 강물 0.0001 g/mL, 1분에 5 mL', () => {
    expect([SEA_G_PER_ML, SEA_SOLUTE_RATIO, RIVER_G_PER_ML, EVAP_ML_PER_MIN, SAME_G]).toEqual([1.025, 0.035, 0.0001, 5, 0.1]);
  });

  it('남은 가루(반올림 전): 바닷물 50 mL 1.79375 g, 100 mL 3.5875 g, 강물 50 mL 0.005 g, 100 mL 0.01 g', () => {
    expect(residueGrams('sea', 50)).toBeCloseTo(1.79375, 9);
    expect(residueGrams('sea', 100)).toBeCloseTo(3.5875, 9);
    expect(residueGrams('river', 50)).toBeCloseTo(0.005, 9);
    expect(residueGrams('river', 100)).toBeCloseTo(0.01, 9);
  });

  it('표시는 소수 첫째 자리: 1.79 → 1.8, 3.59 → 3.6, 강물은 0.005와 0.01 모두 0.0 (음의 0 없음)', () => {
    const r = (w: WaterKind, ml: number) => simulateSeaWater(p(w, ml)).result.residue;
    expect(r('sea', 50)).toBe(1.8);
    expect(r('sea', 100)).toBe(3.6);
    expect(r('river', 50)).toBe(0);
    expect(r('river', 100)).toBe(0);
    expect(Object.is(r('river', 50), -0)).toBe(false);
    expect(r('river', 50).toFixed(1)).toBe('0.0');
    expect(r('river', 100).toFixed(1)).toBe('0.0');
  });

  it('반올림 경계: 물의 양 50.7 mL이면 1.819 → 1.8, 52 mL이면 1.8655 → 1.9 (남은 가루는 물의 양에 비례)', () => {
    expect(simulateSeaWater(p('sea', 52)).result.residue).toBe(1.9);
    expect(simulateSeaWater(p('sea', 50.7)).result.residue).toBe(1.8);
  });

  it('접시 모양은 결과와 모든 샘플에 영향이 없다', () => {
    for (const [water, ml] of TABLE) {
      expect(simulateSeaWater(p(water, ml, 'square'))).toEqual(simulateSeaWater(p(water, ml, 'round')));
    }
  });

  it('물의 종류만 바꾸면 남은 가루가 달라지고, 마른 시간은 같다', () => {
    for (const ml of [50, 100]) {
      const sea = simulateSeaWater(p('sea', ml)).result;
      const river = simulateSeaWater(p('river', ml)).result;
      expect(sea.residue - river.residue).toBeGreaterThan(SAME_G);
      expect(sea.dryMin).toBe(river.dryMin);
    }
  });

  it('물의 양을 두 배로 하면 바닷물의 남은 가루와 마른 시간이 두 배다', () => {
    const a = simulateSeaWater(p('sea', 50)).result;
    const b = simulateSeaWater(p('sea', 100)).result;
    expect(b.dryMin).toBe(2 * a.dryMin);
    expect(residueGrams('sea', 100)).toBeCloseTo(2 * residueGrams('sea', 50), 9);
  });
});

describe('바닷물과 강물 모델: 마른 시간과 샘플', () => {
  it('마른 시간은 물의 양 / 5: 50 mL 10분, 100 mL 20분', () => {
    expect(dryMinutes(50)).toBe(10);
    expect(dryMinutes(100)).toBe(20);
  });

  it('샘플은 0.1분 간격으로 201개, 마지막은 t = 20', () => {
    const s = simulateSeaWater(p('sea', 50)).samples;
    expect(s).toHaveLength(201);
    expect(s[0]).toEqual({ t: 0, dishWaterMl: 50, residueG: 0, heating: true });
    expect(s.at(-1)!.t).toBe(20);
  });

  it('물은 1분에 5 mL씩 줄고, 물 종류·접시와 상관없다', () => {
    for (const water of ['river', 'sea'] as const) {
      const s = simulateSeaWater(p(water, 100, 'square')).samples;
      expect(s.find((x) => x.t === 1)!.dishWaterMl).toBe(95);
      expect(s.find((x) => x.t === 4)!.dishWaterMl).toBe(80);
      expect(s.find((x) => x.t === 10)!.dishWaterMl).toBe(50);
    }
  });

  it('남은 물은 단조 감소하고 0 아래로 내려가지 않는다', () => {
    for (const [water, ml] of TABLE) {
      const s = simulateSeaWater(p(water, ml)).samples;
      for (let i = 1; i < s.length; i++) expect(s[i]!.dishWaterMl).toBeLessThanOrEqual(s[i - 1]!.dishWaterMl);
      for (const x of s) expect(x.dishWaterMl).toBeGreaterThanOrEqual(0);
    }
  });

  it('하얀 가루는 물이 다 마르기 전에는 0이고, 다 마른 시각부터 끝값이다 (50 mL는 10분)', () => {
    const s = simulateSeaWater(p('sea', 50)).samples;
    for (const x of s.filter((y) => y.t < 10)) {
      expect(x.residueG).toBe(0);
      expect(x.heating).toBe(true);
    }
    for (const x of s.filter((y) => y.t >= 10)) {
      expect(x.residueG).toBeCloseTo(1.79375, 5);
      expect(x.heating).toBe(false);
    }
    expect(s.find((x) => x.t === 9.9)!.dishWaterMl).toBeGreaterThan(0);
    expect(s.find((x) => x.t === 10)!.dishWaterMl).toBe(0);
  });

  it('결정 수는 남은 가루에 비례한다: 1.8 g → 14개, 3.6 g → 29개, 강물은 0개', () => {
    expect(crystalCount(residueGrams('sea', 50))).toBe(14);
    expect(crystalCount(residueGrams('sea', 100))).toBe(29);
    expect(crystalCount(residueGrams('river', 50))).toBe(0);
    expect(crystalCount(residueGrams('river', 100))).toBe(0);
    expect(crystalCount(0)).toBe(0);
  });

  it('범위 밖 입력은 RangeError', () => {
    expect(() => simulateSeaWater(p('sea', 9))).toThrow(RangeError);
    expect(() => simulateSeaWater(p('sea', 101))).toThrow(RangeError);
    expect(() => simulateSeaWater({ water: 'lake' as never, volumeMl: 50, dish: 'round' })).toThrow(RangeError);
    expect(() => simulateSeaWater({ water: 'sea', volumeMl: 50, dish: 'oval' as never })).toThrow(RangeError);
    expect(() => simulateSeaWater(p('sea', 100), { totalMin: 19 })).toThrow(RangeError);
    expect(() => simulateSeaWater(p('sea', 100), { totalMin: 20 })).not.toThrow();
  });

  it('보간: 중간 값과 가열 중 여부', () => {
    const s = simulateSeaWater(p('sea', 50)).samples;
    const a = s.find((x) => x.t === 9.9)!;
    const b = s.find((x) => x.t === 10)!;
    const mid = interpolateSeaWater(a, b, 0.5);
    expect(mid.t).toBeCloseTo(9.95, 9);
    expect(mid.dishWaterMl).toBeCloseTo(0.25, 9);
    expect(mid.heating).toBe(true);
    expect(interpolateSeaWater(a, b, 1).heating).toBe(false);
  });
});

describe('validateSeaWaterExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(seaJson)).experiments[0] as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validateSeaWaterExperiment(exp())).toEqual([]);
  });

  it('변인 누락·허용 범위 밖·관찰 시간 부족을 잡는다', () => {
    const noDish = exp();
    noDish.variables = noDish.variables.filter((v) => v.key !== 'dish');
    expect(validateSeaWaterExperiment(noDish).join()).toContain('dish');
    const big = exp();
    big.variables.find((v) => v.key === 'volumeMl')!.options.push({ value: 200, label: '200 mL' });
    expect(validateSeaWaterExperiment(big).join()).toContain('10~100');
    const badWater = exp();
    badWater.variables.find((v) => v.key === 'water')!.options.push({ value: 'lake', label: '호수물' });
    expect(validateSeaWaterExperiment(badWater).join()).toContain('river, sea');
    const badDish = exp();
    badDish.variables.find((v) => v.key === 'dish')!.options.push({ value: 'oval', label: '타원' });
    expect(validateSeaWaterExperiment(badDish).join()).toContain('round, square');
    const short = exp();
    short.params = { totalMin: 15 };
    expect(validateSeaWaterExperiment(short).join()).toContain('params.totalMin');
    const none = exp();
    none.params = undefined;
    expect(validateSeaWaterExperiment(none).join()).toContain('params.totalMin');
  });
});

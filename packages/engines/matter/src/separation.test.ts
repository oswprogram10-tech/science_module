import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { dissolvedSaltG, interpolateSeparation, simulateSeparation, stageAt, validateSeparationExperiment, type SeparationFilter, type SeparationParams, type SeparationStirrer } from './separation';
import { solubilityPer100g } from './solubility';
import separationJson from '../../../../content/units/g5-mixture/manifest.json';

const p = (waterMl: number, filter: SeparationFilter, stirrer: SeparationStirrer = 'glass'): SeparationParams => ({ waterMl, filter, stirrer });
const STIRRERS: SeparationStirrer[] = ['glass', 'wood'];

// 사양 §2.1: [물, 거르기, 얻은 소금, 섞인 모래]
const TABLE: [number, SeparationFilter, number, number][] = [
  [20, 'paper', 6.5, 0.0],
  [20, 'pour', 6.5, 1.5],
  [50, 'paper', 9.0, 0.0],
  [50, 'pour', 9.0, 1.5],
];

describe('분리 모델: 사양 기준값 4칸 × 젓는 도구 두 가지', () => {
  for (const stirrer of STIRRERS) {
    for (const [ml, filter, salt, sand] of TABLE) {
      it(`${stirrer} ${ml} mL ${filter} → ${salt}, ${sand}`, () => {
        const r = simulateSeparation(p(ml, filter, stirrer)).result;
        expect(r.salt).toBe(salt);
        expect(r.sand).toBe(sand);
        expect(r.total).toBe(Math.round((salt + sand) * 10) / 10);
      });
    }
  }

  it('젓는 도구만 바꾸면 결과와 샘플이 완전히 같다', () => {
    for (const [ml, filter] of TABLE) {
      expect(simulateSeparation(p(ml, filter, 'wood'))).toEqual(simulateSeparation(p(ml, filter, 'glass')));
    }
  });

  it('반올림 전 값: 20 mL에서 녹는 양 7.18, 50 mL에서 10', () => {
    expect(dissolvedSaltG(20)).toBeCloseTo(7.18, 10);
    expect(dissolvedSaltG(50)).toBe(10);
    const end = simulateSeparation(p(20, 'paper')).samples.at(-1)!;
    expect(end.saltOnDishG).toBeCloseTo(0.9 * 7.18, 10);
    expect(simulateSeparation(p(50, 'paper')).samples.at(-1)!.saltOnDishG).toBeCloseTo(9.0, 10);
  });

  it('녹는 양은 용해와 용액 단원과 같은 용해도 표(20 °C, 물 100 g당 35.9 g)를 쓴다', () => {
    expect(solubilityPer100g('salt', 20)).toBe(35.9);
    expect(dissolvedSaltG(20)).toBe((20 * solubilityPer100g('salt', 20)) / 100);
    const s = simulateSeparation(p(20, 'paper')).samples;
    expect(s.find((x) => x.t === 3)!.dissolvedG).toBe(dissolvedSaltG(20));
    expect(s.at(-1)!.dissolvedG).toBe(dissolvedSaltG(20));
  });

  it('샘플: 0.1분 간격, 마지막은 20분, 201개, 단계는 3분·8분에서 바뀐다', () => {
    const s = simulateSeparation(p(50, 'paper')).samples;
    expect(s).toHaveLength(201);
    expect(s[0]!.t).toBe(0);
    expect(s[1]!.t).toBe(0.1);
    expect(s.at(-1)!.t).toBe(20);
    expect([stageAt(2.9), stageAt(3), stageAt(7.9), stageAt(8), stageAt(20)]).toEqual(['dissolve', 'filter', 'filter', 'evaporate', 'evaporate']);
    expect(s.map((x) => x.stage)[0]).toBe('dissolve');
  });

  it('녹은 소금은 0에서 단조 증가해 3분에 정확히 녹는 양이 된다', () => {
    for (const [ml, filter] of TABLE) {
      const s = simulateSeparation(p(ml, filter)).samples;
      expect(s[0]!.dissolvedG).toBe(0);
      for (let i = 1; i < s.length; i++) expect(s[i]!.dissolvedG).toBeGreaterThanOrEqual(s[i - 1]!.dissolvedG);
    }
  });

  it('solidG는 단조 비감소이고 8분 전에는 소금 가루가 없다', () => {
    for (const [ml, filter] of TABLE) {
      const s = simulateSeparation(p(ml, filter)).samples;
      expect(s[0]!.solidG).toBe(0);
      for (let i = 1; i < s.length; i++) expect(s[i]!.solidG).toBeGreaterThanOrEqual(s[i - 1]!.solidG - 1e-12);
      for (const x of s.filter((q) => q.t < 8)) expect(x.saltOnDishG).toBe(0);
    }
  });

  it('20분에 dishWaterMl은 0이고 solidG = salt + sand (반올림 전 값)', () => {
    for (const [ml, filter] of TABLE) {
      const out = simulateSeparation(p(ml, filter));
      const end = out.samples.at(-1)!;
      expect(end.dishWaterMl).toBeCloseTo(0, 12);
      const saltF = 0.9 * dissolvedSaltG(ml);
      const sandF = filter === 'pour' ? 1.5 : 0;
      expect(end.solidG).toBeCloseTo(saltF + sandF, 10);
    }
  });

  it('접시 물은 8분에 거른 물 전부(0.9 × 물)이고 20분에 0이다', () => {
    const s = simulateSeparation(p(50, 'paper')).samples;
    expect(s.find((x) => x.t === 8)!.dishWaterMl).toBeCloseTo(45, 10);
    expect(s.find((x) => x.t === 3)!.dishWaterMl).toBe(0);
  });

  it('20 mL에서는 소금 가루가 8분에 바로 생기기 시작하고, 50 mL에서는 한참 증발한 뒤에 생긴다', () => {
    const first = (ml: number) => simulateSeparation(p(ml, 'paper')).samples.find((x) => x.saltOnDishG > 1e-9)!.t;
    expect(first(20)).toBeLessThan(8.2);
    expect(first(50)).toBeGreaterThan(12);
  });

  it('따르기는 3~8분에 모래 1.5 g이 접시로 넘어간다. 거름종이는 0', () => {
    const pour = simulateSeparation(p(20, 'pour')).samples;
    const paper = simulateSeparation(p(20, 'paper')).samples;
    expect(pour.find((x) => x.t === 8)!.solidG).toBeCloseTo(1.5, 10);
    expect(pour.find((x) => x.t === 5.5)!.solidG).toBeCloseTo(0.75, 10);
    expect(paper.find((x) => x.t === 8)!.solidG).toBe(0);
  });

  it('범위 밖 입력은 던진다', () => {
    expect(() => simulateSeparation(p(5, 'paper'))).toThrow(RangeError);
    expect(() => simulateSeparation(p(150, 'paper'))).toThrow(RangeError);
    expect(() => simulateSeparation({ waterMl: 50, filter: 'sieve' as never, stirrer: 'glass' })).toThrow(RangeError);
    expect(() => simulateSeparation({ waterMl: 50, filter: 'paper', stirrer: 'spoon' as never })).toThrow(RangeError);
    expect(() => simulateSeparation(p(50, 'paper'), { totalMin: 8 })).toThrow(RangeError);
  });

  it('interpolate: 중간값과 단계', () => {
    const s = simulateSeparation(p(50, 'pour')).samples;
    const a = s.find((x) => x.t === 7.9)!;
    const b = s.find((x) => x.t === 8)!;
    const m = interpolateSeparation(a, b, 0.5);
    expect(m.t).toBeCloseTo(7.95, 10);
    expect(m.solidG).toBeCloseTo((a.solidG + b.solidG) / 2, 10);
    expect(m.stage).toBe('filter');
    expect(interpolateSeparation(a, b, 1).stage).toBe('evaporate');
  });
});

describe('validateSeparationExperiment', () => {
  const exp = (separationJson.experiments[0] as unknown) as VariableExperiment;
  const clone = () => JSON.parse(JSON.stringify(exp)) as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validateSeparationExperiment(exp)).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류', () => {
    const noFilter = clone();
    noFilter.variables = noFilter.variables.filter((v) => v.key !== 'filter');
    expect(validateSeparationExperiment(noFilter).join()).toContain('"filter"');
    const bad = clone();
    bad.variables.find((v) => v.key === 'waterMl')!.options.push({ value: 5, label: '5 mL' });
    expect(validateSeparationExperiment(bad).join()).toContain('10~100');
    const badFilter = clone();
    badFilter.variables.find((v) => v.key === 'filter')!.options.push({ value: 'sieve', label: '체' });
    expect(validateSeparationExperiment(badFilter).join()).toContain('paper, pour');
    const noTotal = clone();
    noTotal.params = {};
    expect(validateSeparationExperiment(noTotal).join()).toContain('totalMin');
  });
});

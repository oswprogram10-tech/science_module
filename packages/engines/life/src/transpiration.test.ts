import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import {
  dropletsOf,
  interpolateTranspiration,
  simulateTranspiration,
  validateTranspirationExperiment,
  type Droplets,
  type TranspirationParams,
  type WindKind,
} from './transpiration';
import type { LightKind } from './germination';
import plantJson from '../../../../content/units/g6-plant/manifest.json';

const p = (leaves: number, light: LightKind, wind: WindKind, startMl = 100): TranspirationParams => ({ leaves, light, wind, startMl });

// 사양 §2.1: [잎, 빛, 바람, 48시간 동안 줄어든 양]
const TABLE: [number, LightKind, WindKind, number][] = [
  [0, 'bright', 'off', 0.0],
  [0, 'bright', 'on', 0.0],
  [0, 'dark', 'off', 0.0],
  [0, 'dark', 'on', 0.0],
  [4, 'bright', 'off', 9.6],
  [4, 'bright', 'on', 14.4],
  [4, 'dark', 'off', 2.4],
  [4, 'dark', 'on', 3.6],
  [8, 'bright', 'off', 19.2],
  [8, 'bright', 'on', 28.8],
  [8, 'dark', 'off', 4.8],
  [8, 'dark', 'on', 7.2],
];
const droplets = (lost: number): Droplets => (lost < 0.5 ? 'none' : lost < 8 ? 'some' : 'many');

describe('증산 모델: 사양 기준값 12칸(처음 물 100·150 각각)', () => {
  for (const startMl of [100, 150]) {
    for (const [leaves, light, wind, lost] of TABLE) {
      it(`${leaves}장 ${light} ${wind} ${startMl} mL`, () => {
        const r = simulateTranspiration(p(leaves, light, wind, startMl)).result;
        expect(r.lostMl).toBe(lost);
        expect(r.remainingMl).toBeCloseTo(startMl - lost, 9);
        expect(r.droplets).toBe(droplets(lost));
      });
    }
  }

  it('처음 물만 바꾸면 줄어든 양과 물방울은 같고 남은 양만 다르다', () => {
    for (const [leaves, light, wind] of TABLE) {
      const a = simulateTranspiration(p(leaves, light, wind, 100)).result;
      const b = simulateTranspiration(p(leaves, light, wind, 150)).result;
      expect(b.lostMl).toBe(a.lostMl);
      expect(b.droplets).toBe(a.droplets);
      expect(b.remainingMl - a.remainingMl).toBeCloseTo(50, 9);
    }
  });

  it('잎 0장이면 모든 조건에서 0이고 물방울이 없다', () => {
    for (const light of ['bright', 'dark'] as const) {
      for (const wind of ['off', 'on'] as const) {
        for (const startMl of [100, 150]) {
          const { samples, result } = simulateTranspiration(p(0, light, wind, startMl));
          expect(result).toEqual({ lostMl: 0, remainingMl: startMl, droplets: 'none' });
          expect(samples.every((s) => s.lostMl === 0 && s.fog === 0 && s.remainingMl === startMl)).toBe(true);
        }
      }
    }
  });

  it('물방울 경계: 0.5 미만 없음, 8 미만 조금, 그 이상 많음', () => {
    expect([0.4, 0.5, 7.9, 8].map(dropletsOf)).toEqual(['none', 'some', 'some', 'many']);
  });
});

describe('샘플', () => {
  it('remainingMl은 단조 감소하고 lostMl과 fog는 단조 증가하며 t는 0~48이다', () => {
    for (const startMl of [100, 150]) {
      for (const [leaves, light, wind] of TABLE) {
        const { samples } = simulateTranspiration(p(leaves, light, wind, startMl));
        expect(samples[0]).toMatchObject({ t: 0, remainingMl: startMl, lostMl: 0, fog: 0 });
        expect(samples.at(-1)!.t).toBe(48);
        expect(samples).toHaveLength(97);
        for (let i = 1; i < samples.length; i++) {
          expect(samples[i]!.remainingMl).toBeLessThanOrEqual(samples[i - 1]!.remainingMl);
          expect(samples[i]!.lostMl).toBeGreaterThanOrEqual(samples[i - 1]!.lostMl);
          expect(samples[i]!.fog).toBeGreaterThanOrEqual(samples[i - 1]!.fog);
          expect(samples[i]!.fog).toBeLessThanOrEqual(1);
        }
      }
    }
    const strict = simulateTranspiration(p(8, 'bright', 'off')).samples;
    for (let i = 1; i < strict.length; i++) expect(strict[i]!.remainingMl).toBeLessThan(strict[i - 1]!.remainingMl);
  });

  it('남은 물 = 처음 − 잎·한 장 양·t/24, 24시간에는 절반', () => {
    const s = simulateTranspiration(p(8, 'bright', 'on')).samples.find((x) => x.t === 24)!;
    expect(s.lostMl).toBeCloseTo(14.4, 9);
    expect(s.remainingMl).toBeCloseTo(85.6, 9);
  });

  it('fog는 줄어든 양 10 mL에서 1이 되고 1을 넘지 않는다', () => {
    const s = simulateTranspiration(p(8, 'bright', 'off')).samples;
    expect(s.find((x) => x.t === 24)!.fog).toBeCloseTo(0.96, 9);
    expect(s.at(-1)!.fog).toBe(1);
    expect(simulateTranspiration(p(4, 'dark', 'off')).samples.at(-1)!.fog).toBeCloseTo(0.24, 9);
  });

  it('기공 열림은 빛에만 따른다(밝음 1, 어두움 0.25)', () => {
    for (const wind of ['off', 'on'] as const) {
      expect(simulateTranspiration(p(8, 'bright', wind)).samples.every((s) => s.stomata === 1)).toBe(true);
      expect(simulateTranspiration(p(8, 'dark', wind)).samples.every((s) => s.stomata === 0.25)).toBe(true);
    }
  });

  it('옵션과 잘못된 입력', () => {
    expect(simulateTranspiration(p(8, 'bright', 'off'), { hours: 24 }).result.lostMl).toBe(9.6);
    expect(simulateTranspiration(p(8, 'bright', 'off'), { sampleEveryH: 6 }).samples).toHaveLength(9);
    expect(() => simulateTranspiration(p(8, 'bright', 'off'), { hours: 0 })).toThrow(RangeError);
    expect(() => simulateTranspiration(p(8, 'bright', 'off'), { sampleEveryH: 0 })).toThrow(RangeError);
    expect(() => simulateTranspiration(p(21, 'bright', 'off'))).toThrow(RangeError);
    expect(() => simulateTranspiration(p(2.5, 'bright', 'off'))).toThrow(RangeError);
    expect(() => simulateTranspiration(p(4, 'x' as LightKind, 'off'))).toThrow(RangeError);
    expect(() => simulateTranspiration(p(4, 'bright', 'x' as WindKind))).toThrow(RangeError);
    expect(() => simulateTranspiration(p(4, 'bright', 'off', 10))).toThrow(RangeError);
  });

  it('남은 물은 0 아래로 내려가지 않는다', () => {
    const r = simulateTranspiration(p(20, 'bright', 'on', 50), { hours: 168 });
    expect(r.samples.every((s) => s.remainingMl >= 0)).toBe(true);
    expect(r.result.remainingMl).toBe(0);
  });

  it('같은 입력은 같은 출력이다(난수 없음)', () => {
    expect(simulateTranspiration(p(8, 'dark', 'on'))).toEqual(simulateTranspiration(p(8, 'dark', 'on')));
  });
});

describe('보간과 매니페스트 검증', () => {
  it('interpolateTranspiration은 선형 보간이다', () => {
    const a = { t: 0, remainingMl: 100, lostMl: 0, fog: 0, stomata: 1 };
    const b = { t: 1, remainingMl: 98, lostMl: 2, fog: 0.2, stomata: 0.5 };
    expect(interpolateTranspiration(a, b, 0.5)).toEqual({ t: 0.5, remainingMl: 99, lostMl: 1, fog: 0.1, stomata: 0.75 });
  });

  const exp = () => JSON.parse(JSON.stringify(parseManifest(plantJson).experiments[0])) as VariableExperiment;

  it('g6-plant 매니페스트는 통과한다', () => {
    expect(validateTranspirationExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const e = exp();
    e.variables = e.variables.filter((v) => v.key !== 'wind');
    expect(validateTranspirationExperiment(e).join()).toContain('"wind"');
    const f = exp();
    f.variables.find((v) => v.key === 'leaves')!.options.push({ value: 21, label: 'a' }, { value: 1.5, label: 'b' });
    f.variables.find((v) => v.key === 'startMl')!.options.push({ value: 10, label: 'c' }, { value: 600, label: 'd' });
    f.variables.find((v) => v.key === 'light')!.options.push({ value: 'dim', label: 'e' });
    f.variables.find((v) => v.key === 'wind')!.options.push({ value: 1, label: 'f' });
    expect(validateTranspirationExperiment(f)).toHaveLength(6);
    const g = exp();
    g.params = { hours: 0 };
    expect(validateTranspirationExperiment(g)).toHaveLength(1);
  });
});

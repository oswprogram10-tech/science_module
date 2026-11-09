import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  growWindow,
  interpolateMagma,
  rockLikeOf,
  simulateMagma,
  validateMagmaExperiment,
  type DishKind,
  type MagmaParams,
  type PlaceKind,
} from './magma';
import landJson from '../../../../content/units/g4-land/manifest.json';

const m = (place: PlaceKind, grams: number, dish: DishKind, color = 'white'): MagmaParams => ({ place, grams, dish, color });
const run = (p: MagmaParams) => simulateMagma(p);

// 사양 §2.2: [접시, 양, 식히는 곳, 크기(mm), 다 굳는 시간(초)]
const TABLE: [DishKind, number, PlaceKind, number, number][] = [
  ['glass', 5, 'ice', 0.57, 16.2],
  ['glass', 5, 'room', 0.8, 22.4],
  ['glass', 5, 'warm', 2.04, 55.5],
  ['glass', 10, 'ice', 1.14, 32.4],
  ['glass', 10, 'room', 1.61, 44.8],
  ['glass', 10, 'warm', 4.09, 110.9],
  ['aluminum', 5, 'ice', 0.29, 8.1],
  ['aluminum', 5, 'room', 0.4, 11.2],
  ['aluminum', 5, 'warm', 1.02, 27.7],
  ['aluminum', 10, 'ice', 0.57, 16.2],
  ['aluminum', 10, 'room', 0.8, 22.4],
  ['aluminum', 10, 'warm', 2.04, 55.5],
];

describe('마그마 냉각 모델: 사양 기준값 12칸', () => {
  for (const [dish, grams, place, size, solid] of TABLE) {
    it(`${dish} ${grams} g ${place}`, () => {
      const r = run(m(place, grams, dish)).result;
      expect(Math.abs(r.sizeMm - size)).toBeLessThanOrEqual(0.01 + 1e-9);
      expect(Math.abs(r.solidS - solid)).toBeLessThanOrEqual(0.1 + 1e-9);
    });
  }
});

describe('마그마 냉각 모델: 관계', () => {
  const size = (p: MagmaParams) => run(p).result.sizeMm;

  it('얼음물 < 실온 < 따뜻한 물 순으로 크기가 커진다', () => {
    for (const dish of ['glass', 'aluminum'] as const) {
      for (const g of [5, 10]) {
        expect(size(m('ice', g, dish))).toBeLessThan(size(m('room', g, dish)));
        expect(size(m('room', g, dish))).toBeLessThan(size(m('warm', g, dish)));
      }
    }
  });

  it('양이 많을수록, 유리 접시일수록 커진다', () => {
    for (const place of ['ice', 'room', 'warm'] as const) {
      for (const dish of ['glass', 'aluminum'] as const) expect(size(m(place, 10, dish))).toBeGreaterThan(size(m(place, 5, dish)));
      for (const g of [5, 10]) expect(size(m(place, g, 'glass'))).toBeGreaterThan(size(m(place, g, 'aluminum')));
    }
  });

  it('색깔만 바꾸면 결과(와 모든 표본)가 똑같다', () => {
    for (const place of ['ice', 'room', 'warm'] as const) {
      expect(run(m(place, 5, 'glass', 'black'))).toEqual(run(m(place, 5, 'glass', 'white')));
    }
  });

  it('알루미늄 10 g과 유리 5 g은 결과가 같다 (서로 다른 조합의 같은 결과)', () => {
    for (const place of ['ice', 'room', 'warm'] as const) {
      expect(run(m(place, 10, 'aluminum')).result).toEqual(run(m(place, 5, 'glass')).result);
    }
  });

  it('알갱이가 자라는 구간 표식 시각: 시작 < 끝, 길이 × 0.1 = 크기', () => {
    const w = growWindow(m('room', 5, 'glass'));
    expect(w.startS).toBeCloseTo(40 * Math.log(70 / 55), 9);
    expect(w.endS).toBeGreaterThan(w.startS);
    expect((w.endS - w.startS) * 0.1).toBeCloseTo(0.8, 2);
    expect(w.endS).toBeLessThan(run(m('room', 5, 'glass')).result.solidS);
  });
});

describe('마그마 냉각 모델: 표본', () => {
  it('모든 조건에서 tempC는 단조 감소하고 crystal은 단조 증가하며 0~1 안에 있다', () => {
    for (const [dish, grams, place] of TABLE) {
      const { samples, result } = run(m(place, grams, dish));
      expect(samples[0]).toEqual({ t: 0, tempC: 90, crystal: 0 });
      expect(samples[samples.length - 1]!.t).toBeCloseTo(result.solidS + 5, 6);
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1]!;
        const b = samples[i]!;
        expect(b.t).toBeGreaterThan(a.t);
        expect(b.tempC).toBeLessThan(a.tempC);
        expect(b.crystal).toBeGreaterThanOrEqual(a.crystal);
      }
      for (const s of samples) {
        expect(s.crystal).toBeGreaterThanOrEqual(0);
        expect(s.crystal).toBeLessThanOrEqual(1);
      }
      expect(samples[samples.length - 1]!.crystal).toBe(1);
      expect(samples[samples.length - 1]!.tempC).toBeLessThan(60);
    }
  });

  it('난수가 없어 같은 입력은 같은 출력이다', () => {
    expect(run(m('warm', 10, 'glass'))).toEqual(run(m('warm', 10, 'glass')));
  });

  it('보간은 두 표본 사이의 값이다', () => {
    const { samples } = run(m('room', 5, 'glass'));
    const mid = interpolateMagma(samples[0]!, samples[1]!, 0.5);
    expect(mid.t).toBeCloseTo(0.25, 9);
    expect(mid.tempC).toBeCloseTo((samples[0]!.tempC + samples[1]!.tempC) / 2, 9);
  });
});

describe('rockLike 경계', () => {
  it('0.57은 basalt, 0.80은 between, 2.04는 granite', () => {
    expect(rockLikeOf(0.57)).toBe('basalt');
    expect(rockLikeOf(0.8)).toBe('between');
    expect(rockLikeOf(2.04)).toBe('granite');
    expect(rockLikeOf(0.7)).toBe('between');
    expect(rockLikeOf(2.0)).toBe('granite');
    expect(run(m('ice', 5, 'glass')).result.rockLike).toBe('basalt');
    expect(run(m('room', 5, 'glass')).result.rockLike).toBe('between');
    expect(run(m('warm', 5, 'glass')).result.rockLike).toBe('granite');
  });
});

describe('입력 검사', () => {
  it('허용 범위 밖의 입력은 거부한다', () => {
    expect(() => run({ ...m('room', 5, 'glass'), place: 'hot' as PlaceKind })).toThrow(RangeError);
    expect(() => run(m('room', 0, 'glass'))).toThrow(RangeError);
    expect(() => run(m('room', 51, 'glass'))).toThrow(RangeError);
    expect(() => run({ ...m('room', 5, 'glass'), dish: 'iron' as DishKind })).toThrow(RangeError);
    expect(() => run({ ...m('room', 5, 'glass'), color: 3 as unknown as string })).toThrow(RangeError);
  });
});

describe('validateMagmaExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(landJson.experiments[0])) as VariableExperiment;

  it('g4-land 매니페스트는 통과한다', () => {
    expect(validateMagmaExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const noDish = exp();
    noDish.variables = noDish.variables.filter((v) => v.key !== 'dish');
    expect(validateMagmaExperiment(noDish).join()).toContain('dish');

    const bigGrams = exp();
    bigGrams.variables.find((v) => v.key === 'grams')!.options[0]!.value = 100;
    expect(validateMagmaExperiment(bigGrams).join()).toContain('grams');

    const badPlace = exp();
    badPlace.variables.find((v) => v.key === 'place')!.options[0]!.value = 'lava';
    expect(validateMagmaExperiment(badPlace).join()).toContain('place');

    const badColor = exp();
    badColor.variables.find((v) => v.key === 'color')!.options[0]!.value = 1;
    expect(validateMagmaExperiment(badColor).join()).toContain('color');
  });
});

describe('옵션', () => {
  it('undefined인 옵션은 기본값으로 둔다', () => {
    expect(simulateMagma(m('room', 5, 'glass'), { startC: undefined, tailS: undefined })).toEqual(run(m('room', 5, 'glass')));
  });

  it('처음 온도를 바꾸면 다 굳는 시각이 달라진다', () => {
    expect(simulateMagma(m('room', 5, 'glass'), { startC: 80 }).result.solidS).toBeLessThan(22.4);
  });
});

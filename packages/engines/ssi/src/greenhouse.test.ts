import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import climateJson from '../../../../content/units/g4-climate/manifest.json';
import { interpolateGreenhouse, maxRiseOf, simulateGreenhouse, validateGreenhouseExperiment, type GreenhouseParams } from './greenhouse';

const P = (cover: 'none' | 'film', air: 'normal' | 'co2', cap: 'white' | 'blue' = 'white'): GreenhouseParams => ({ cover, air, cap });

// 사양 §2.1 기준값: [덮개, 공기, 20분 뒤 온도, 오른 온도, 반올림 전 오른 온도]
const TABLE: Array<['none' | 'film', 'normal' | 'co2', number, number, number]> = [
  ['none', 'normal', 27.8, 5.8, 5.786],
  ['none', 'co2', 29.2, 7.2, 7.232],
  ['film', 'normal', 31.6, 9.6, 9.643],
  ['film', 'co2', 33.1, 11.1, 11.089],
];

describe('simulateGreenhouse 기준값 (뚜껑 두 가지 모두)', () => {
  for (const cap of ['white', 'blue'] as const) {
    for (const [cover, air, temp, rise, raw] of TABLE) {
      it(`${cap} · 덮개 ${cover} · 공기 ${air}: ${temp} °C, +${rise} °C`, () => {
        const out = simulateGreenhouse(P(cover, air, cap));
        expect(out.result).toEqual({ temp, rise });
        // 사양의 반올림 전 값은 소수 셋째 자리까지 쓴 값이다(11.0897은 11.089로 적혀 있다).
        expect(Math.abs(out.raw.rise - raw)).toBeLessThan(0.001);
        // 표시하는 온도 − 22 = 표시하는 오른 온도
        expect((out.result.temp - 22).toFixed(1)).toBe(out.result.rise.toFixed(1));
        expect(out.result.temp.toFixed(1)).toBe(temp.toFixed(1));
      });
    }
  }
});

describe('simulateGreenhouse 표본과 불변식', () => {
  const all = TABLE.map(([c, a]) => simulateGreenhouse(P(c, a)));

  it('0.1분마다 t = 0..20(201개), 처음은 22 °C이고 마지막 t는 정확히 20이다', () => {
    for (const o of all) {
      expect(o.samples).toHaveLength(201);
      expect(o.samples[0]).toMatchObject({ t: 0, temp: 22, rise: 0 });
      expect(o.samples[200]!.t).toBe(20);
      expect(o.samples[1]!.t).toBe(0.1);
      expect(o.samples[200]!.temp).toBeCloseTo(o.raw.temp, 5);
    }
  });

  it('temp는 단조 증가한다', () => {
    for (const o of all) for (let i = 1; i < o.samples.length; i++) expect(o.samples[i]!.temp).toBeGreaterThan(o.samples[i - 1]!.temp);
  });

  it('rise = temp − 22, trapped = R / 11.5 (0~1)', () => {
    for (const [c, a] of TABLE.map(([c, a]) => [c, a] as const)) {
      const o = simulateGreenhouse(P(c, a));
      for (const s of o.samples) {
        expect(s.rise).toBeCloseTo(s.temp - 22, 5);
        expect(s.trapped).toBeCloseTo(maxRiseOf({ cover: c, air: a }) / 11.5, 5);
        expect(s.trapped).toBeGreaterThan(0);
        expect(s.trapped).toBeLessThanOrEqual(1);
      }
    }
  });

  it('뚜껑만 바꾸면 결과와 샘플이 같다', () => {
    for (const [c, a] of TABLE) expect(simulateGreenhouse(P(c, a, 'blue'))).toEqual(simulateGreenhouse(P(c, a, 'white')));
  });

  it('모든 조건에서 (덮개 효과) > (이산화 탄소 효과)이다', () => {
    for (const cap of ['white', 'blue'] as const) {
      for (const air of ['normal', 'co2'] as const) {
        const coverEffect = simulateGreenhouse(P('film', air, cap)).raw.rise - simulateGreenhouse(P('none', air, cap)).raw.rise;
        for (const cover of ['none', 'film'] as const) {
          const co2Effect = simulateGreenhouse(P(cover, 'co2', cap)).raw.rise - simulateGreenhouse(P(cover, 'normal', cap)).raw.rise;
          expect(coverEffect).toBeGreaterThan(co2Effect);
          expect(co2Effect).toBeGreaterThan(0);
        }
      }
    }
  });

  it('난수가 없어 같은 입력은 같은 출력이다', () => {
    expect(simulateGreenhouse(P('film', 'co2'))).toEqual(simulateGreenhouse(P('film', 'co2')));
  });

  it('totalMin·sampleEveryMin 옵션을 따르고 마지막 표본은 totalMin이다', () => {
    const o = simulateGreenhouse(P('none', 'normal'), { totalMin: 10, sampleEveryMin: 0.5 });
    expect(o.samples).toHaveLength(21);
    expect(o.samples[20]!.t).toBe(10);
  });
});

describe('입력 검사', () => {
  it('허용 범위 밖이면 RangeError', () => {
    expect(() => simulateGreenhouse({ ...P('none', 'normal'), cover: 'x' as never })).toThrow(RangeError);
    expect(() => simulateGreenhouse({ ...P('none', 'normal'), air: 'x' as never })).toThrow(RangeError);
    expect(() => simulateGreenhouse({ ...P('none', 'normal'), cap: 'x' as never })).toThrow(RangeError);
    expect(() => simulateGreenhouse(P('none', 'normal'), { totalMin: 0 })).toThrow(RangeError);
    expect(() => simulateGreenhouse(P('none', 'normal'), { sampleEveryMin: 0 })).toThrow(RangeError);
  });

  const exp = () => structuredClone(parseManifest(climateJson).experiments[0] as VariableExperiment);

  it('매니페스트는 검사를 통과한다', () => {
    expect(validateGreenhouseExperiment(exp())).toEqual([]);
  });

  it('변인이 빠지거나 값이 범위 밖이거나 totalMin이 없으면 오류를 돌려준다', () => {
    const noCap = exp();
    noCap.variables = noCap.variables.filter((v) => v.key !== 'cap');
    expect(validateGreenhouseExperiment(noCap)).toEqual(['변인 "cap"이(가) 없습니다.']);
    const bad = exp();
    bad.variables.find((v) => v.key === 'cover')!.options[1]!.value = 'x';
    expect(validateGreenhouseExperiment(bad)).toHaveLength(1);
    const badNum = exp();
    badNum.variables.find((v) => v.key === 'air')!.options[0]!.value = 3;
    expect(validateGreenhouseExperiment(badNum)).toHaveLength(1);
    const noMin = exp();
    noMin.params = {};
    expect(validateGreenhouseExperiment(noMin)).toHaveLength(1);
  });
});

describe('interpolateGreenhouse', () => {
  it('보간은 선형이다', () => {
    const a = { t: 0, temp: 22, rise: 0, trapped: 0.5 };
    const b = { t: 1, temp: 24, rise: 2, trapped: 0.5 };
    expect(interpolateGreenhouse(a, b, 0.5)).toEqual({ t: 0.5, temp: 23, rise: 1, trapped: 0.5 });
  });
});

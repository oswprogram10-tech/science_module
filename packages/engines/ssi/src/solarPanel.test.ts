import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import energyJson from '../../../../content/units/g5-energy/manifest.json';
import { alignment, incidenceDeg, interpolateSolar, simulateSolar, validateSolarExperiment, type SolarParams } from './solarPanel';

const P = (tilt: number, weather: 'sunny' | 'cloudy', shade: 'none' | 'half', frame: 'black' | 'silver' = 'black'): SolarParams => ({ tilt, weather, shade, frame });

// 사양 §2.1 기준값: [날씨, 기울기, 그늘, 만든 전기(mW), 돈 횟수(번)]
const TABLE: Array<['sunny' | 'cloudy', number, 'none' | 'half', number, number]> = [
  ['sunny', 0, 'none', 433, 104],
  ['sunny', 0, 'half', 217, 52],
  ['sunny', 30, 'none', 500, 120],
  ['sunny', 30, 'half', 250, 60],
  ['sunny', 60, 'none', 433, 104],
  ['sunny', 60, 'half', 217, 52],
  ['cloudy', 0, 'none', 130, 31],
  ['cloudy', 0, 'half', 65, 16],
  ['cloudy', 30, 'none', 150, 36],
  ['cloudy', 30, 'half', 75, 18],
  ['cloudy', 60, 'none', 130, 31],
  ['cloudy', 60, 'half', 65, 16],
];

describe('simulateSolar 기준값 (테두리 두 가지 모두)', () => {
  for (const frame of ['black', 'silver'] as const) {
    for (const [weather, tilt, shade, power, turns] of TABLE) {
      it(`${frame} · ${weather} · ${tilt}° · 그늘 ${shade}: ${power} mW, ${turns}번`, () => {
        const out = simulateSolar(P(tilt, weather, shade, frame));
        expect(out.result).toEqual({ power, turns });
        // 둘 다 반올림 전 P에서 계산한다.
        expect(out.result.power).toBe(Math.round(out.raw.power));
        expect(out.result.turns).toBe(Math.round(out.raw.power * 0.24));
      });
    }
  }

  it('반올림 전 P: 433.013, 216.506, 129.904, 64.952', () => {
    expect(simulateSolar(P(0, 'sunny', 'none')).raw.power).toBeCloseTo(433.013, 3);
    expect(simulateSolar(P(0, 'sunny', 'half')).raw.power).toBeCloseTo(216.506, 3);
    expect(simulateSolar(P(0, 'cloudy', 'none')).raw.power).toBeCloseTo(129.904, 3);
    expect(simulateSolar(P(0, 'cloudy', 'half')).raw.power).toBeCloseTo(64.952, 3);
  });
});

describe('simulateSolar 불변식', () => {
  it('테두리만 바꾸면 결과와 샘플이 같다', () => {
    for (const [weather, tilt, shade] of TABLE) expect(simulateSolar(P(tilt, weather, shade, 'silver'))).toEqual(simulateSolar(P(tilt, weather, shade, 'black')));
  });

  it('기울기 0과 60은 같은 결과이고 30이 가장 크다', () => {
    for (const weather of ['sunny', 'cloudy'] as const) {
      for (const shade of ['none', 'half'] as const) {
        const [a, b, c] = [0, 30, 60].map((t) => simulateSolar(P(t, weather, shade)));
        expect(a).toEqual(c);
        expect(b!.raw.power).toBeGreaterThan(a!.raw.power);
        expect(b!.result.power).toBeGreaterThan(a!.result.power);
      }
    }
  });

  it('흐리면 맑은 날의 0.3배, 그늘이면 절반이다', () => {
    expect(simulateSolar(P(30, 'cloudy', 'none')).raw.power).toBeCloseTo(0.3 * 500, 9);
    expect(simulateSolar(P(30, 'sunny', 'half')).raw.power).toBeCloseTo(250, 9);
  });

  it('0.5초마다 t = 0..60(121개), 마지막 t는 정확히 60이고 turns는 단조 증가한다', () => {
    for (const [weather, tilt, shade] of TABLE) {
      const o = simulateSolar(P(tilt, weather, shade));
      expect(o.samples).toHaveLength(121);
      expect(o.samples[0]).toMatchObject({ t: 0, turns: 0 });
      expect(o.samples[1]!.t).toBe(0.5);
      expect(o.samples[120]!.t).toBe(60);
      for (let i = 1; i < o.samples.length; i++) expect(o.samples[i]!.turns).toBeGreaterThan(o.samples[i - 1]!.turns);
      expect(Math.abs(o.samples[120]!.turns - o.result.turns)).toBeLessThanOrEqual(0.5);
      expect(o.samples[120]!.turns).toBeCloseTo(o.raw.turns, 9);
    }
  });

  it('turns(t)는 가속 없이 P·0.24·t/60이고 powerMw는 언제나 P이다', () => {
    const o = simulateSolar(P(30, 'sunny', 'none'));
    for (const s of o.samples) {
      expect(s.turns).toBeCloseTo((500 * 0.24 * s.t) / 60, 9);
      expect(s.powerMw).toBe(500);
      expect(s.light).toBe(1);
    }
  });

  it('빛이 닿는 각 inc = |90 − 태양 높이 − 기울기|', () => {
    expect([0, 30, 60].map((t) => incidenceDeg(t))).toEqual([30, 0, 30]);
    expect(alignment(30)).toBe(1);
    expect(alignment(0)).toBeCloseTo(Math.cos(Math.PI / 6), 12);
    expect(incidenceDeg(0, 45)).toBe(45);
  });

  it('난수가 없어 같은 입력은 같은 출력이다', () => {
    expect(simulateSolar(P(60, 'cloudy', 'half'))).toEqual(simulateSolar(P(60, 'cloudy', 'half')));
  });

  it('옵션을 따른다', () => {
    const o = simulateSolar(P(0, 'sunny', 'none'), { totalS: 10, sampleEveryS: 1 });
    expect(o.samples).toHaveLength(11);
    expect(o.samples[10]!.t).toBe(10);
    expect(simulateSolar(P(0, 'sunny', 'none'), { sunAltDeg: 90 }).raw.power).toBe(500);
  });
});

describe('입력 검사', () => {
  it('허용 범위 밖이면 RangeError', () => {
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), tilt: -1 })).toThrow(RangeError);
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), tilt: 91 })).toThrow(RangeError);
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), tilt: Number.NaN })).toThrow(RangeError);
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), weather: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), shade: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSolar({ ...P(0, 'sunny', 'none'), frame: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSolar(P(0, 'sunny', 'none'), { totalS: 0 })).toThrow(RangeError);
    expect(() => simulateSolar(P(0, 'sunny', 'none'), { sampleEveryS: 0 })).toThrow(RangeError);
  });

  const exp = () => structuredClone(parseManifest(energyJson).experiments[0] as VariableExperiment);

  it('매니페스트는 검사를 통과한다', () => {
    expect(validateSolarExperiment(exp())).toEqual([]);
  });

  it('변인이 빠지거나 값이 범위 밖이거나 totalS가 없으면 오류를 돌려준다', () => {
    const noFrame = exp();
    noFrame.variables = noFrame.variables.filter((v) => v.key !== 'frame');
    expect(validateSolarExperiment(noFrame)).toEqual(['변인 "frame"이(가) 없습니다.']);
    const badTilt = exp();
    badTilt.variables.find((v) => v.key === 'tilt')!.options[2]!.value = 95;
    expect(validateSolarExperiment(badTilt)).toHaveLength(1);
    const strTilt = exp();
    strTilt.variables.find((v) => v.key === 'tilt')!.options[0]!.value = 'x';
    expect(validateSolarExperiment(strTilt)).toHaveLength(1);
    const badWeather = exp();
    badWeather.variables.find((v) => v.key === 'weather')!.options[1]!.value = 'rainy';
    expect(validateSolarExperiment(badWeather)).toHaveLength(1);
    const noS = exp();
    noS.params = {};
    expect(validateSolarExperiment(noS)).toHaveLength(1);
  });
});

describe('interpolateSolar', () => {
  it('보간은 선형이다', () => {
    const a = { t: 0, powerMw: 100, turns: 0, light: 0.2 };
    const b = { t: 1, powerMw: 100, turns: 2, light: 0.2 };
    expect(interpolateSolar(a, b, 0.5)).toEqual({ t: 0.5, powerMw: 100, turns: 1, light: 0.2 });
  });
});

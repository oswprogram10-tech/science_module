import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { sunPosition, sunPositionAtDeclination } from './astro';
import {
  SEASONS,
  declinationOf,
  interpolateSunAngle,
  lightAreaRatio,
  simulateSunAngle,
  validateSunAngleExperiment,
  type SeasonKind,
  type SunAngleParams,
} from './seasons';
import seasonsJson from '../../../../content/units/g6-seasons/manifest.json';

const TILT = 23.44;
const p = (season: SeasonKind, tiltDeg = TILT, stickCm = 10): SunAngleParams => ({ season, tiltDeg, stickCm });
const run = (x: SunAngleParams) => simulateSunAngle(x);

// 사양 §2.2: [기울기, 계절, 남중 고도, 그림자(cm), 낮 길이(h), 에너지]
const TABLE: [number, SeasonKind, number, number, number, number][] = [
  [TILT, 'spring', 52.5, 7.7, 12.0, 100],
  [TILT, 'summer', 75.9, 2.5, 14.59, 145],
  [TILT, 'autumn', 52.5, 7.7, 12.0, 100],
  [TILT, 'winter', 29.1, 18.0, 9.41, 49],
  [0, 'spring', 52.5, 7.7, 12.0, 100],
  [0, 'summer', 52.5, 7.7, 12.0, 100],
  [0, 'autumn', 52.5, 7.7, 12.0, 100],
  [0, 'winter', 52.5, 7.7, 12.0, 100],
  [30, 'spring', 52.5, 7.7, 12.0, 100],
  [30, 'summer', 82.5, 1.3, 15.51, 156],
  [30, 'autumn', 52.5, 7.7, 12.0, 100],
  [30, 'winter', 22.5, 24.1, 8.5, 35],
];

describe('태양 고도 모델: 사양 기준값 12칸 + 막대 20 cm', () => {
  for (const [tilt, season, alt, shadow, day, energy] of TABLE) {
    it(`${tilt}° ${season}`, () => {
      const r = run(p(season, tilt)).result;
      expect(Math.abs(r.noonAltDeg - alt)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.abs(r.noonShadowCm - shadow)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.abs(r.dayLengthH - day)).toBeLessThanOrEqual(0.02 + 1e-9);
      expect(Math.abs(r.energyIdx - energy)).toBeLessThanOrEqual(1);
    });
  }

  it('여름·막대 20 cm: 75.9°, 5.0 cm', () => {
    const r = run(p('summer', TILT, 20)).result;
    expect(Math.abs(r.noonAltDeg - 75.9)).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(Math.abs(r.noonShadowCm - 5.0)).toBeLessThanOrEqual(0.1 + 1e-9);
  });
});

describe('태양 고도 모델: 관계', () => {
  const tilts = [0, TILT, 30];

  it('기울기 0°이면 네 계절의 결과와 모든 표본이 같다', () => {
    const base = run(p('spring', 0));
    for (const s of SEASONS) expect(run(p(s, 0))).toEqual(base);
  });

  it('봄과 가을의 결과(와 모든 표본)가 같다 (모든 기울기)', () => {
    for (const t of tilts) expect(run(p('autumn', t))).toEqual(run(p('spring', t)));
  });

  it('막대 길이만 바꾸면 남중 고도·낮 길이·에너지는 같고 그림자는 비례한다', () => {
    for (const t of tilts) {
      for (const s of SEASONS) {
        const a = run(p(s, t, 10));
        const b = run(p(s, t, 20));
        expect(b.result.noonAltDeg).toBe(a.result.noonAltDeg);
        expect(b.result.dayLengthH).toBe(a.result.dayLengthH);
        expect(b.result.energyIdx).toBe(a.result.energyIdx);
        // 표본(반올림 전)에서는 정확히 두 배, 결과(소수 첫째 자리)는 반올림 오차 0.1 안에서 두 배
        const i = a.samples.findIndex((x) => x.t === 12);
        expect(b.samples[i]!.shadowCm).toBe(2 * a.samples[i]!.shadowCm);
        expect(Math.abs(b.result.noonShadowCm - 2 * a.result.noonShadowCm)).toBeLessThanOrEqual(0.1 + 1e-9);
        expect(b.samples.map((x) => x.sunAltDeg)).toEqual(a.samples.map((x) => x.sunAltDeg));
      }
    }
  });

  it('남중 고도가 높을수록(같은 기울기의 네 계절) 그림자는 짧고, 낮은 길고, 에너지는 크다', () => {
    for (const t of [TILT, 30]) {
      const rs = SEASONS.map((s) => run(p(s, t)).result).sort((x, y) => x.noonAltDeg - y.noonAltDeg);
      for (let i = 1; i < rs.length; i++) {
        const lo = rs[i - 1]!;
        const hi = rs[i]!;
        if (hi.noonAltDeg === lo.noonAltDeg) continue; // 봄·가을은 같다
        expect(hi.noonShadowCm).toBeLessThan(lo.noonShadowCm);
        expect(hi.dayLengthH).toBeGreaterThan(lo.dayLengthH);
        expect(hi.energyIdx).toBeGreaterThan(lo.energyIdx);
      }
    }
  });

  it('표본의 태양 고도 최댓값은 t = 12에서 나온다', () => {
    for (const t of tilts) {
      for (const s of SEASONS) {
        const { samples } = run(p(s, t));
        const max = Math.max(...samples.map((x) => x.sunAltDeg));
        expect(samples.find((x) => x.sunAltDeg === max)!.t).toBe(12);
      }
    }
  });

  it('0 < t < 일출이면 고도 0, 그림자 −1이다', () => {
    for (const t of tilts) {
      for (const s of SEASONS) {
        const { samples, result } = run(p(s, t));
        const sunrise = 12 - result.dayLengthH / 2;
        const night = samples.filter((x) => x.t > 0 && x.t < sunrise - 0.02);
        if (sunrise > 0.5) expect(night.length).toBeGreaterThan(0);
        for (const x of night) {
          expect(x.sunAltDeg, `${s} ${t}° t=${x.t}`).toBe(0);
          expect(x.shadowCm).toBe(-1);
          expect(x.lightPct).toBe(0);
        }
      }
    }
  });

  it('표본은 0~24시를 0.1시간 간격으로 덮고, 같은 입력이면 같은 출력이다', () => {
    const { samples } = run(p('summer'));
    expect(samples[0]!.t).toBe(0);
    expect(samples[samples.length - 1]!.t).toBe(24);
    expect(samples).toHaveLength(241);
    expect(run(p('summer'))).toEqual(run(p('summer')));
  });

  it('astro의 sunPosition과 같은 식이다: 적위를 직접 받는 함수가 날짜로 구한 값과 일치한다', () => {
    for (const dayOfYear of [80, 172, 266, 355]) {
      for (const hour of [6, 9, 12, 15]) {
        const dec = 23.44 * Math.sin(2 * Math.PI * ((dayOfYear - 80) / 365.25));
        expect(sunPositionAtDeclination({ hour, decDeg: dec })).toEqual(sunPosition({ hour, dayOfYear }));
      }
    }
    // 하지 무렵(적위 ≈ 기울기)의 남중 고도는 모델 결과와 같다
    expect(sunPositionAtDeclination({ hour: 12, decDeg: declinationOf('summer', TILT) }).altDeg).toBeCloseTo(75.94, 2);
  });

  it('보간: 그림자가 −1인 쪽과 섞이면 −1, 아니면 선형', () => {
    const a = { t: 0, sunAltDeg: 10, shadowCm: 4, lightPct: 10 };
    const b = { t: 1, sunAltDeg: 20, shadowCm: 2, lightPct: 30 };
    expect(interpolateSunAngle(a, b, 0.5)).toEqual({ t: 0.5, sunAltDeg: 15, shadowCm: 3, lightPct: 20 });
    expect(interpolateSunAngle(a, { ...b, shadowCm: -1 }, 0.5).shadowCm).toBe(-1);
  });

  it('빛이 닿는 넓이는 봄의 1/sin(남중 고도) 비율이고, 기울기 0°이면 계절과 상관없이 1이다', () => {
    expect(lightAreaRatio(p('spring'))).toBeCloseTo(1, 12);
    expect(lightAreaRatio(p('summer'))).toBeLessThan(1);
    expect(lightAreaRatio(p('winter'))).toBeGreaterThan(1);
    for (const s of SEASONS) expect(lightAreaRatio(p(s, 0))).toBeCloseTo(1, 12);
    expect(lightAreaRatio(p('winter'))).toBeCloseTo(Math.sin((52.5 * Math.PI) / 180) / Math.sin((29.06 * Math.PI) / 180), 2);
  });

  it('범위를 벗어난 입력은 RangeError', () => {
    expect(() => run(p('summer', -1))).toThrow(RangeError);
    expect(() => run(p('summer', 46))).toThrow(RangeError);
    expect(() => run(p('summer', TILT, 0))).toThrow(RangeError);
    expect(() => run(p('summer', TILT, 101))).toThrow(RangeError);
    expect(() => run({ season: 'rainy' as SeasonKind, tiltDeg: 0, stickCm: 10 })).toThrow(RangeError);
    expect(() => simulateSunAngle(p('summer'), { latDeg: 100 })).toThrow(RangeError);
  });
});

describe('validateSunAngleExperiment', () => {
  const exp = () => structuredClone(seasonsJson.experiments[0]) as unknown as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validateSunAngleExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const noTilt = exp();
    noTilt.variables = noTilt.variables.filter((v) => v.key !== 'tiltDeg');
    expect(validateSunAngleExperiment(noTilt).join()).toContain('tiltDeg');

    const badSeason = exp();
    badSeason.variables.find((v) => v.key === 'season')!.options.push({ value: 'rainy', label: '장마' });
    expect(validateSunAngleExperiment(badSeason).join()).toContain('season');

    const badTilt = exp();
    badTilt.variables.find((v) => v.key === 'tiltDeg')!.options.push({ value: 46, label: '46°' });
    expect(validateSunAngleExperiment(badTilt).join()).toContain('tiltDeg');

    const badStick = exp();
    badStick.variables.find((v) => v.key === 'stickCm')!.options.push({ value: 0, label: '0 cm' });
    expect(validateSunAngleExperiment(badStick).join()).toContain('stickCm');

    const badLat = exp();
    badLat.params = { latDeg: 120 };
    expect(validateSunAngleExperiment(badLat).join()).toContain('latDeg');
  });
});

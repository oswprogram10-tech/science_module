import { describe, expect, it } from 'vitest';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import earthJson from '../../../../content/units/g6-earth-motion/manifest.json';
import { answerFor, sunPositionAtDeclination, validateSkyObservation } from './astro';
import {
  fullMoonDay,
  moonDay,
  moonElongationDeg,
  moonEveningChange,
  moonEveningPosition,
  moonLitFraction,
  moonShapeKey,
  moonShapeKeyOf,
  moonShapeName,
  moonTransitHour,
} from './moon';

describe('달 모양 모델(교사 검수 대상)', () => {
  it('§1 기준값: φ, 밝은 비율, 저녁 7시 고도·방위각(소수 첫째 자리)', () => {
    const table: [number, number, number, number, number][] = [
      [1, 12.2, 0.011, -2.2, 271.7],
      [3, 36.6, 0.098, 17.0, 256.5],
      [8, 97.5, 0.566, 51.9, 192.2],
      [10, 121.9, 0.764, 49.4, 153.5],
      [15, 182.9, 0.999, 9.6, 97.5],
      [22, 268.2, 0.516, -49.4, 26.4],
    ];
    for (const [d, phi, frac, alt, az] of table) {
      const m = moonDay(d);
      expect(m.phiDeg, `φ ${d}`).toBeCloseTo(phi, 1);
      expect(m.frac, `frac ${d}`).toBeCloseTo(frac, 3);
      expect(Math.abs(m.pos.altDeg - alt), `고도 ${d}`).toBeLessThan(0.2);
      expect(Math.abs(m.pos.azDeg - az), `방위각 ${d}`).toBeLessThan(0.2);
    }
  });

  it('저녁 7시 위치는 기존 sunPositionAtDeclination(적위 0°)로 구한다', () => {
    for (const d of [2, 9, 20]) {
      const hour = 12 + (19 - moonTransitHour(d));
      expect(moonEveningPosition(d)).toEqual(sunPositionAtDeclination({ hour, decDeg: 0, latDeg: 37.5 }));
    }
    expect(moonTransitHour(0)).toBe(12);
  });

  it('차오름: φ < 180이면 waxing이고 밝은 비율은 (1 − cos φ)/2', () => {
    expect(moonDay(14).waxing).toBe(true);
    expect(moonDay(15).waxing).toBe(false);
    expect(moonLitFraction(moonDay(5).phiDeg > 0 ? 5 : 0)).toBeCloseTo((1 - Math.cos((moonElongationDeg(5) * Math.PI) / 180)) / 2, 12);
  });

  it('모양 이름 경계(φ)', () => {
    const at = (phi: number) => moonShapeKeyOf(phi);
    expect(at(0)).toBe('new');
    expect(at(22.49)).toBe('new');
    expect(at(22.5)).toBe('crescent');
    expect(at(67.49)).toBe('crescent');
    expect(at(67.5)).toBe('first-quarter');
    expect(at(112.49)).toBe('first-quarter');
    expect(at(112.5)).toBe('waxing-gibbous');
    expect(at(157.49)).toBe('waxing-gibbous');
    expect(at(157.5)).toBe('full');
    expect(at(202.49)).toBe('full');
    expect(at(202.5)).toBe('waning-gibbous');
    expect(at(247.49)).toBe('waning-gibbous');
    expect(at(247.5)).toBe('last-quarter');
    expect(at(292.49)).toBe('last-quarter');
    expect(at(292.5)).toBe('old-crescent');
    expect(at(337.49)).toBe('old-crescent');
    expect(at(337.5)).toBe('new');
    expect(at(359.9)).toBe('new');
    expect(moonShapeName(3)).toBe('초승달');
    expect(moonShapeName(8)).toBe('상현달');
    expect(moonShapeName(15)).toBe('보름달');
    expect(moonShapeName(22)).toBe('하현달');
    expect(moonShapeName(26)).toBe('그믐달');
    expect(moonShapeKey(11)).toBe('waxing-gibbous');
    expect(moonShapeKey(18)).toBe('waning-gibbous');
  });

  it('저녁 7시에 보이지 않는 날: 1, 18, 22, 26 (그리고 16~29일 전부, 2~15일은 보인다)', () => {
    for (const d of [1, 18, 22, 26]) expect(moonDay(d).visible, `${d}일`).toBe(false);
    for (let d = 2; d <= 15; d++) expect(moonDay(d).visible, `${d}일`).toBe(true);
    for (let d = 16; d <= 29; d++) expect(moonDay(d).visible, `${d}일`).toBe(false);
  });

  it('정답 규칙: moon-evening-change는 waxes-east, full-moon-day는 "15"', () => {
    expect(answerFor('moon-evening-change')).toBe('waxes-east');
    expect(answerFor('full-moon-day')).toBe('15');
    expect(moonEveningChange(3, 10)).toBe('waxes-east');
    expect(moonEveningChange(10, 3)).toBe('wanes-west');
    expect(moonEveningChange(5, 5)).toBe('same');
    expect(fullMoonDay()).toBe(15);
    // 3일→10일: 밝은 비율은 늘고 방위각은 줄어든다(남쪽·동쪽으로).
    expect(moonDay(10).frac).toBeGreaterThan(moonDay(3).frac);
    expect(moonDay(10).pos.azDeg).toBeLessThan(moonDay(3).pos.azDeg);
  });

  it('지구의 운동 매니페스트가 validateSkyObservation을 통과한다', () => {
    const exp = parseManifest(earthJson).experiments[0] as ObservationExperiment;
    expect(validateSkyObservation(exp)).toEqual([]);
    expect(exp.tasks.slice(-2).map((t) => t.id)).toEqual(['moon-change', 'full-moon']);
  });
});

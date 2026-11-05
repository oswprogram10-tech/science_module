import { describe, expect, it } from 'vitest';
import {
  CASSIOPEIA_LINES,
  DIPPER_LINES,
  NORTH_STARS,
  angularDistanceDeg,
  northStar,
  pointOnGreatCircle,
  pointerEndpoint,
  pointerRanking,
  pointerStarKey,
} from './northSky';
import { starPosition } from './astro';

describe('북쪽 하늘 별 목록(교사 검수 대상)', () => {
  it('좌표(J2000 적경 시, 적위 °)를 고정한다', () => {
    expect(NORTH_STARS.map((s) => [s.key, s.ra, s.dec])).toEqual([
      ['polaris', 2.53, 89.264],
      ['dubhe', 11.062, 61.751],
      ['merak', 11.031, 56.382],
      ['phecda', 11.897, 53.695],
      ['megrez', 12.257, 57.033],
      ['alioth', 12.9, 55.96],
      ['mizar', 13.399, 54.925],
      ['alkaid', 13.792, 49.313],
      ['caph', 0.153, 59.15],
      ['schedar', 0.675, 56.537],
      ['gammaCas', 0.945, 60.717],
      ['ruchbah', 1.43, 60.235],
      ['segin', 1.907, 63.67],
      ['kochab', 14.845, 74.156],
      ['capella', 5.278, 45.998],
      ['vega', 18.616, 38.784],
    ]);
  });

  it('선으로 잇는 별은 모두 목록에 있다', () => {
    for (const [a, b] of [...DIPPER_LINES, ...CASSIOPEIA_LINES]) {
      expect(northStar(a)).toBeDefined();
      expect(northStar(b)).toBeDefined();
    }
  });
});

describe('길잡이 별 계산(메라크 → 두베 방향 5배)', () => {
  it('끝점에 가장 가까운 별은 북극성(2.6°), 다음은 코카브(14.0°)다', () => {
    const [first, second] = pointerRanking();
    expect(first!.key).toBe('polaris');
    expect(first!.distDeg).toBeCloseTo(2.6, 1);
    expect(second!.key).toBe('kochab');
    expect(second!.distDeg).toBeCloseTo(14.0, 1);
    expect(pointerStarKey()).toBe('polaris');
  });

  it('북극성과 카펠라·직녀성은 더 멀다', () => {
    const rank = Object.fromEntries(pointerRanking().map((r) => [r.key, r.distDeg]));
    expect(rank.capella!).toBeGreaterThan(20);
    expect(rank.vega!).toBeGreaterThan(20);
  });

  it('메라크와 두베 사이는 약 5.4°이고 끝점은 두베에서 그 5배(약 27°) 떨어져 있다', () => {
    const m = { raHours: northStar('merak').ra, decDeg: northStar('merak').dec };
    const d = { raHours: northStar('dubhe').ra, decDeg: northStar('dubhe').dec };
    const theta = angularDistanceDeg(m, d);
    expect(theta).toBeCloseTo(5.4, 1);
    expect(angularDistanceDeg(d, pointerEndpoint())).toBeCloseTo(5 * theta, 3);
    expect(angularDistanceDeg(m, pointerEndpoint())).toBeCloseTo(6 * theta, 3);
  });

  it('대원 위의 점: t = 0은 from, t = 1은 to', () => {
    const m = { raHours: northStar('merak').ra, decDeg: northStar('merak').dec };
    const d = { raHours: northStar('dubhe').ra, decDeg: northStar('dubhe').dec };
    expect(angularDistanceDeg(pointOnGreatCircle(m, d, 0), m)).toBeLessThan(1e-6);
    expect(angularDistanceDeg(pointOnGreatCircle(m, d, 1), d)).toBeLessThan(1e-6);
  });
});

describe('북쪽 하늘의 위치(서울, 1월 15일)', () => {
  const at = (key: Parameters<typeof northStar>[0], hour: number) => {
    const s = northStar(key);
    return starPosition({ raHours: s.ra, decDeg: s.dec, hour, dayOfYear: 15, latDeg: 37.5 });
  };

  it('북극성의 고도는 위도(37.5°)와 거의 같고 방위각은 북쪽 근처다', () => {
    for (const hour of [19, 21, 24, 27]) {
      const p = at('polaris', hour);
      expect(p.altDeg).toBeGreaterThan(36.5);
      expect(p.altDeg).toBeLessThan(38.5);
      const off = ((p.azDeg + 180) % 360) - 180;
      expect(Math.abs(off)).toBeLessThan(3);
    }
  });

  it('밤 7시부터 새벽 3시까지 두베는 북동쪽 하늘에서 떠오르며 올라간다', () => {
    expect(at('dubhe', 19).altDeg).toBeGreaterThan(0);
    expect(at('dubhe', 27).altDeg).toBeGreaterThan(at('dubhe', 19).altDeg);
  });
});

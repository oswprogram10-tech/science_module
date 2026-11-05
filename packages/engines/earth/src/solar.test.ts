import { describe, expect, it } from 'vitest';
import { PLANETS, SUN_DIAMETER_KM, distanceCells, formatRatio, planetOf, sizeRatio, sunSizeRatio } from './solar';

describe('행성 표(교사 검수 대상)', () => {
  it('여덟 행성의 지름(km)과 태양까지 거리(AU)를 고정한다', () => {
    expect(PLANETS.map((p) => [p.key, p.name, p.diameterKm, p.au])).toEqual([
      ['mercury', '수성', 4879, 0.39],
      ['venus', '금성', 12104, 0.72],
      ['earth', '지구', 12756, 1.0],
      ['mars', '화성', 6792, 1.52],
      ['jupiter', '목성', 142984, 5.2],
      ['saturn', '토성', 120536, 9.58],
      ['uranus', '천왕성', 51118, 19.19],
      ['neptune', '해왕성', 49528, 30.07],
    ]);
    expect(SUN_DIAMETER_KM).toBe(1392700);
  });

  it('지구를 1로 한 크기와 거리 계산', () => {
    expect(sizeRatio('earth')).toBe(1);
    expect(sizeRatio('jupiter')).toBeCloseTo(11.21, 2);
    expect(Math.round(sizeRatio('jupiter'))).toBe(11);
    expect(sunSizeRatio()).toBeCloseTo(109.18, 2);
    expect(distanceCells('earth')).toBe(1);
    expect(distanceCells('neptune')).toBeCloseTo(30.07, 2);
    expect(planetOf('mars').name).toBe('화성');
  });

  it('화면용 숫자: 10 미만은 소수 첫째 자리(끝의 .0은 뺀다), 그 이상은 정수', () => {
    expect(formatRatio(0.3825)).toBe('0.4');
    expect(formatRatio(4.007)).toBe('4');
    expect(formatRatio(9.449)).toBe('9.4');
    expect(formatRatio(11.21)).toBe('11');
    expect(formatRatio(30.07)).toBe('30');
    expect(formatRatio(109.18)).toBe('109');
  });
});

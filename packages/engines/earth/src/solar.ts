/**
 * 태양계 행성 표(교사 검수 대상). 지름은 km, 거리는 태양까지의 평균 거리(AU)다.
 * 크기·거리 과제의 정답과 화면의 배수·칸 수는 모두 이 표에서 계산한다.
 */

export type PlanetKey = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface Planet {
  key: PlanetKey;
  name: string;
  /** 지름(km) */
  diameterKm: number;
  /** 태양까지의 거리(AU). 지구는 1이다. */
  au: number;
}

export const PLANETS: readonly Planet[] = [
  { key: 'mercury', name: '수성', diameterKm: 4879, au: 0.39 },
  { key: 'venus', name: '금성', diameterKm: 12104, au: 0.72 },
  { key: 'earth', name: '지구', diameterKm: 12756, au: 1.0 },
  { key: 'mars', name: '화성', diameterKm: 6792, au: 1.52 },
  { key: 'jupiter', name: '목성', diameterKm: 142984, au: 5.2 },
  { key: 'saturn', name: '토성', diameterKm: 120536, au: 9.58 },
  { key: 'uranus', name: '천왕성', diameterKm: 51118, au: 19.19 },
  { key: 'neptune', name: '해왕성', diameterKm: 49528, au: 30.07 },
];

export const SUN_DIAMETER_KM = 1392700;

export function planetOf(key: PlanetKey): Planet {
  return PLANETS.find((p) => p.key === key)!;
}

/** 지구 지름을 1로 했을 때 그 행성의 지름. */
export const sizeRatio = (key: PlanetKey): number => planetOf(key).diameterKm / planetOf('earth').diameterKm;

/** 지구 지름을 1로 했을 때 태양의 지름. */
export const sunSizeRatio = (): number => SUN_DIAMETER_KM / planetOf('earth').diameterKm;

/** 태양~지구를 1칸으로 했을 때 태양에서 그 행성까지의 칸 수. */
export const distanceCells = (key: PlanetKey): number => planetOf(key).au / planetOf('earth').au;

/** 화면용 숫자: 10 미만은 소수 첫째 자리(끝의 .0은 뺀다), 그 이상은 정수. */
export function formatRatio(x: number): string {
  if (x >= 10) return String(Math.round(x));
  return String(Math.round(x * 10) / 10);
}

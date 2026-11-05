/**
 * 북쪽 하늘 별 목록(교사 검수 대상). 좌표는 J2000의 적경(시)과 적위(°)이다.
 * 위치(고도·방위각)는 astro.ts의 starPosition으로 구한다.
 */

export type NorthStarKey =
  | 'polaris'
  | 'dubhe' | 'merak' | 'phecda' | 'megrez' | 'alioth' | 'mizar' | 'alkaid'
  | 'caph' | 'schedar' | 'gammaCas' | 'ruchbah' | 'segin'
  | 'kochab' | 'capella' | 'vega';

export type NorthStarGroup = 'polaris' | 'dipper' | 'cassiopeia' | 'other';

export interface NorthStar {
  key: NorthStarKey;
  group: NorthStarGroup;
  /** 화면에 쓰는 이름(북극성은 기록 뒤에만 쓴다). */
  name: string;
  /** 적경(시) */
  ra: number;
  /** 적위(°) */
  dec: number;
}

export const NORTH_STARS: readonly NorthStar[] = [
  { key: 'polaris', group: 'polaris', name: '북극성', ra: 2.53, dec: 89.264 },
  { key: 'dubhe', group: 'dipper', name: '두베', ra: 11.062, dec: 61.751 },
  { key: 'merak', group: 'dipper', name: '메라크', ra: 11.031, dec: 56.382 },
  { key: 'phecda', group: 'dipper', name: '페크다', ra: 11.897, dec: 53.695 },
  { key: 'megrez', group: 'dipper', name: '메그레즈', ra: 12.257, dec: 57.033 },
  { key: 'alioth', group: 'dipper', name: '알리오스', ra: 12.9, dec: 55.96 },
  { key: 'mizar', group: 'dipper', name: '미자르', ra: 13.399, dec: 54.925 },
  { key: 'alkaid', group: 'dipper', name: '알카이드', ra: 13.792, dec: 49.313 },
  { key: 'caph', group: 'cassiopeia', name: '카프', ra: 0.153, dec: 59.15 },
  { key: 'schedar', group: 'cassiopeia', name: '쉐다르', ra: 0.675, dec: 56.537 },
  { key: 'gammaCas', group: 'cassiopeia', name: '감마별', ra: 0.945, dec: 60.717 },
  { key: 'ruchbah', group: 'cassiopeia', name: '루크바', ra: 1.43, dec: 60.235 },
  { key: 'segin', group: 'cassiopeia', name: '세긴', ra: 1.907, dec: 63.67 },
  { key: 'kochab', group: 'other', name: '코카브', ra: 14.845, dec: 74.156 },
  { key: 'capella', group: 'other', name: '카펠라', ra: 5.278, dec: 45.998 },
  { key: 'vega', group: 'other', name: '직녀성', ra: 18.616, dec: 38.784 },
];

export function northStar(key: NorthStarKey): NorthStar {
  return NORTH_STARS.find((s) => s.key === key)!;
}

/** 선으로 잇는 별(NORTH_STARS의 key 쌍). 북두칠성은 국자 모양이다. */
export const DIPPER_LINES: [NorthStarKey, NorthStarKey][] = [
  ['dubhe', 'merak'],
  ['merak', 'phecda'],
  ['phecda', 'megrez'],
  ['megrez', 'dubhe'],
  ['megrez', 'alioth'],
  ['alioth', 'mizar'],
  ['mizar', 'alkaid'],
];

export const CASSIOPEIA_LINES: [NorthStarKey, NorthStarKey][] = [
  ['caph', 'schedar'],
  ['schedar', 'gammaCas'],
  ['gammaCas', 'ruchbah'],
  ['ruchbah', 'segin'],
];

export const NORTH_CONSTELLATIONS = [
  { key: 'dipper', name: '북두칠성', lines: DIPPER_LINES, stars: ['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid'] as NorthStarKey[] },
  { key: 'cassiopeia', name: '카시오페이아', lines: CASSIOPEIA_LINES, stars: ['caph', 'schedar', 'gammaCas', 'ruchbah', 'segin'] as NorthStarKey[] },
] as const;

// ---- 하늘 위의 점(적경·적위) 계산 ----

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

type Vec = [number, number, number];

const toVec = (raHours: number, decDeg: number): Vec => {
  const a = raHours * 15 * RAD;
  const d = decDeg * RAD;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};

const toRaDec = (v: Vec): { raHours: number; decDeg: number } => {
  const ra = Math.atan2(v[1], v[0]) * DEG;
  return { raHours: (((ra % 360) + 360) % 360) / 15, decDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) * DEG };
};

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 하늘 위 두 점(적경 시, 적위 °) 사이의 각거리(°). */
export function angularDistanceDeg(a: { raHours: number; decDeg: number }, b: { raHours: number; decDeg: number }): number {
  const c = dot(toVec(a.raHours, a.decDeg), toVec(b.raHours, b.decDeg));
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/**
 * from에서 to로 가는 대원(큰 원) 위의 점. t = 0이 from, t = 1이 to이고, t > 1이면 to를 지나서 더 간 점이다.
 * (t = 6이면 to에서 from~to 각거리의 5배만큼 더 간 점.)
 */
export function pointOnGreatCircle(
  from: { raHours: number; decDeg: number },
  to: { raHours: number; decDeg: number },
  t: number,
): { raHours: number; decDeg: number } {
  const A = toVec(from.raHours, from.decDeg);
  const B = toVec(to.raHours, to.decDeg);
  const theta = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
  const s = Math.sin(theta);
  const k1 = Math.sin((1 - t) * theta) / s;
  const k2 = Math.sin(t * theta) / s;
  return toRaDec([k1 * A[0] + k2 * B[0], k1 * A[1] + k2 * B[1], k1 * A[2] + k2 * B[2]]);
}

/** from에서 to로 가는 대원을 따라, to를 지나서 두 점 사이 각거리의 factor배만큼 더 간 점. */
export const extendGreatCircle = (
  from: { raHours: number; decDeg: number },
  to: { raHours: number; decDeg: number },
  factor: number,
): { raHours: number; decDeg: number } => pointOnGreatCircle(from, to, 1 + factor);

/** 길잡이 선 연장 배수. */
export const POINTER_FACTOR = 5;

/** 메라크→두베 방향으로 두 별 사이 각거리의 5배만큼 더 간 점. */
export function pointerEndpoint(): { raHours: number; decDeg: number } {
  const merak = northStar('merak');
  const dubhe = northStar('dubhe');
  return extendGreatCircle({ raHours: merak.ra, decDeg: merak.dec }, { raHours: dubhe.ra, decDeg: dubhe.dec }, POINTER_FACTOR);
}

/** 별 목록을 길잡이 끝점에서 가까운 순서로(별 key와 각거리). */
export function pointerRanking(): { key: NorthStarKey; distDeg: number }[] {
  const end = pointerEndpoint();
  return NORTH_STARS.map((s) => ({ key: s.key, distDeg: angularDistanceDeg(end, { raHours: s.ra, decDeg: s.dec }) })).sort(
    (a, b) => a.distDeg - b.distDeg,
  );
}

/** 길잡이 끝점에 가장 가까운 별의 key. */
export const pointerStarKey = (): NorthStarKey => pointerRanking()[0]!.key;

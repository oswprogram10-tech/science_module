import { SEOUL_LAT_DEG, sunPositionAtDeclination, type SkyPoint } from './astro';

/**
 * 달 모양 변화 근사 모델(교사 검수 대상).
 * 달은 천구 적도 위를 돈다(적위 0°). 삭망 주기 29.53일, 관측은 서울 저녁 7시.
 * 달 궤도 기울기, 이심률, 대기 굴절은 무시한다.
 */

/** 삭망 주기(일). */
export const SYNODIC_DAYS = 29.53;
/** 음력 날짜의 범위. */
export const LUNAR_DAY_MIN = 1;
export const LUNAR_DAY_MAX = 29;
/** 관측 시각(저녁 7시). */
export const MOON_OBSERVE_HOUR = 19;

const RAD = Math.PI / 180;

/** 달이 태양에서 떨어진 각 φ(°, 0~360). */
export const moonElongationDeg = (d: number): number => (360 * d) / SYNODIC_DAYS;

/** 밝은 부분의 비율(0~1). */
export const moonLitFraction = (d: number): number => (1 - Math.cos(moonElongationDeg(d) * RAD)) / 2;

/** 차오르는 중인가(φ < 180). 북반구에서 남쪽을 보면 오른쪽(서쪽)이 밝다. */
export const moonIsWaxing = (d: number): boolean => moonElongationDeg(d) < 180;

/** 달이 남중하는 시각(시). */
export const moonTransitHour = (d: number): number => 12 + (24 * d) / SYNODIC_DAYS;

export type MoonShapeKey =
  | 'new'
  | 'crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'old-crescent';

/** 모양 이름. 상현과 보름 사이, 보름과 하현 사이는 이름 대신 설명으로 쓴다. */
export const MOON_SHAPE_NAMES: Record<MoonShapeKey, string> = {
  new: '보이지 않음(삭 무렵)',
  crescent: '초승달',
  'first-quarter': '상현달',
  'waxing-gibbous': '상현과 보름 사이',
  full: '보름달',
  'waning-gibbous': '보름과 하현 사이',
  'last-quarter': '하현달',
  'old-crescent': '그믐달',
};

/** φ(°)로 모양을 가른다. */
export function moonShapeKeyOf(phiDeg: number): MoonShapeKey {
  const phi = ((phiDeg % 360) + 360) % 360;
  if (phi < 22.5 || phi >= 337.5) return 'new';
  if (phi < 67.5) return 'crescent';
  if (phi < 112.5) return 'first-quarter';
  if (phi < 157.5) return 'waxing-gibbous';
  if (phi < 202.5) return 'full';
  if (phi < 247.5) return 'waning-gibbous';
  if (phi < 292.5) return 'last-quarter';
  return 'old-crescent';
}

export const moonShapeKey = (d: number): MoonShapeKey => moonShapeKeyOf(moonElongationDeg(d));
export const moonShapeName = (d: number): string => MOON_SHAPE_NAMES[moonShapeKey(d)];

/** 그 날 저녁 7시에 달이 보이는 하늘 위치(기존 태양 위치 식을 적위 0°로 쓴다). 고도 ≤ 0이면 보이지 않는다. */
export function moonEveningPosition(d: number, latDeg: number = SEOUL_LAT_DEG): SkyPoint {
  return sunPositionAtDeclination({ hour: 12 + (MOON_OBSERVE_HOUR - moonTransitHour(d)), decDeg: 0, latDeg });
}

export const moonVisible = (d: number, latDeg: number = SEOUL_LAT_DEG): boolean => moonEveningPosition(d, latDeg).altDeg > 0;

export interface MoonDay {
  day: number;
  phiDeg: number;
  frac: number;
  waxing: boolean;
  pos: SkyPoint;
  visible: boolean;
  shape: MoonShapeKey;
  shapeName: string;
}

export function moonDay(d: number, latDeg: number = SEOUL_LAT_DEG): MoonDay {
  const pos = moonEveningPosition(d, latDeg);
  const shape = moonShapeKey(d);
  return {
    day: d,
    phiDeg: moonElongationDeg(d),
    frac: moonLitFraction(d),
    waxing: moonIsWaxing(d),
    pos,
    visible: pos.altDeg > 0,
    shape,
    shapeName: MOON_SHAPE_NAMES[shape],
  };
}

export type MoonChange = 'waxes-east' | 'wanes-west' | 'same';

/** 3일과 10일 저녁 7시의 달을 비교한다. frac이 늘고 방위각이 줄면 waxes-east, frac이 줄고 방위각이 늘면 wanes-west. */
export function moonEveningChange(from = 3, to = 10, latDeg: number = SEOUL_LAT_DEG): MoonChange {
  const a = moonDay(from, latDeg);
  const b = moonDay(to, latDeg);
  if (b.frac > a.frac && b.pos.azDeg < a.pos.azDeg) return 'waxes-east';
  if (b.frac < a.frac && b.pos.azDeg > a.pos.azDeg) return 'wanes-west';
  return 'same';
}

/** 1~29일 중 밝은 비율이 가장 큰 날. */
export function fullMoonDay(): number {
  let best = LUNAR_DAY_MIN;
  for (let d = LUNAR_DAY_MIN; d <= LUNAR_DAY_MAX; d++) if (moonLitFraction(d) > moonLitFraction(best)) best = d;
  return best;
}

import type { ObservationAnswerRule, ObservationExperiment } from '@sci/schema';
import { northStar, pointerStarKey, type NorthStarKey } from './northSky';
import { distanceCells, sizeRatio } from './solar';
import { fullMoonDay, moonEveningChange } from './moon';

/**
 * 천체 근사 모델(교사 검수 대상). 관측 위치는 서울(위도 37.5°N)이다.
 * 각도는 도(°), 시각은 시(h) 단위다. 방위각: 북 0, 동 90, 남 180, 서 270.
 */

export type Rotation = 'forward' | 'reverse';

export const SEOUL_LAT_DEG = 37.5;
/** 춘분(기본 날짜). */
export const EQUINOX_DAY = 80;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function sunDeclination(dayOfYear: number): number {
  return 23.44 * Math.sin(2 * Math.PI * ((dayOfYear - 80) / 365.25));
}

/** 태양의 적경(시). 춘분(80일) 0시, 하루에 약 0.0657시씩 늘어난다. */
export function raSun(dayOfYear: number): number {
  return mod(((dayOfYear - 80) / 365.25) * 24, 24);
}

export interface SkyPoint {
  /** 고도(°). 0보다 작으면 지평선 아래. */
  altDeg: number;
  /** 방위각(°, 0~360). */
  azDeg: number;
}

/** 시간각 H(°)와 적위로 고도·방위각을 구한다. */
function horizontal(hourAngleDeg: number, decDeg: number, latDeg: number): SkyPoint {
  const H = hourAngleDeg * RAD;
  const d = decDeg * RAD;
  const p = latDeg * RAD;
  const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return { altDeg: alt * DEG, azDeg: mod(az * DEG, 360) };
}

export interface SunInput {
  hour: number;
  dayOfYear: number;
  latDeg?: number;
  rotation?: Rotation;
}

export interface SunDecInput {
  hour: number;
  /** 태양의 적위(°). 날짜 대신 값을 직접 준다. */
  decDeg: number;
  latDeg?: number;
  rotation?: Rotation;
}

/** 적위를 직접 받아 태양의 고도·방위각을 구한다. 정오(12시)가 남중이다. sunPosition과 같은 식이다. */
export function sunPositionAtDeclination({ hour, decDeg, latDeg = SEOUL_LAT_DEG, rotation = 'forward' }: SunDecInput): SkyPoint {
  const H = 15 * (hour - 12) * (rotation === 'reverse' ? -1 : 1);
  return horizontal(H, decDeg, latDeg);
}

export function sunPosition({ hour, dayOfYear, latDeg = SEOUL_LAT_DEG, rotation = 'forward' }: SunInput): SkyPoint {
  return sunPositionAtDeclination({ hour, decDeg: sunDeclination(dayOfYear), latDeg, rotation });
}

export interface StarInput {
  raHours: number;
  decDeg: number;
  hour: number;
  dayOfYear: number;
  latDeg?: number;
  rotation?: Rotation;
}

/** 지방 항성시(시). 태양이 정오(12시)에 자오선을 지난다고 본다. */
export function localSiderealHours(dayOfYear: number, hour: number): number {
  return mod(raSun(dayOfYear) + (hour - 12), 24);
}

export function starPosition({ raHours, decDeg, hour, dayOfYear, latDeg = SEOUL_LAT_DEG, rotation = 'forward' }: StarInput): SkyPoint {
  const H = 15 * (localSiderealHours(dayOfYear, hour) - raHours) * (rotation === 'reverse' ? -1 : 1);
  return horizontal(H, decDeg, latDeg);
}

/**
 * 관측자에서 경도로 lonOffsetDeg(동쪽이 +)만큼 떨어진 곳이 낮인가.
 * 그곳의 지방시가 6~18시면 낮이다. 지구 반대편은 lonOffsetDeg = 180.
 */
export function isDaylight({ hour, lonOffsetDeg }: { hour: number; lonOffsetDeg: number }): boolean {
  const local = mod(hour + lonOffsetDeg / 15, 24);
  return local >= 6 && local < 18;
}

// ---- 별자리 ----

export type ConstellationKey = 'orion' | 'leo' | 'cygnus' | 'pegasus';

export interface Constellation {
  key: ConstellationKey;
  name: string;
  /** 오후 9시 남쪽 하늘 판정에 쓰는 대표 적경(시). */
  raHours: number;
  /** 화면용 주요 별 (적경 시, 적위 °). 정밀하지 않은 근사값이다. */
  stars: { ra: number; dec: number }[];
  /** stars의 인덱스 쌍. */
  lines: [number, number][];
}

export const CONSTELLATIONS: Record<ConstellationKey, Constellation> = {
  orion: {
    key: 'orion',
    name: '오리온자리',
    raHours: 5.6,
    stars: [
      { ra: 5.92, dec: 7.4 }, // 베텔게우스
      { ra: 5.42, dec: 6.35 }, // 벨라트릭스
      { ra: 5.53, dec: -0.3 }, // 허리띠 왼쪽
      { ra: 5.6, dec: -1.2 }, // 허리띠 가운데
      { ra: 5.68, dec: -1.94 }, // 허리띠 오른쪽
      { ra: 5.8, dec: -9.67 }, // 사이프
      { ra: 5.24, dec: -8.2 }, // 리겔
    ],
    lines: [[0, 4], [1, 2], [2, 3], [3, 4], [0, 1], [4, 5], [2, 6], [5, 6]],
  },
  leo: {
    key: 'leo',
    name: '사자자리',
    raHours: 10.5,
    stars: [
      { ra: 10.14, dec: 11.97 }, // 레굴루스
      { ra: 10.12, dec: 16.76 },
      { ra: 10.33, dec: 19.84 },
      { ra: 11.24, dec: 20.52 },
      { ra: 11.82, dec: 14.57 }, // 데네볼라
      { ra: 11.24, dec: 15.43 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 5], [5, 4], [5, 0]],
  },
  cygnus: {
    key: 'cygnus',
    name: '백조자리',
    raHours: 20.7,
    stars: [
      { ra: 20.69, dec: 45.28 }, // 데네브
      { ra: 20.37, dec: 40.26 }, // 사드르
      { ra: 19.51, dec: 27.96 }, // 알비레오
      { ra: 19.75, dec: 45.13 },
      { ra: 20.77, dec: 33.97 },
    ],
    lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  pegasus: {
    key: 'pegasus',
    name: '페가수스자리',
    raHours: 23.0,
    stars: [
      { ra: 23.08, dec: 15.2 }, // 마르카브
      { ra: 23.06, dec: 28.08 }, // 쉐아트
      { ra: 24.14, dec: 29.09 }, // 알페라츠
      { ra: 24.22, dec: 15.18 }, // 알게닙
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
};

export const CONSTELLATION_KEYS = Object.keys(CONSTELLATIONS) as ConstellationKey[];

const circDist = (a: number, b: number) => {
  const d = Math.abs(mod(a, 24) - mod(b, 24));
  return Math.min(d, 24 - d);
};

/** 표에서 적경이 가장 가까운 별자리(24시간 순환 거리). */
export function nearestConstellation(raHours: number): ConstellationKey {
  let best = CONSTELLATION_KEYS[0]!;
  for (const k of CONSTELLATION_KEYS) {
    if (circDist(CONSTELLATIONS[k].raHours, raHours) < circDist(CONSTELLATIONS[best].raHours, raHours)) best = k;
  }
  return best;
}

/** 그 날짜·시각에 남쪽 자오선을 지나는 하늘에서 가장 가까운 별자리. */
export function southConstellationAt(dayOfYear: number, hour: number): ConstellationKey {
  return nearestConstellation(localSiderealHours(dayOfYear, hour));
}

/** 오후 9시 남쪽 하늘 자오선의 적경 = raSun + 9시. */
export function southConstellationAt9pm(dayOfYear: number): ConstellationKey {
  return southConstellationAt(dayOfYear, 21);
}

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
/** 그 달 15일의 일(day of year). 평년 기준. */
export function dayOfMonth15(month: number): number {
  return MONTH_START[Math.min(12, Math.max(1, Math.round(month))) - 1]! + 15;
}

// ---- 과제 정답 규칙 ----

export type AnswerControls = Record<string, string | number | undefined>;

export interface AnswerOptions {
  latDeg?: number;
  /** 태양 과제에 쓰는 날짜(기본 춘분). */
  dayOfYear?: number;
}

/** 별 과제의 날짜(1월 15일)와 시각(오후 9시·자정). */
export const STAR_TASK_DAY = dayOfMonth15(1);
export const STAR_TASK_START_HOUR = 21;

const rotationOf = (c: AnswerControls): Rotation => (c.rotation === 'reverse' ? 'reverse' : 'forward');

/** 방위각의 증감으로 움직이는 방향을 정한다. 증가 = 동쪽 → 남쪽 → 서쪽. */
function directionFromAz(a: number, b: number): 'east-to-west' | 'west-to-east' | 'still' {
  const diff = b - a;
  if (Math.abs(diff) < 1e-6) return 'still';
  return diff > 0 ? 'east-to-west' : 'west-to-east';
}

/** 같은 하늘 위의 두 점(고도·방위각) 사이 각거리(°). */
export function skyAngularDistanceDeg(a: SkyPoint, b: SkyPoint): number {
  const v = (p: SkyPoint): [number, number, number] => {
    const alt = p.altDeg * RAD;
    const az = p.azDeg * RAD;
    return [Math.cos(alt) * Math.cos(az), Math.cos(alt) * Math.sin(az), Math.sin(alt)];
  };
  const [x1, y1, z1] = v(a);
  const [x2, y2, z2] = v(b);
  return Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2))) * DEG;
}

/** 별 과제의 두 시각(오후 9시와 자정)의 하늘 위치. */
export function starTaskPositions(key: NorthStarKey, controls: AnswerControls = {}, latDeg: number = SEOUL_LAT_DEG): [SkyPoint, SkyPoint] {
  const star = northStar(key);
  const rotation = rotationOf(controls);
  const at = (hour: number) => starPosition({ raHours: star.ra, decDeg: star.dec, hour, dayOfYear: STAR_TASK_DAY, latDeg, rotation });
  return [at(STAR_TASK_START_HOUR), at(24)];
}

/** 오후 9시부터 자정까지 그 별이 하늘에서 움직인 각도(°). */
export function starMotionDeg(key: NorthStarKey, controls: AnswerControls = {}, latDeg: number = SEOUL_LAT_DEG): number {
  const [a, b] = starTaskPositions(key, controls, latDeg);
  return skyAngularDistanceDeg(a, b);
}

/** 이 각도(°)보다 적게 움직이면 거의 움직이지 않는 것으로 본다. */
export const STILL_THRESHOLD_DEG = 1;

/** 모델에서 계산한 과제 정답. 같은 규칙·조건이면 항상 같은 값을 돌려준다. */
export function answerFor(rule: ObservationAnswerRule, controls: AnswerControls = {}, opts: AnswerOptions = {}): string {
  const latDeg = opts.latDeg ?? SEOUL_LAT_DEG;
  const rotation = rotationOf(controls);
  switch (rule) {
    case 'sun-path-direction': {
      const day = opts.dayOfYear ?? EQUINOX_DAY;
      const am = sunPosition({ hour: 9, dayOfYear: day, latDeg, rotation });
      const pm = sunPosition({ hour: 15, dayOfYear: day, latDeg, rotation });
      return directionFromAz(am.azDeg, pm.azDeg);
    }
    case 'star-path-direction': {
      const key = southConstellationAt(STAR_TASK_DAY, STAR_TASK_START_HOUR);
      const star = CONSTELLATIONS[key].stars[0]!;
      const at = (hour: number) =>
        starPosition({ raHours: star.ra, decDeg: star.dec, hour, dayOfYear: STAR_TASK_DAY, latDeg, rotation });
      return directionFromAz(at(21).azDeg, at(24).azDeg);
    }
    case 'antipode-day-night':
      return isDaylight({ hour: 12, lonOffsetDeg: 180 }) ? 'day' : 'night';
    case 'constellation-changes': {
      const found = new Set([1, 4, 8, 10].map((m) => southConstellationAt9pm(dayOfMonth15(m))));
      return found.size === 1 ? 'same' : 'changes';
    }
    case 'winter-constellation':
      return southConstellationAt9pm(dayOfMonth15(1));
    case 'jupiter-earth-size':
      return String(Math.round(sizeRatio('jupiter')));
    case 'neptune-distance':
      return String(Math.round(distanceCells('neptune')));
    case 'pointer-star-target':
      return pointerStarKey();
    case 'polaris-motion': {
      if (starMotionDeg('polaris', controls, latDeg) < STILL_THRESHOLD_DEG) return 'nearly-still';
      const [a, b] = starTaskPositions('polaris', controls, latDeg);
      const dir = directionFromAz(a.azDeg, b.azDeg);
      return dir === 'still' ? 'nearly-still' : dir;
    }
    case 'moon-evening-change':
      return moonEveningChange(3, 10, latDeg);
    case 'full-moon-day':
      return String(fullMoonDay());
  }
}

// ---- 매니페스트 검사 ----

/** 조작(controls)의 모든 조합. controls가 없으면 빈 조합 하나. */
export function controlCombos(controls: { key: string; options: { value: string | number }[] }[] = []): Record<string, string | number>[] {
  return controls.reduce<Record<string, string | number>[]>(
    (acc, c) => acc.flatMap((combo) => c.options.map((o) => ({ ...combo, [c.key]: o.value }))),
    [{}],
  );
}

const PROBE_WHENS = ['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch'] as const;

/** 관찰 활동 매니페스트 검사. 문제가 없으면 빈 배열. */
export function validateSkyObservation(exp: ObservationExperiment): string[] {
  const issues: string[] = [];
  const lat = exp.params?.latDeg;
  if (lat !== undefined && !(typeof lat === 'number' && lat >= -90 && lat <= 90)) {
    issues.push('params.latDeg는 -90~90 사이 숫자여야 합니다.');
  }
  const day = exp.params?.dayOfYear;
  if (day !== undefined && !(typeof day === 'number' && day >= 1 && day <= 366)) {
    issues.push('params.dayOfYear는 1~366 사이 숫자여야 합니다.');
  }
  const ids = new Set<string>();
  for (const task of exp.tasks) {
    if (ids.has(task.id)) issues.push(`${task.id}: 과제 id가 겹칩니다.`);
    ids.add(task.id);
    for (const when of PROBE_WHENS) {
      if (!task.probes.some((p) => p.when === when)) issues.push(`${task.id}: ${when} 질문이 없습니다.`);
    }
    const values = new Set(task.options.map((o) => o.value));
    if (values.size !== task.options.length) issues.push(`${task.id}: 선택지 value가 겹칩니다.`);
    const controlKeys = new Set<string>();
    for (const c of task.controls ?? []) {
      if (controlKeys.has(c.key)) issues.push(`${task.id}: 조작 key(${c.key})가 겹칩니다.`);
      controlKeys.add(c.key);
    }
    for (const combo of controlCombos(task.controls)) {
      const result = answerFor(task.answer, combo, {
        latDeg: typeof lat === 'number' ? lat : undefined,
        dayOfYear: typeof day === 'number' ? day : undefined,
      });
      if (!values.has(result)) {
        issues.push(`${task.id}: 모델 결과 "${result}"가 선택지에 없습니다(${JSON.stringify(combo)}).`);
      }
    }
  }
  return issues;
}

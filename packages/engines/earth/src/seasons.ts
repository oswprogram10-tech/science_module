import type { VariableExperiment as Experiment } from '@sci/schema';
import { SEOUL_LAT_DEG, sunPositionAtDeclination } from './astro';

export type SeasonKind = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SunAngleParams {
  season: SeasonKind;
  /** 자전축 기울기(°). 실제는 23.44. */
  tiltDeg: number;
  /** 태양 고도 측정기의 막대 길이(cm). 측정 도구일 뿐 태양 고도에는 영향이 없다. */
  stickCm: number;
}

export interface SunAngleOptions {
  latDeg?: number;
  /** 샘플 간격(시간 단위) */
  sampleEveryH?: number;
}

export interface SunAngleSample {
  /** 하루 안의 지방 태양시(0~24, 시간 단위) */
  t: number;
  /** 태양 고도(°). 지평선 아래면 0. */
  sunAltDeg: number;
  /** 막대 그림자 길이(cm). 고도가 2° 이하면 −1(아주 길다는 뜻). */
  shadowCm: number;
  /** 땅이 받는 빛의 세기 상대값(%) */
  lightPct: number;
}

export interface SunAngleResult {
  /** 낮 12시 태양 고도(°), 소수 첫째 자리 */
  noonAltDeg: number;
  /** 낮 12시 그림자 길이(cm), 소수 첫째 자리 */
  noonShadowCm: number;
  /** 낮의 길이(시간), 소수 둘째 자리 */
  dayLengthH: number;
  /** 하루 동안 땅이 받은 태양 에너지. 같은 위도·기울기 23.5°의 봄 값을 100으로 한 정수. */
  energyIdx: number;
}

export interface SunAngleOutput {
  samples: SunAngleSample[];
  result: SunAngleResult;
}

export const SEASONS: readonly SeasonKind[] = ['spring', 'summer', 'autumn', 'winter'];

/** 공전 궤도 위의 위치 각(°) */
export const ORBIT_DEG: Record<SeasonKind, number> = { spring: 0, summer: 90, autumn: 180, winter: 270 };

export const REAL_TILT_DEG = 23.44;
/** 이 고도(°) 이하면 그림자를 재지 않고 "아주 길다"로 본다. */
export const LONG_SHADOW_ALT_DEG = 2;
export const TILT_MAX_DEG = 45;
export const STICK_MIN_CM = 1;
export const STICK_MAX_CM = 100;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: SunAngleParams): void {
  if (!SEASONS.includes(p.season)) throw new RangeError(`계절 ${String(p.season)}은(는) spring, summer, autumn, winter 중 하나여야 합니다.`);
  if (typeof p.tiltDeg !== 'number' || !Number.isFinite(p.tiltDeg) || p.tiltDeg < 0 || p.tiltDeg > TILT_MAX_DEG) {
    throw new RangeError(`자전축 기울기 ${String(p.tiltDeg)}은(는) 0 이상 ${TILT_MAX_DEG} 이하의 수여야 합니다.`);
  }
  if (typeof p.stickCm !== 'number' || !Number.isFinite(p.stickCm) || p.stickCm < STICK_MIN_CM || p.stickCm > STICK_MAX_CM) {
    throw new RangeError(`막대 길이 ${String(p.stickCm)}은(는) ${STICK_MIN_CM} 이상 ${STICK_MAX_CM} 이하의 수여야 합니다.`);
  }
}

function checkOptions(latDeg: number, sampleEveryH: number): void {
  if (!(latDeg >= -90 && latDeg <= 90)) throw new RangeError('위도는 -90~90 사이여야 합니다.');
  if (!(sampleEveryH > 0 && sampleEveryH <= 24)) throw new RangeError('샘플 간격이 올바르지 않습니다.');
}

/** 그 계절 위치의 태양 적위(°) = 기울기 × sin(공전 위치 각). 화면에는 쓰지 않는다. */
export function declinationOf(season: SeasonKind, tiltDeg: number): number {
  // sin(180°) 같은 부동소수 찌꺼기를 없애 봄과 가을이 똑같은 값이 되게 한다.
  return round(tiltDeg * Math.sin(ORBIT_DEG[season] * RAD), 12) + 0;
}

/** sin(고도) = a + b·cos(시간각)의 계수 */
function coefficients(decDeg: number, latDeg: number): { a: number; b: number } {
  const d = decDeg * RAD;
  const p = latDeg * RAD;
  return { a: Math.sin(p) * Math.sin(d), b: Math.cos(p) * Math.cos(d) };
}

/** 하루 동안 sin(고도)를 양수인 때만 시간에 대해 적분한 값(단위: 시간각 rad. 비율을 구할 때만 쓴다). */
function dailyEnergy(decDeg: number, latDeg: number): number {
  const { a, b } = coefficients(decDeg, latDeg);
  let h0: number;
  if (b < 1e-12) h0 = a > 0 ? Math.PI : 0;
  else {
    const x = -a / b;
    h0 = x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x);
  }
  return a * h0 + b * Math.sin(h0);
}

/** 낮의 길이(시간, 반올림 없음) = 2·acos(−tanφ·tanδ)/15 */
function dayLengthRaw(decDeg: number, latDeg: number): number {
  const x = -Math.tan(latDeg * RAD) * Math.tan(decDeg * RAD);
  return (2 * Math.acos(Math.min(1, Math.max(-1, x))) * DEG) / 15;
}

/**
 * 태양 고도 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 태양 위치는 astro.ts와 같은 식(적위를 직접 받는 sunPositionAtDeclination)으로 구한다.
 */
export function simulateSunAngle(params: SunAngleParams, opts: SunAngleOptions = {}): SunAngleOutput {
  checkParams(params);
  const latDeg = opts.latDeg ?? SEOUL_LAT_DEG;
  const sampleEveryH = opts.sampleEveryH ?? 0.1;
  checkOptions(latDeg, sampleEveryH);
  const decDeg = declinationOf(params.season, params.tiltDeg);

  const altAt = (hour: number) => sunPositionAtDeclination({ hour, decDeg, latDeg }).altDeg;
  const shadowOf = (altDeg: number) => (altDeg > LONG_SHADOW_ALT_DEG ? params.stickCm / Math.tan(altDeg * RAD) : -1);

  const steps = Math.floor(24 / sampleEveryH + 1e-9);
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEveryH, 6));
  if (times[times.length - 1]! < 24 - 1e-9) times.push(24);
  const samples = times.map((t): SunAngleSample => {
    const alt = altAt(t);
    const sunAltDeg = Math.max(alt, 0);
    return { t, sunAltDeg, shadowCm: shadowOf(sunAltDeg), lightPct: 100 * Math.max(0, Math.sin(alt * RAD)) };
  });

  const noonAlt = altAt(12);
  const reference = dailyEnergy(0, latDeg);
  const result: SunAngleResult = {
    noonAltDeg: round(noonAlt, 1),
    noonShadowCm: round(shadowOf(noonAlt), 1),
    dayLengthH: round(dayLengthRaw(decDeg, latDeg), 2),
    energyIdx: reference > 0 ? Math.round((100 * dailyEnergy(decDeg, latDeg)) / reference) : 0,
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. 둘 중 하나라도 그림자가 "아주 길다"(−1)면 −1로 둔다. */
export function interpolateSunAngle(a: SunAngleSample, b: SunAngleSample, k: number): SunAngleSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    sunAltDeg: lerp(a.sunAltDeg, b.sunAltDeg),
    shadowCm: a.shadowCm < 0 || b.shadowCm < 0 ? -1 : lerp(a.shadowCm, b.shadowCm),
    lightPct: lerp(a.lightPct, b.lightPct),
  };
}

/** 이 조건의 낮 12시 땅에 닿는 빛의 넓이가 봄(같은 위도)의 몇 배인가. 넓이는 1/sin(남중 고도)에 비례한다. */
export function lightAreaRatio(params: SunAngleParams, opts: SunAngleOptions = {}): number {
  checkParams(params);
  const latDeg = opts.latDeg ?? SEOUL_LAT_DEG;
  checkOptions(latDeg, opts.sampleEveryH ?? 0.1);
  const { a, b } = coefficients(declinationOf(params.season, params.tiltDeg), latDeg);
  const spring = coefficients(0, latDeg);
  const sinNoon = a + b;
  return sinNoon > 1e-9 ? (spring.a + spring.b) / sinNoon : Infinity;
}

const KEYS = ['season', 'tiltDeg', 'stickCm'] as const;

/** 매니페스트의 태양 고도 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSunAngleExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'season') {
        if (typeof val !== 'string' || !SEASONS.includes(val as SeasonKind)) bad(`${SEASONS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
      else if (key === 'tiltDeg' && (val < 0 || val > TILT_MAX_DEG)) bad(`자전축 기울기는 0~${TILT_MAX_DEG}° 범위여야 합니다.`);
      else if (key === 'stickCm' && (val < STICK_MIN_CM || val > STICK_MAX_CM)) bad(`막대 길이는 ${STICK_MIN_CM}~${STICK_MAX_CM} cm 범위여야 합니다.`);
    }
  }
  const lat = exp.params?.latDeg;
  if (lat !== undefined && !(typeof lat === 'number' && lat >= -90 && lat <= 90)) {
    errors.push('params.latDeg는 -90~90 사이 숫자여야 합니다.');
  }
  return errors;
}

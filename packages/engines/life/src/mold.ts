import type { VariableExperiment as Experiment } from '@sci/schema';

export type MoistureKind = 'dry' | 'wet';
export type MoldLightKind = 'bright' | 'dark';

export interface MoldParams {
  moisture: MoistureKind;
  /** 온도(°C) */
  tempC: number;
  /** 대조 변인. 이 모델에서는 결과에 영향이 없다. */
  light: MoldLightKind;
}

export interface MoldOptions {
  /** 관찰하는 날 수 */
  days?: number;
  /** 샘플 간격(일) */
  sampleEveryDay?: number;
}

export interface MoldSample {
  /** 경과일 */
  t: number;
  /** 곰팡이가 덮은 넓이(%) */
  coverPct: number;
  /** 포자가 많은 정도(0~1) = max(0, (coverPct − 20) / 80) */
  spores: number;
}

export interface MoldResult {
  /** 7일째 덮은 넓이(%, 반올림) */
  cover7: number;
  /** 10일째 덮은 넓이(%, 반올림) */
  cover10: number;
  /** 곰팡이가 처음 보인 날(소수 첫째 자리). 관찰 기간 안에 안 보이면 null. */
  firstDay: number | null;
}

export interface MoldOutput {
  samples: MoldSample[];
  result: MoldResult;
}

export const MOISTURES: readonly MoistureKind[] = ['dry', 'wet'];
export const MOLD_LIGHTS: readonly MoldLightKind[] = ['bright', 'dark'];
export const MOLD_TEMP_MIN_C = 0;
export const MOLD_TEMP_MAX_C = 40;
export const MOLD_DEFAULT_DAYS = 10;
/** 결과를 읽는 날 */
export const MOLD_DAY_A = 7;
export const MOLD_DAY_B = 10;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** 온도 → 자람 정도. 표의 점 사이는 선형 보간하고, 0 °C 이하는 0, 40 °C 이상은 0.5. */
const TEMP_POINTS: readonly [number, number][] = [
  [0, 0],
  [5, 0.25],
  [20, 1],
  [30, 1.3],
  [40, 0.5],
];

export function moldTemperatureFactor(tempC: number): number {
  const first = TEMP_POINTS[0]!;
  const last = TEMP_POINTS[TEMP_POINTS.length - 1]!;
  if (tempC <= first[0]) return first[1];
  if (tempC >= last[0]) return last[1];
  for (let i = 1; i < TEMP_POINTS.length; i++) {
    const [x1, y1] = TEMP_POINTS[i]!;
    if (tempC <= x1) {
      const [x0, y0] = TEMP_POINTS[i - 1]!;
      return y0 + ((y1 - y0) * (tempC - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** 빵의 물기 → 자람 정도 */
export const moldMoistureFactor = (moisture: MoistureKind): number => (moisture === 'wet' ? 1 : 0.3);

function checkParams(p: MoldParams): void {
  if (!MOISTURES.includes(p.moisture)) throw new RangeError(`물기 ${String(p.moisture)}은(는) dry, wet 중 하나여야 합니다.`);
  if (typeof p.tempC !== 'number' || !Number.isFinite(p.tempC)) throw new RangeError(`온도 ${String(p.tempC)}은(는) 수여야 합니다.`);
  if (!MOLD_LIGHTS.includes(p.light)) throw new RangeError(`빛 ${String(p.light)}은(는) bright, dark 중 하나여야 합니다.`);
}

function checkOptions(days: number, sampleEveryDay: number): void {
  if (!(days >= MOLD_DAY_A)) throw new RangeError(`관찰 기간은 ${MOLD_DAY_A}일 이상이어야 합니다.`);
  if (!(sampleEveryDay > 0 && sampleEveryDay <= days)) throw new RangeError('샘플 간격이 올바르지 않습니다.');
}

/**
 * 곰팡이가 자라는 근사 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 빛은 쓰지 않는다(대조 변인).
 */
export function simulateMold(params: MoldParams, opts: MoldOptions = {}): MoldOutput {
  checkParams(params);
  const days = opts.days ?? MOLD_DEFAULT_DAYS;
  const sampleEveryDay = opts.sampleEveryDay ?? 0.1;
  checkOptions(days, sampleEveryDay);

  const f = moldTemperatureFactor(params.tempC) * moldMoistureFactor(params.moisture);
  const lag = f > 0 ? 2 / f : Infinity;
  const k = 0.9 * f;
  /** 덮은 넓이 C(t). 지체 기간이 지나면 1 %에서 시작하는 로지스틱 곡선. */
  const cover = (t: number) => (f > 0 && t >= lag ? 100 / (1 + 99 * Math.exp(-k * (t - lag))) : 0);

  const steps = Math.floor(days / sampleEveryDay + 1e-9);
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEveryDay, 6));
  if (times[times.length - 1]! < days - 1e-9) times.push(days);
  const samples = times.map((t): MoldSample => {
    const coverPct = cover(t);
    return { t, coverPct, spores: Math.max(0, (coverPct - 20) / 80) };
  });

  const result: MoldResult = {
    cover7: Math.round(cover(MOLD_DAY_A)),
    cover10: Math.round(cover(MOLD_DAY_B)),
    firstDay: lag <= days ? round(lag, 1) : null,
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateMold(a: MoldSample, b: MoldSample, k: number): MoldSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), coverPct: lerp(a.coverPct, b.coverPct), spores: lerp(a.spores, b.spores) };
}

const KEYS = ['moisture', 'tempC', 'light'] as const;

/** 매니페스트의 곰팡이 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateMoldExperiment(exp: Experiment): string[] {
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
      if (key === 'moisture') {
        if (typeof val !== 'string' || !MOISTURES.includes(val as MoistureKind)) bad(`${MOISTURES.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'light') {
        if (typeof val !== 'string' || !MOLD_LIGHTS.includes(val as MoldLightKind)) bad(`${MOLD_LIGHTS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
      else if (val < MOLD_TEMP_MIN_C || val > MOLD_TEMP_MAX_C) bad(`온도는 ${MOLD_TEMP_MIN_C}~${MOLD_TEMP_MAX_C} °C 범위여야 합니다.`);
    }
  }
  const { days } = exp.params ?? {};
  if (days !== undefined && !(typeof days === 'number' && Number.isInteger(days) && days >= MOLD_DAY_B && days <= 30)) {
    errors.push(`params.days는 ${MOLD_DAY_B}~30 사이 정수여야 합니다.`);
  }
  return errors;
}

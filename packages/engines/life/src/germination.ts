import type { VariableExperiment as Experiment } from '@sci/schema';

export type WaterKind = 'none' | 'water';
export type LightKind = 'bright' | 'dark';
export type LeafColor = 'green' | 'yellow';

export interface GerminationParams {
  water: WaterKind;
  /** 온도(°C) */
  tempC: number;
  light: LightKind;
}

export interface GerminationOptions {
  /** 그릇에 담은 씨앗 수 */
  seeds?: number;
  /** 관찰하는 날 수 */
  days?: number;
  /** 샘플 간격(일) */
  sampleEveryDay?: number;
  /** 싹 트는 때가 퍼진 정도(로지스틱 곡선의 폭, 일) */
  spread?: number;
}

export interface GerminationSample {
  /** 경과일 */
  t: number;
  /** 싹 튼 씨앗 수(연속값) */
  sprouted: number;
  /** 떡잎의 초록 정도(0~1). 어두운 곳은 0. */
  greenness: number;
  /** 가장 먼저 싹 튼 씨앗의 줄기 길이(mm) */
  stemMm: number;
}

export interface GerminationResult {
  /** 7일째 싹 튼 씨앗 수(반올림한 정수) */
  sproutedDay7: number;
  /** 처음 싹 튼 날(소수 첫째 자리). 없으면 null. */
  firstDay: number | null;
  /** 떡잎 색. 싹이 하나도 안 텄으면 null. */
  leafColor: LeafColor | null;
}

export interface GerminationOutput {
  samples: GerminationSample[];
  result: GerminationResult;
}

export const WATERS: readonly WaterKind[] = ['none', 'water'];
export const LIGHTS: readonly LightKind[] = ['bright', 'dark'];
export const TEMP_MIN_C = 0;
export const TEMP_MAX_C = 40;
export const DEFAULT_SEEDS = 10;
export const DEFAULT_DAYS = 10;
/** 결과를 읽는 날 */
export const RESULT_DAY = 7;
/** 줄기가 하루에 자라는 길이(mm)와 최대 길이 */
export const STEM_MM_PER_DAY = { bright: 5, dark: 8 } as const;
export const STEM_MAX_MM = 60;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** 온도 → [최대 비율, 빠르기]. 표의 점 사이는 선형 보간하고, 0 °C 이하와 40 °C 이상은 [0, 0]. */
const TEMP_POINTS: readonly [number, number, number][] = [
  [0, 0, 0],
  [5, 0, 0],
  [20, 1, 1],
  [30, 1, 1.3],
  [40, 0, 0],
];

export function temperatureFactors(tempC: number): { pmax: number; rate: number } {
  if (tempC <= TEMP_POINTS[0]![0] || tempC >= TEMP_POINTS[TEMP_POINTS.length - 1]![0]) return { pmax: 0, rate: 0 };
  for (let i = 1; i < TEMP_POINTS.length; i++) {
    const [x1, p1, r1] = TEMP_POINTS[i]!;
    if (tempC <= x1) {
      const [x0, p0, r0] = TEMP_POINTS[i - 1]!;
      const k = (tempC - x0) / (x1 - x0);
      return { pmax: p0 + (p1 - p0) * k, rate: r0 + (r1 - r0) * k };
    }
  }
  return { pmax: 0, rate: 0 };
}

/** 물 → [최대 비율, 빠르기] */
export const waterFactors = (water: WaterKind): { pmax: number; rate: number } =>
  water === 'water' ? { pmax: 0.9, rate: 1 } : { pmax: 0, rate: 0 };

function checkParams(p: GerminationParams): void {
  if (!WATERS.includes(p.water)) throw new RangeError(`물 ${String(p.water)}은(는) none, water 중 하나여야 합니다.`);
  if (typeof p.tempC !== 'number' || !Number.isFinite(p.tempC) || p.tempC < TEMP_MIN_C || p.tempC > TEMP_MAX_C) {
    throw new RangeError(`온도 ${String(p.tempC)}은(는) ${TEMP_MIN_C} 이상 ${TEMP_MAX_C} 이하의 수여야 합니다.`);
  }
  if (!LIGHTS.includes(p.light)) throw new RangeError(`빛 ${String(p.light)}은(는) bright, dark 중 하나여야 합니다.`);
}

function checkOptions(seeds: number, days: number, sampleEveryDay: number, spread: number): void {
  if (!Number.isInteger(seeds) || seeds < 1) throw new RangeError('씨앗 수는 1 이상의 정수여야 합니다.');
  if (!(days >= RESULT_DAY)) throw new RangeError(`관찰 기간은 ${RESULT_DAY}일 이상이어야 합니다.`);
  if (!(sampleEveryDay > 0 && sampleEveryDay <= days)) throw new RangeError('샘플 간격이 올바르지 않습니다.');
  if (!(spread > 0)) throw new RangeError('spread는 0보다 커야 합니다.');
}

/**
 * 씨앗이 싹 트는 근사 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 빛은 싹 트는 데 영향이 없고 떡잎 색과 줄기 길이에만 영향을 준다.
 */
export function simulateGermination(params: GerminationParams, opts: GerminationOptions = {}): GerminationOutput {
  checkParams(params);
  const seeds = opts.seeds ?? DEFAULT_SEEDS;
  const days = opts.days ?? DEFAULT_DAYS;
  const sampleEveryDay = opts.sampleEveryDay ?? 0.1;
  const spread = opts.spread ?? 0.8;
  checkOptions(seeds, days, sampleEveryDay, spread);

  const w = waterFactors(params.water);
  const tf = temperatureFactors(params.tempC);
  const pmax = w.pmax * tf.pmax;
  const rate = w.rate * tf.rate;
  const possible = pmax > 0 && rate > 0;
  const tmid = possible ? 4 / rate : 0;
  const base = possible ? pmax * sigmoid(-tmid / spread) : 0;
  /** 누적 싹 튼 비율 G(t) */
  const G = (t: number) => (possible ? Math.max(0, pmax * sigmoid((t - tmid) / spread) - base) : 0);

  // 처음 싹 튼 때: seeds·G(t) ≥ 0.5가 되는 가장 이른 t(G는 증가하므로 이분법). 샘플 간격에 얽매이지 않는다.
  let firstRaw: number | null = null;
  if (seeds * G(days) >= 0.5) {
    let lo = 0;
    let hi = days;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (seeds * G(mid) >= 0.5) hi = mid;
      else lo = mid;
    }
    firstRaw = hi;
  }

  const perDay = STEM_MM_PER_DAY[params.light];
  const steps = Math.floor(days / sampleEveryDay + 1e-9);
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEveryDay, 6));
  if (times[times.length - 1]! < days - 1e-9) times.push(days);
  const samples = times.map((t): GerminationSample => {
    const started = firstRaw !== null && t >= firstRaw;
    return {
      t,
      sprouted: seeds * G(t),
      greenness: started && params.light === 'bright' ? 1 : 0,
      stemMm: started ? Math.min(STEM_MAX_MM, (t - firstRaw!) * perDay) : 0,
    };
  });

  const sproutedDay7 = Math.round(seeds * G(RESULT_DAY));
  const result: GerminationResult = {
    sproutedDay7,
    firstDay: firstRaw === null ? null : round(firstRaw, 1),
    leafColor: firstRaw === null ? null : params.light === 'bright' ? 'green' : 'yellow',
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateGermination(a: GerminationSample, b: GerminationSample, k: number): GerminationSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    sprouted: lerp(a.sprouted, b.sprouted),
    greenness: lerp(a.greenness, b.greenness),
    stemMm: lerp(a.stemMm, b.stemMm),
  };
}

const KEYS = ['water', 'tempC', 'light'] as const;

/** 매니페스트의 싹 트기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateGerminationExperiment(exp: Experiment): string[] {
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
      if (key === 'water') {
        if (typeof val !== 'string' || !WATERS.includes(val as WaterKind)) bad(`${WATERS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'light') {
        if (typeof val !== 'string' || !LIGHTS.includes(val as LightKind)) bad(`${LIGHTS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
      else if (val < TEMP_MIN_C || val > TEMP_MAX_C) bad(`온도는 ${TEMP_MIN_C}~${TEMP_MAX_C} °C 범위여야 합니다.`);
    }
  }
  const { seeds, days } = exp.params ?? {};
  if (seeds !== undefined && !(typeof seeds === 'number' && Number.isInteger(seeds) && seeds >= 1 && seeds <= 20)) {
    errors.push('params.seeds는 1~20 사이 정수여야 합니다.');
  }
  if (days !== undefined && !(typeof days === 'number' && Number.isInteger(days) && days >= RESULT_DAY && days <= 30)) {
    errors.push(`params.days는 ${RESULT_DAY}~30 사이 정수여야 합니다.`);
  }
  return errors;
}

import type { VariableExperiment as Experiment } from '@sci/schema';

export type PlaceKind = 'ice' | 'room' | 'warm';
export type DishKind = 'glass' | 'aluminum';
export type RockLike = 'basalt' | 'between' | 'granite';

export interface MagmaParams {
  place: PlaceKind;
  grams: number;
  dish: DishKind;
  /** 물질의 색깔. 결과에 영향이 없는 대조 변인이다. */
  color: string;
}

export interface MagmaOptions {
  /** 녹은 물질의 처음 온도(°C) */
  startC?: number;
  /** 알갱이가 생기기 시작하는 온도(°C) */
  windowHighC?: number;
  /** 알갱이가 다 자라는 온도(°C) */
  windowLowC?: number;
  /** 다 굳었다고 보는 온도(°C) */
  solidC?: number;
  /** 5 g을 유리 접시에 담았을 때의 시간 상수(초) */
  baseTauS?: number;
  /** 알갱이가 자라는 구간 1초당 평균 크기(mm) */
  sizePerSecond?: number;
  sampleEvery?: number;
  /** 다 굳은 뒤 더 이어서 재는 시간(초) */
  tailS?: number;
}

export interface MagmaSample {
  t: number;
  tempC: number;
  /** 결정화 진행도(0~1) */
  crystal: number;
}

export interface MagmaResult {
  /** 굳은 뒤 알갱이의 평균 크기(mm), 소수 둘째 자리 */
  sizeMm: number;
  /** 다 굳는 시각(초), 소수 첫째 자리 */
  solidS: number;
  rockLike: RockLike;
}

export interface MagmaOutput {
  samples: MagmaSample[];
  result: MagmaResult;
}

export const PLACES: readonly PlaceKind[] = ['ice', 'room', 'warm'];
export const DISHES: readonly DishKind[] = ['glass', 'aluminum'];

/** 식히는 곳의 주변 온도(°C) */
export const AMBIENT_C: Record<PlaceKind, number> = { ice: 0, room: 20, warm: 50 };

/** rockLike 경계(mm): 0.7 미만 basalt, 2.0 미만 between, 그 이상 granite */
export const BASALT_MAX_MM = 0.7;
export const GRANITE_MIN_MM = 2.0;

const DEFAULTS = {
  startC: 90,
  windowHighC: 75,
  windowLowC: 65,
  solidC: 60,
  baseTauS: 40,
  sizePerSecond: 0.1,
  sampleEvery: 0.5,
  tailS: 5,
};

/** undefined인 옵션은 기본값을 쓴다. */
const withDefaults = (opts: MagmaOptions): Required<MagmaOptions> => {
  const out: Required<MagmaOptions> = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as (keyof MagmaOptions)[]) {
    const v = opts[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
};

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export const rockLikeOf = (sizeMm: number): RockLike => (sizeMm < BASALT_MAX_MM ? 'basalt' : sizeMm < GRANITE_MIN_MM ? 'between' : 'granite');

function checkParams(p: MagmaParams): void {
  if (!PLACES.includes(p.place)) throw new RangeError(`식히는 곳 ${String(p.place)}은(는) ice, room, warm 중 하나여야 합니다.`);
  if (typeof p.grams !== 'number' || !Number.isFinite(p.grams) || p.grams < 1 || p.grams > 50) {
    throw new RangeError(`녹인 양 ${String(p.grams)}은(는) 1 이상 50 이하의 수여야 합니다.`);
  }
  if (!DISHES.includes(p.dish)) throw new RangeError(`접시 ${String(p.dish)}은(는) glass, aluminum 중 하나여야 합니다.`);
  if (typeof p.color !== 'string') throw new RangeError('색깔은 문자열이어야 합니다.');
}

/** 시간 상수 τ = baseTauS × (grams / 5) × (알루미늄이면 0.5). 색깔은 영향이 없다. */
function tauOf(p: MagmaParams, baseTauS: number): number {
  return baseTauS * (p.grams / 5) * (p.dish === 'aluminum' ? 0.5 : 1);
}

/** 알갱이가 자라는 구간의 시작·끝 시각(초, 반올림 없음). 그래프 표식에 쓴다. */
export function growWindow(params: MagmaParams, opts: MagmaOptions = {}): { startS: number; endS: number } {
  const { startC, windowHighC, windowLowC, baseTauS } = withDefaults(opts);
  checkParams(params);
  const te = AMBIENT_C[params.place];
  const tau = tauOf(params, baseTauS);
  return {
    startS: tau * Math.log((startC - te) / (windowHighC - te)),
    endS: tau * Math.log((startC - te) / (windowLowC - te)),
  };
}

/**
 * 마그마 냉각 모델. 수치는 근사값이며 교사 검수 대상이다.
 * T(t) = Te + (startC − Te)·e^(−t/τ), 알갱이는 T가 windowHighC에서 windowLowC로 내려가는 동안 자란다.
 * 구간 길이 growS = τ·ln((75 − Te)/(65 − Te)), 평균 크기 = sizePerSecond × growS.
 */
export function simulateMagma(params: MagmaParams, opts: MagmaOptions = {}): MagmaOutput {
  const { startC, windowHighC, windowLowC, solidC, baseTauS, sizePerSecond, sampleEvery, tailS } = withDefaults(opts);
  checkParams(params);
  if (!(sampleEvery > 0) || !(baseTauS > 0) || !(tailS >= 0)) throw new RangeError('시간 값이 올바르지 않습니다.');
  if (!(startC > windowHighC && windowHighC > windowLowC && windowLowC > solidC)) throw new RangeError('온도 기준이 올바르지 않습니다.');
  const te = AMBIENT_C[params.place];
  if (!(te < solidC)) throw new RangeError('주변 온도는 굳는 온도보다 낮아야 합니다.');
  const tau = tauOf(params, baseTauS);

  const growS = tau * Math.log((windowHighC - te) / (windowLowC - te));
  const sizeMm = round(sizePerSecond * growS, 2);
  const solidS = round(tau * Math.log((startC - te) / (solidC - te)), 1);
  const endS = solidS + tailS;

  const at = (t: number): MagmaSample => {
    const tempC = te + (startC - te) * Math.exp(-t / tau);
    const crystal = tempC >= windowHighC ? 0 : tempC <= windowLowC ? 1 : (windowHighC - tempC) / (windowHighC - windowLowC);
    return { t: round(t, 6), tempC, crystal };
  };

  const times: number[] = [];
  const steps = Math.floor(endS / sampleEvery + 1e-9);
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEvery, 6));
  if (times[times.length - 1]! < endS - 1e-9) times.push(round(endS, 6));

  return { samples: times.map(at), result: { sizeMm, solidS, rockLike: rockLikeOf(sizeMm) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateMagma(a: MagmaSample, b: MagmaSample, k: number): MagmaSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), tempC: lerp(a.tempC, b.tempC), crystal: lerp(a.crystal, b.crystal) };
}

const KEYS = ['place', 'grams', 'dish', 'color'] as const;

/** 매니페스트의 마그마 냉각 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateMagmaExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly string[]> = { place: PLACES, dish: DISHES };
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'grams') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < 1 || val > 50) bad('녹인 양은 1~50 g 범위여야 합니다.');
      } else if (key === 'color') {
        if (typeof val !== 'string') bad('문자열이어야 합니다.');
      } else if (typeof val !== 'string' || !allowed[key]!.includes(val)) {
        bad(`${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}

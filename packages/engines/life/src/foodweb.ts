import type { VariableExperiment as Experiment } from '@sci/schema';

export type RainKind = 'low' | 'normal' | 'high';

export interface FoodWebParams {
  /** 처음 토끼 수(마리) */
  rabbits0: number;
  /** 처음 여우 수(마리) */
  foxes0: number;
  /** 비가 오는 정도(풀이 자라는 빠르기) */
  rain: RainKind;
  /** 토끼 털 색. 대조 변인이라 계산에 쓰지 않는다. */
  furColor: string;
}

export interface FoodWebOptions {
  /** 관찰하는 날 수 */
  days?: number;
  /** 계산 간격(일) */
  dt?: number;
  /** 처음 풀의 양(%) */
  grass0?: number;
}

export interface FoodWebSample {
  /** 경과일 */
  t: number;
  /** 풀의 양(%) */
  grassPct: number;
  /** 토끼 수(연속값) */
  rabbits: number;
  /** 여우 수(연속값) */
  foxes: number;
}

export interface FoodWebResult {
  /** 마지막 날 풀의 양(%, 반올림 정수) */
  grassDay60: number;
  /** 마지막 날 토끼 수(반올림) */
  rabbitsDay60: number;
  /** 마지막 날 여우 수(반올림) */
  foxesDay60: number;
  /** 가장 많았던 토끼 수(샘플 중 최댓값을 반올림) */
  rabbitsMax: number;
}

export interface FoodWebOutput {
  samples: FoodWebSample[];
  result: FoodWebResult;
}

export const RAINS: readonly RainKind[] = ['low', 'normal', 'high'];
export const RABBITS_MIN = 1;
export const RABBITS_MAX = 50;
export const FOXES_MIN = 0;
export const FOXES_MAX = 10;
export const FOOD_WEB_DEFAULT_DAYS = 60;
export const FOOD_WEB_DEFAULT_DT = 0.05;
export const FOOD_WEB_DEFAULT_GRASS0 = 80;
/** 비에 따른 풀이 자라는 빠르기 */
export const RAIN_GROWTH: Record<RainKind, number> = { low: 0.04, normal: 0.08, high: 0.12 };
const REGROW = 0.1;
const B = 0.1;
const STARVE = 0.06;
const A = 0.02;
const CONV = 0.3;
const FD = 0.04;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function checkParams(p: FoodWebParams): void {
  if (!Number.isInteger(p.rabbits0) || p.rabbits0 < RABBITS_MIN || p.rabbits0 > RABBITS_MAX) {
    throw new RangeError(`처음 토끼 수 ${String(p.rabbits0)}은(는) ${RABBITS_MIN}~${RABBITS_MAX} 사이 정수여야 합니다.`);
  }
  if (!Number.isInteger(p.foxes0) || p.foxes0 < FOXES_MIN || p.foxes0 > FOXES_MAX) {
    throw new RangeError(`처음 여우 수 ${String(p.foxes0)}은(는) ${FOXES_MIN}~${FOXES_MAX} 사이 정수여야 합니다.`);
  }
  if (!RAINS.includes(p.rain)) throw new RangeError(`비 ${String(p.rain)}은(는) ${RAINS.join(', ')} 중 하나여야 합니다.`);
}

/**
 * 풀·토끼·여우 먹이 관계 근사 모델(오일러 방법). 수치는 근사값이며 교사 검수 대상이다.
 * 털 색은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateFoodWeb(params: FoodWebParams, opts: FoodWebOptions = {}): FoodWebOutput {
  checkParams(params);
  const days = opts.days ?? FOOD_WEB_DEFAULT_DAYS;
  const dt = opts.dt ?? FOOD_WEB_DEFAULT_DT;
  const grass0 = opts.grass0 ?? FOOD_WEB_DEFAULT_GRASS0;
  if (!(Number.isInteger(days) && days > 0)) throw new RangeError('관찰하는 날 수는 1 이상의 정수여야 합니다.');
  if (!(dt > 0 && dt <= 1)) throw new RangeError('계산 간격이 올바르지 않습니다.');
  if (!(grass0 >= 0 && grass0 <= 100)) throw new RangeError('처음 풀의 양은 0~100 %여야 합니다.');

  const rg = RAIN_GROWTH[params.rain];
  // 하루를 나누는 계산 횟수. 정수 시각은 i * dt가 아니라 이 횟수로 가려낸다(부동소수점 오차 방지).
  const perDay = Math.round(1 / dt);
  const total = days * perDay;
  let G = grass0;
  let R = params.rabbits0;
  let F = params.foxes0;
  const samples: FoodWebSample[] = [];
  for (let i = 0; i <= total; i++) {
    if (i % perDay === 0) samples.push({ t: i / perDay, grassPct: G, rabbits: R, foxes: F });
    if (i === total) break;
    const food = G / (G + 20);
    const eat = 0.6 * R * food;
    const dG = rg * G * (1 - G / 100) + REGROW * rg * 10 - 0.5 * eat;
    const pred = (A * R * F) / (1 + 0.02 * R);
    const dR = B * R * food - (0.03 + STARVE * (1 - food)) * R - pred;
    const dF = CONV * pred - FD * F;
    G = clamp(G + dG * dt, 0, 100);
    R = Math.max(0, R + dR * dt);
    F = Math.max(0, F + dF * dt);
  }

  const last = samples[samples.length - 1]!;
  const result: FoodWebResult = {
    grassDay60: Math.round(last.grassPct),
    rabbitsDay60: Math.round(last.rabbits),
    foxesDay60: Math.round(last.foxes),
    rabbitsMax: Math.round(samples.reduce((m, s) => Math.max(m, s.rabbits), -Infinity)),
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateFoodWeb(a: FoodWebSample, b: FoodWebSample, k: number): FoodWebSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    grassPct: lerp(a.grassPct, b.grassPct),
    rabbits: lerp(a.rabbits, b.rabbits),
    foxes: lerp(a.foxes, b.foxes),
  };
}

const KEYS = ['rabbits0', 'foxes0', 'rain', 'furColor'] as const;

/** 매니페스트의 먹이 관계 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateFoodWebExperiment(exp: Experiment): string[] {
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
      if (key === 'rain') {
        if (typeof val !== 'string' || !RAINS.includes(val as RainKind)) bad(`${RAINS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'furColor') {
        if (typeof val !== 'string') bad('문자여야 합니다.');
      } else if (key === 'rabbits0') {
        if (typeof val !== 'number' || !Number.isInteger(val) || val < RABBITS_MIN || val > RABBITS_MAX) bad(`토끼 수는 ${RABBITS_MIN}~${RABBITS_MAX} 사이 정수여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isInteger(val) || val < FOXES_MIN || val > FOXES_MAX) {
        bad(`여우 수는 ${FOXES_MIN}~${FOXES_MAX} 사이 정수여야 합니다.`);
      }
    }
  }
  const { days } = exp.params ?? {};
  if (days !== undefined && !(typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 365)) {
    errors.push('params.days는 1~365 사이 정수여야 합니다.');
  }
  return errors;
}

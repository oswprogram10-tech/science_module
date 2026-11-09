import type { VariableExperiment as Experiment } from '@sci/schema';
import { LIGHTS, type LightKind } from './germination';

export type WindKind = 'off' | 'on';
export type Droplets = 'none' | 'some' | 'many';

export interface TranspirationParams {
  /** 줄기에 달린 잎의 수 */
  leaves: number;
  light: LightKind;
  wind: WindKind;
  /** 처음 물의 양(mL) */
  startMl: number;
}

export interface TranspirationOptions {
  /** 관찰 시간(시간) */
  hours?: number;
  /** 샘플 간격(시간) */
  sampleEveryH?: number;
}

export interface TranspirationSample {
  /** 경과 시간(시간) */
  t: number;
  /** 남은 물의 양(mL) */
  remainingMl: number;
  /** 지금까지 줄어든 물의 양(mL) */
  lostMl: number;
  /** 비닐봉지 안 물방울 정도(0~1) */
  fog: number;
  /** 기공 열림(0~1). 빛에만 따르고 바람과는 무관하다. */
  stomata: number;
}

export interface TranspirationResult {
  /** 관찰이 끝날 때까지 줄어든 물의 양(mL, 소수 첫째 자리) */
  lostMl: number;
  /** 남은 물의 양(mL, 소수 첫째 자리) */
  remainingMl: number;
  /** 비닐봉지 안 물방울 */
  droplets: Droplets;
}

export interface TranspirationOutput {
  samples: TranspirationSample[];
  result: TranspirationResult;
}

export const WINDS: readonly WindKind[] = ['off', 'on'];
export const LEAVES_MIN = 0;
export const LEAVES_MAX = 20;
export const START_ML_MIN = 50;
export const START_ML_MAX = 500;
export const DEFAULT_HOURS = 48;
/** 잎 한 장에서 하루에 빠져나가는 물(mL) */
export const PER_LEAF_ML_PER_DAY = { bright: 1.2, dark: 0.3 } as const;
/** 바람이 있을 때의 배수 */
export const WIND_FACTOR = 1.5;
/** 기공 열림 */
export const STOMATA_OPEN = { bright: 1, dark: 0.25 } as const;
/** 물방울이 가득(1)이 되는 줄어든 양(mL) */
export const FOG_FULL_ML = 10;
/** 물방울 정도를 나누는 줄어든 양(mL) */
export const DROPLETS_SOME_ML = 0.5;
export const DROPLETS_MANY_ML = 8;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 잎 한 장이 하루에 내보내는 물(mL). 식용유 때문에 물 표면 증발은 0이다. */
export const perLeafPerDay = (light: LightKind, wind: WindKind): number => PER_LEAF_ML_PER_DAY[light] * (wind === 'on' ? WIND_FACTOR : 1);

export function dropletsOf(lostMl: number): Droplets {
  return lostMl < DROPLETS_SOME_ML ? 'none' : lostMl < DROPLETS_MANY_ML ? 'some' : 'many';
}

function checkParams(p: TranspirationParams): void {
  if (!Number.isInteger(p.leaves) || p.leaves < LEAVES_MIN || p.leaves > LEAVES_MAX) {
    throw new RangeError(`잎의 수 ${String(p.leaves)}은(는) ${LEAVES_MIN}~${LEAVES_MAX} 사이 정수여야 합니다.`);
  }
  if (!LIGHTS.includes(p.light)) throw new RangeError(`빛 ${String(p.light)}은(는) bright, dark 중 하나여야 합니다.`);
  if (!WINDS.includes(p.wind)) throw new RangeError(`바람 ${String(p.wind)}은(는) off, on 중 하나여야 합니다.`);
  if (typeof p.startMl !== 'number' || !Number.isFinite(p.startMl) || p.startMl < START_ML_MIN || p.startMl > START_ML_MAX) {
    throw new RangeError(`처음 물의 양 ${String(p.startMl)}은(는) ${START_ML_MIN}~${START_ML_MAX} mL 범위여야 합니다.`);
  }
}

/**
 * 잎에서 물이 빠져나가는 증산 작용 근사 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 줄어든 양은 잎의 수, 빛, 바람으로만 정해지고 처음 물의 양은 남은 양만 바꾼다.
 */
export function simulateTranspiration(params: TranspirationParams, opts: TranspirationOptions = {}): TranspirationOutput {
  checkParams(params);
  const hours = opts.hours ?? DEFAULT_HOURS;
  const sampleEveryH = opts.sampleEveryH ?? 0.5;
  if (!(hours > 0)) throw new RangeError('관찰 시간은 0보다 커야 합니다.');
  if (!(sampleEveryH > 0 && sampleEveryH <= hours)) throw new RangeError('샘플 간격이 올바르지 않습니다.');

  const ratePerH = (params.leaves * perLeafPerDay(params.light, params.wind)) / 24;
  const stomata = STOMATA_OPEN[params.light];
  const at = (t: number): TranspirationSample => {
    const remainingMl = Math.max(0, params.startMl - ratePerH * t);
    const lostMl = params.startMl - remainingMl;
    return { t, remainingMl, lostMl, fog: clamp01(lostMl / FOG_FULL_ML), stomata };
  };

  const steps = Math.floor(hours / sampleEveryH + 1e-9);
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEveryH, 6));
  if (times[times.length - 1]! < hours - 1e-9) times.push(hours);
  const samples = times.map(at);

  const lostMl = round(at(hours).lostMl, 1);
  const result: TranspirationResult = {
    lostMl,
    remainingMl: round(params.startMl - lostMl, 1),
    droplets: dropletsOf(lostMl),
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateTranspiration(a: TranspirationSample, b: TranspirationSample, k: number): TranspirationSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    remainingMl: lerp(a.remainingMl, b.remainingMl),
    lostMl: lerp(a.lostMl, b.lostMl),
    fog: lerp(a.fog, b.fog),
    stomata: lerp(a.stomata, b.stomata),
  };
}

const KEYS = ['leaves', 'light', 'wind', 'startMl'] as const;

/** 매니페스트의 증산 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateTranspirationExperiment(exp: Experiment): string[] {
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
      if (key === 'light') {
        if (typeof val !== 'string' || !LIGHTS.includes(val as LightKind)) bad(`${LIGHTS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'wind') {
        if (typeof val !== 'string' || !WINDS.includes(val as WindKind)) bad(`${WINDS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'leaves') {
        if (typeof val !== 'number' || !Number.isInteger(val) || val < LEAVES_MIN || val > LEAVES_MAX) bad(`잎의 수는 ${LEAVES_MIN}~${LEAVES_MAX} 사이 정수여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
      else if (val < START_ML_MIN || val > START_ML_MAX) bad(`처음 물의 양은 ${START_ML_MIN}~${START_ML_MAX} mL 범위여야 합니다.`);
    }
  }
  const { hours } = exp.params ?? {};
  if (hours !== undefined && !(typeof hours === 'number' && Number.isInteger(hours) && hours >= 1 && hours <= 168)) {
    errors.push('params.hours는 1~168 사이 정수여야 합니다.');
  }
  return errors;
}

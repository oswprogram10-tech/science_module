import type { VariableExperiment as Experiment } from '@sci/schema';
import { solubilityPer100g } from './solubility';

export const SEPARATION_FILTERS = ['paper', 'pour'] as const;
export type SeparationFilter = (typeof SEPARATION_FILTERS)[number];
export const SEPARATION_STIRRERS = ['glass', 'wood'] as const;
export type SeparationStirrer = (typeof SEPARATION_STIRRERS)[number];
export type SeparationStage = 'dissolve' | 'filter' | 'evaporate';

export interface SeparationParams {
  /** 넣는 물의 양(mL). 물 1 mL = 1 g */
  waterMl: number;
  /** 거르는 방법 */
  filter: SeparationFilter;
  /** 젓는 도구: 계산에 쓰지 않는 대조 변인 */
  stirrer: SeparationStirrer;
}

export interface SeparationOptions {
  /** 한 시행의 길이(분) */
  totalMin?: number;
  sampleEveryMin?: number;
}

export interface SeparationSample {
  /** 분 */
  t: number;
  /** 녹은 소금(g) */
  dissolvedG: number;
  /** 증발 접시 속 물(mL) */
  dishWaterMl: number;
  /** 접시 위 고체(g) = 모래 + 소금 가루 */
  solidG: number;
  /** 접시 위 소금 가루(g) */
  saltOnDishG: number;
  stage: SeparationStage;
}

export interface SeparationResult {
  /** 얻은 소금(g), 소수 첫째 자리 */
  salt: number;
  /** 섞인 모래(g), 소수 첫째 자리 */
  sand: number;
  /** salt + sand (화면 문구용) */
  total: number;
}

export interface SeparationOutput {
  samples: SeparationSample[];
  result: SeparationResult;
}

/** 혼합물: 모래 10 g + 소금 10 g (근사값, 교사 검수 대상) */
export const SALT_G = 10;
export const SAND_G = 10;
/** 거름종이에 젖은 모래가 거른 물의 일부를 붙잡는 손실을 뺀 통과 비율(근사값, 교사 검수 대상) */
export const PASS_RATIO = 0.9;
/** 따르기만 할 때 물과 함께 넘어가는 모래(g) */
export const POURED_SAND_G = 1.5;
/** 물의 온도(°C) */
export const WATER_TEMP_C = 20;
export const WATER_MIN = 10;
export const WATER_MAX = 100;
/** 단계 경계(분) */
export const FILTER_START_MIN = 3;
export const HEAT_START_MIN = 8;
const DISSOLVE_TAU = 0.6;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 물 waterMl에 20 °C에서 녹는 소금(g). 용해와 용액 단원과 같은 용해도 표를 쓴다. */
export const dissolvedSaltG = (waterMl: number) => Math.min(SALT_G, (waterMl * solubilityPer100g('salt', WATER_TEMP_C)) / 100);

export const stageAt = (t: number): SeparationStage => (t < FILTER_START_MIN ? 'dissolve' : t < HEAT_START_MIN ? 'filter' : 'evaporate');

function checkParams(p: SeparationParams): void {
  if (!(SEPARATION_FILTERS as readonly string[]).includes(p.filter)) {
    throw new RangeError(`거르는 방법 ${String(p.filter)}은(는) ${SEPARATION_FILTERS.join(', ')} 중 하나여야 합니다.`);
  }
  if (!(SEPARATION_STIRRERS as readonly string[]).includes(p.stirrer)) {
    throw new RangeError(`젓는 도구 ${String(p.stirrer)}은(는) ${SEPARATION_STIRRERS.join(', ')} 중 하나여야 합니다.`);
  }
  if (typeof p.waterMl !== 'number' || !Number.isFinite(p.waterMl) || p.waterMl < WATER_MIN || p.waterMl > WATER_MAX) {
    throw new RangeError(`물의 양 ${String(p.waterMl)}은(는) ${WATER_MIN}~${WATER_MAX} mL여야 합니다.`);
  }
}

/** 소금과 모래의 혼합물을 녹이고 거르고 증발시킨다. 젓는 도구는 계산에 쓰지 않는다. 난수 없음. */
export function simulateSeparation(params: SeparationParams, opts: SeparationOptions = {}): SeparationOutput {
  const { totalMin = 20, sampleEveryMin = 0.1 } = opts;
  checkParams(params);
  if (!(totalMin > HEAT_START_MIN)) throw new RangeError(`시행 길이 ${totalMin}분은 ${HEAT_START_MIN}분보다 길어야 합니다.`);
  const S = solubilityPer100g('salt', WATER_TEMP_C);
  const dissolved = dissolvedSaltG(params.waterMl);
  const waterF = PASS_RATIO * params.waterMl;
  const saltF = PASS_RATIO * dissolved;
  const sandF = params.filter === 'pour' ? POURED_SAND_G : 0;
  const norm = 1 - Math.exp(-FILTER_START_MIN / DISSOLVE_TAU);
  const steps = Math.round(totalMin / sampleEveryMin);

  const samples: SeparationSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = round(i * sampleEveryMin, 6);
    const dissolvedG = t >= FILTER_START_MIN ? dissolved : (dissolved * (1 - Math.exp(-t / DISSOLVE_TAU))) / norm;
    // 3~8분: 거른 물(과 따를 때 넘어가는 모래)이 접시로 선형으로 옮겨진다. 8분 이후 물이 선형으로 증발한다.
    const moved = Math.min(1, Math.max(0, (t - FILTER_START_MIN) / (HEAT_START_MIN - FILTER_START_MIN)));
    const left = Math.min(1, Math.max(0, (t - HEAT_START_MIN) / (totalMin - HEAT_START_MIN)));
    const dishWaterMl = waterF * moved * (1 - left);
    const saltOnDishG = t >= HEAT_START_MIN ? Math.max(0, saltF - (dishWaterMl * S) / 100) : 0;
    samples.push({ t, dissolvedG, dishWaterMl, solidG: sandF * moved + saltOnDishG, saltOnDishG, stage: stageAt(t) });
  }
  const salt = round(saltF, 1);
  const sand = round(sandF, 1);
  return { samples, result: { salt, sand, total: round(salt + sand, 1) } };
}

/** 두 샘플 사이를 선형 보간한다. 단계는 앞 샘플의 것을 따른다. */
export function interpolateSeparation(a: SeparationSample, b: SeparationSample, k: number): SeparationSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const t = lerp(a.t, b.t);
  return {
    t,
    dissolvedG: lerp(a.dissolvedG, b.dissolvedG),
    dishWaterMl: lerp(a.dishWaterMl, b.dishWaterMl),
    solidG: lerp(a.solidG, b.solidG),
    saltOnDishG: lerp(a.saltOnDishG, b.saltOnDishG),
    stage: stageAt(t),
  };
}

const SEPARATION_KEYS = ['waterMl', 'filter', 'stirrer'] as const;

/** 매니페스트의 혼합물 분리 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSeparationExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const total = exp.params?.totalMin;
  if (!(typeof total === 'number' && Number.isFinite(total) && total > HEAT_START_MIN)) {
    errors.push(`params.totalMin은(는) ${HEAT_START_MIN}보다 큰 숫자여야 합니다.`);
  }
  for (const key of SEPARATION_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'filter') {
        if (typeof val !== 'string' || !(SEPARATION_FILTERS as readonly string[]).includes(val)) bad(`${SEPARATION_FILTERS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'stirrer') {
        if (typeof val !== 'string' || !(SEPARATION_STIRRERS as readonly string[]).includes(val)) bad(`${SEPARATION_STIRRERS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < WATER_MIN || val > WATER_MAX) {
        bad(`물의 양은 ${WATER_MIN}~${WATER_MAX} mL 범위여야 합니다.`);
      }
    }
  }
  return errors;
}

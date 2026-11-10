import type { VariableExperiment as Experiment } from '@sci/schema';

export const WATER_KINDS = ['river', 'sea'] as const;
export type WaterKind = (typeof WATER_KINDS)[number];
export const SEA_DISH_KINDS = ['round', 'square'] as const;
export type SeaDishKind = (typeof SEA_DISH_KINDS)[number];

export interface SeaWaterParams {
  /** 물의 종류 */
  water: WaterKind;
  /** 증발 접시에 붓는 물의 양(mL) */
  volumeMl: number;
  /** 증발 접시 모양: 계산에 쓰지 않는 대조 변인 */
  dish: SeaDishKind;
}

export interface SeaWaterOptions {
  /** 한 시행의 길이(분) */
  totalMin?: number;
  sampleEveryMin?: number;
}

export interface SeaWaterSample {
  /** 분 */
  t: number;
  /** 접시에 남은 물(mL) */
  dishWaterMl: number;
  /** 접시에 보이는 하얀 가루(g): 물이 다 마르기 전에는 0 */
  residueG: number;
  /** 알코올램프로 가열하는 중인가(물이 남아 있는 동안) */
  heating: boolean;
}

export interface SeaWaterResult {
  /** 남은 하얀 가루(g), 소수 첫째 자리 */
  residue: number;
  /** 물이 다 마른 시간(분), 정수 */
  dryMin: number;
}

export interface SeaWaterOutput {
  samples: SeaWaterSample[];
  result: SeaWaterResult;
}

/** 바닷물 1 mL의 무게(g) (근사값, 교사 검수 대상) */
export const SEA_G_PER_ML = 1.025;
/** 바닷물에 녹아 있는 것의 질량 비율 3.5 % (근사값, 교사 검수 대상) */
export const SEA_SOLUTE_RATIO = 0.035;
/** 강물 1 mL에 녹아 있는 것(g): 아주 적다 (근사값, 교사 검수 대상) */
export const RIVER_G_PER_ML = 0.0001;
/** 알코올램프로 1분에 줄어드는 물(mL): 물 종류·접시 모양과 무관 */
export const EVAP_ML_PER_MIN = 5;
export const VOLUME_MIN = 10;
export const VOLUME_MAX = 100;
export const SEA_WATER_TOTAL_MIN = 20;
/** 화면에서 두 결과를 같다고 보는 기준(g) */
export const SAME_G = 0.1;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 물이 다 마르는 시간(분) = 물의 양 / 5 */
export const dryMinutes = (volumeMl: number) => round(volumeMl / EVAP_ML_PER_MIN, 6);

/** 다 말랐을 때 접시에 남는 가루(g), 반올림 전 */
export const residueGrams = (water: WaterKind, volumeMl: number) =>
  water === 'sea' ? volumeMl * SEA_G_PER_ML * SEA_SOLUTE_RATIO : volumeMl * RIVER_G_PER_ML;

/** 화면용 소금 결정 수: 남은 가루(g)에 비례한다(1 g당 8개, 0이면 없음). */
export const crystalCount = (residueG: number) => Math.round(residueG * 8);

function checkParams(p: SeaWaterParams): void {
  if (!(WATER_KINDS as readonly string[]).includes(p.water)) throw new RangeError(`물의 종류 ${String(p.water)}은(는) ${WATER_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(SEA_DISH_KINDS as readonly string[]).includes(p.dish)) throw new RangeError(`접시 모양 ${String(p.dish)}은(는) ${SEA_DISH_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.volumeMl !== 'number' || !Number.isFinite(p.volumeMl) || p.volumeMl < VOLUME_MIN || p.volumeMl > VOLUME_MAX) {
    throw new RangeError(`물의 양 ${String(p.volumeMl)}은(는) ${VOLUME_MIN}~${VOLUME_MAX} mL여야 합니다.`);
  }
}

/**
 * 강물과 바닷물을 증발시킨다. 수치는 근사값이며 교사 검수 대상이다.
 * 남은 가루 = 물의 양 × 1.025 × 0.035(바닷물), 물의 양 × 0.0001(강물). 물은 1분에 5 mL씩 줄어든다. 접시 모양은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateSeaWater(params: SeaWaterParams, opts: SeaWaterOptions = {}): SeaWaterOutput {
  const { totalMin = SEA_WATER_TOTAL_MIN, sampleEveryMin = 0.1 } = opts;
  checkParams(params);
  const dryMin = dryMinutes(params.volumeMl);
  if (!(totalMin >= dryMin)) throw new RangeError(`시행 길이 ${totalMin}분은 물이 다 마르는 ${dryMin}분 이상이어야 합니다.`);
  const grams = residueGrams(params.water, params.volumeMl);
  const steps = Math.round(totalMin / sampleEveryMin);
  const samples: SeaWaterSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = round(i * sampleEveryMin, 6);
    const dishWaterMl = round(Math.max(0, params.volumeMl - EVAP_ML_PER_MIN * t), 6);
    const dry = dishWaterMl === 0;
    samples.push({ t, dishWaterMl, residueG: dry ? round(grams, 6) : 0, heating: !dry });
  }
  return { samples, result: { residue: round(grams, 1), dryMin: Math.round(dryMin) } };
}

/** 두 샘플 사이를 선형 보간한다. 가열 중인지는 k < 1이면 앞 샘플의 것을 따른다. */
export function interpolateSeaWater(a: SeaWaterSample, b: SeaWaterSample, k: number): SeaWaterSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    dishWaterMl: lerp(a.dishWaterMl, b.dishWaterMl),
    residueG: lerp(a.residueG, b.residueG),
    heating: k < 1 ? a.heating : b.heating,
  };
}

const SEA_WATER_KEYS = ['water', 'volumeMl', 'dish'] as const;

/** 매니페스트의 바닷물과 강물 비교 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSeaWaterExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const total = exp.params?.totalMin;
  const totalOk = typeof total === 'number' && Number.isFinite(total) && total > 0;
  if (!totalOk) errors.push('params.totalMin은(는) 0보다 큰 숫자여야 합니다.');
  for (const key of SEA_WATER_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'water') {
        if (typeof val !== 'string' || !(WATER_KINDS as readonly string[]).includes(val)) bad(`${WATER_KINDS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'dish') {
        if (typeof val !== 'string' || !(SEA_DISH_KINDS as readonly string[]).includes(val)) bad(`${SEA_DISH_KINDS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < VOLUME_MIN || val > VOLUME_MAX) {
        bad(`물의 양은 ${VOLUME_MIN}~${VOLUME_MAX} mL 범위여야 합니다.`);
      } else if (totalOk && val / EVAP_ML_PER_MIN > (total as number)) {
        bad(`물이 다 마르는 시간(${val / EVAP_ML_PER_MIN}분)이 params.totalMin(${String(total)}분)보다 깁니다.`);
      }
    }
  }
  return errors;
}

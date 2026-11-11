import type { VariableExperiment as Experiment } from '@sci/schema';

export const CONC_SPOONS = [1, 3, 5] as const;
export const CONC_WATERS = [50, 100] as const;
export const CONC_SUGARS = ['brown', 'white'] as const;
export type ConcSugar = (typeof CONC_SUGARS)[number];
export const CONC_CUPS = ['low', 'high'] as const;
export type ConcCup = (typeof CONC_CUPS)[number];

export interface ConcentrationParams {
  /** 넣은 설탕(숟가락) */
  spoons: number;
  /** 물의 양(mL) */
  waterMl: number;
  /** 설탕 종류: 색 비교에만 쓴다. */
  sugar: ConcSugar;
  /** 비커 모양: 계산에 쓰지 않는 대조 변인 */
  cup: ConcCup;
}

export interface ConcentrationSample {
  /** 초 */
  t: number;
  /** 방울토마토가 뜬 높이(눈금 0~10): 바닥에서 최종 높이까지 올라간다. */
  floatH: number;
  /** 20 mL의 무게(g): 시행 내내 일정하다. */
  mass20: number;
}

export interface ConcentrationResult {
  /** 방울토마토가 뜬 높이(눈금 0~10), 정수 */
  float: number;
  /** 20 mL의 무게(g), 소수 첫째 자리 */
  mass20: number;
  /** 색의 진하기(눈금 0~10), 정수. 흰 설탕은 0 */
  color: number;
}

export interface ConcentrationOutput {
  samples: ConcentrationSample[];
  result: ConcentrationResult;
}

/** 1숟가락의 설탕 무게(g) */
export const SPOON_G = 5;
/** 물 1 mL의 무게(g) */
export const CONC_WATER_G_PER_ML = 1;
/** ρ = 1 + 0.38c */
export const RHO_PER_C = 0.38;
/** 방울토마토가 뜨기 시작하는 밀도(g/mL): 이보다 작으면 바닥에 가라앉아 있다. */
export const FLOAT_START_RHO = 1.03;
/** 밀도가 이만큼 올라갈 때마다 한 눈금 오른다. */
export const FLOAT_RHO_PER_STEP = 0.005;
export const FLOAT_MAX = 10;
/** 색의 진하기 = 반올림(40c), 상한 10 (황설탕만) */
export const COLOR_PER_C = 40;
export const COLOR_MAX = 10;
export const CONC_TOTAL_S = 3;
export const CONC_SAMPLE_S = 0.05;
/** 방울토마토는 2초 동안 올라가고 3초까지 멈춰 있다. */
export const CONC_RISE_S = 2;
/** 화면에서 두 뜬 높이를 같다고 보는 기준(눈금) */
export const CONC_SAME_LEVEL = 0.5;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: ConcentrationParams): void => {
  if (typeof p.spoons !== 'number' || !(CONC_SPOONS as readonly number[]).includes(p.spoons)) throw new RangeError(`넣은 설탕 ${String(p.spoons)}은(는) ${CONC_SPOONS.join(', ')}숟가락 중 하나여야 합니다.`);
  if (typeof p.waterMl !== 'number' || !(CONC_WATERS as readonly number[]).includes(p.waterMl)) throw new RangeError(`물의 양 ${String(p.waterMl)}은(는) ${CONC_WATERS.join(', ')} mL 중 하나여야 합니다.`);
  if (!(CONC_SUGARS as readonly string[]).includes(p.sugar)) throw new RangeError(`설탕 종류 ${String(p.sugar)}은(는) ${CONC_SUGARS.join(', ')} 중 하나여야 합니다.`);
  if (!(CONC_CUPS as readonly string[]).includes(p.cup)) throw new RangeError(`비커 모양 ${String(p.cup)}은(는) ${CONC_CUPS.join(', ')} 중 하나여야 합니다.`);
};

/** 설탕 무게 ÷ (물 무게 + 설탕 무게) (0~1) */
export const sugarFraction = (p: Pick<ConcentrationParams, 'spoons' | 'waterMl'>): number => {
  const sugarG = p.spoons * SPOON_G;
  return sugarG / (p.waterMl * CONC_WATER_G_PER_ML + sugarG);
};

/** 용액의 밀도 ρ(g/mL) = 1 + 0.38c */
export const densityOf = (p: Pick<ConcentrationParams, 'spoons' | 'waterMl'>): number => 1 + RHO_PER_C * sugarFraction(p);

/** 20 mL의 무게(g) = 20ρ, 소수 첫째 자리 */
export const mass20Of = (p: Pick<ConcentrationParams, 'spoons' | 'waterMl'>): number => roundTo(20 * densityOf(p), 1);

/** 방울토마토가 뜬 높이(눈금 0~10): ρ가 1.03보다 작으면 0, 아니면 min(10, 반올림((ρ − 1.03) / 0.005)) */
export const floatLevelOf = (p: Pick<ConcentrationParams, 'spoons' | 'waterMl'>): number => {
  const rho = densityOf(p);
  if (rho < FLOAT_START_RHO) return 0;
  return Math.min(FLOAT_MAX, Math.round(roundTo((rho - FLOAT_START_RHO) / FLOAT_RHO_PER_STEP, 9)));
};

/** 색의 진하기(눈금 0~10): 황설탕이면 min(10, 반올림(40c)), 흰 설탕은 0 */
export const colorLevelOf = (p: Pick<ConcentrationParams, 'spoons' | 'waterMl' | 'sugar'>): number => (p.sugar === 'brown' ? Math.min(COLOR_MAX, Math.round(roundTo(COLOR_PER_C * sugarFraction(p), 9))) : 0);

/**
 * 설탕물의 진하기 비교. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * c = 설탕 g / (물 g + 설탕 g), ρ = 1 + 0.38c. 20 mL의 무게는 20ρ, 방울토마토 높이는 밀도 1.03부터 0.005마다 한 눈금(상한 10).
 * 색의 진하기는 황설탕일 때 반올림(40c)(상한 10), 흰 설탕은 0이다. 비커 모양은 계산에 쓰지 않는다.
 * 방울토마토는 0~2초 동안 바닥에서 최종 높이까지 올라가고 3초까지 멈춰 있다(0.05초 간격).
 */
export function simulateConcentration(params: ConcentrationParams): ConcentrationOutput {
  checkParams(params);
  const result: ConcentrationResult = { float: floatLevelOf(params), mass20: mass20Of(params), color: colorLevelOf(params) };
  const steps = Math.round(CONC_TOTAL_S / CONC_SAMPLE_S);
  const samples: ConcentrationSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * CONC_SAMPLE_S, 6);
    const u = Math.min(1, t / CONC_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, floatH: roundTo(result.float * ease, 9), mass20: result.mass20 });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateConcentration(a: ConcentrationSample, b: ConcentrationSample, k: number): ConcentrationSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), floatH: lerp(a.floatH, b.floatH), mass20: lerp(a.mass20, b.mass20) };
}

const KEYS = ['spoons', 'waterMl', 'sugar', 'cup'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { spoons: CONC_SPOONS, waterMl: CONC_WATERS, sugar: CONC_SUGARS, cup: CONC_CUPS };

/** 매니페스트의 용액의 진하기 비교 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateConcentrationExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}

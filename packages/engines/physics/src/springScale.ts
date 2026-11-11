import type { VariableExperiment as Experiment } from '@sci/schema';

export const SPRING_WEIGHTS = [0, 1, 2, 3, 4, 5] as const;
export const SPRING_OBJECTS = ['none', 'case', 'scissors', 'glue', 'pencils'] as const;
export type SpringObject = (typeof SPRING_OBJECTS)[number];
export const SPRING_COLORS = ['yellow', 'green'] as const;
export type SpringColor = (typeof SPRING_COLORS)[number];

export interface SpringScaleParams {
  /** 건 추의 개수(0~5) */
  weights: number;
  /** 함께 건 물체 */
  object: SpringObject;
  /** 용수철 색깔: 계산에 쓰지 않는 대조 변인 */
  springColor: SpringColor;
}

export interface SpringScaleSample {
  /** 초 */
  t: number;
  /** 용수철이 늘어난 길이(cm) */
  stretchCm: number;
  /** 저울 눈금(g): 늘어난 길이에 비례한다. */
  readingG: number;
}

export interface SpringScaleResult {
  /** 용수철이 늘어난 길이(cm), 소수 첫째 자리 */
  stretch: number;
  /** 저울 눈금(g), 정수 */
  reading: number;
}

export interface SpringScaleOutput {
  samples: SpringScaleSample[];
  result: SpringScaleResult;
}

/** 추 하나의 무게(g) */
export const WEIGHT_G = 50;
/** 함께 건 물체의 무게(g) */
export const OBJECT_G: Record<SpringObject, number> = { none: 0, case: 150, scissors: 70, glue: 60, pencils: 90 };
/** 50 g마다 2 cm 늘어난다 = 25 g당 1 cm */
export const G_PER_CM = 25;
export const SPRING_TOTAL_S = 2;
export const SPRING_SAMPLE_S = 0.05;
/** 흔들림이 끝나고 멈추는 때(초) */
export const SPRING_SETTLE_S = 1.6;
/** 화면에서 두 늘어난 길이를 같다고 보는 기준(cm) */
export const SPRING_SAME_CM = 0.05;
/** 그래프 세로축 끝(cm): 추 5개와 필통(400 g, 16 cm)도 흔들림까지 담긴다. */
export const SPRING_Y_MAX_CM = 18;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: SpringScaleParams): void => {
  if (typeof p.weights !== 'number' || !(SPRING_WEIGHTS as readonly number[]).includes(p.weights)) throw new RangeError(`추의 개수 ${String(p.weights)}은(는) ${SPRING_WEIGHTS.join(', ')} 중 하나여야 합니다.`);
  if (!(SPRING_OBJECTS as readonly string[]).includes(p.object)) throw new RangeError(`함께 건 물체 ${String(p.object)}은(는) ${SPRING_OBJECTS.join(', ')} 중 하나여야 합니다.`);
  if (!(SPRING_COLORS as readonly string[]).includes(p.springColor)) throw new RangeError(`용수철 색깔 ${String(p.springColor)}은(는) ${SPRING_COLORS.join(', ')} 중 하나여야 합니다.`);
};

/** 전체 무게(g) = 50 × 추 개수 + 물체 무게 */
export const totalG = (weights: number, object: SpringObject): number => WEIGHT_G * weights + OBJECT_G[object];

/** 늘어난 길이(cm) = 전체 무게 ÷ 25, 소수 첫째 자리 */
export const stretchOf = (weights: number, object: SpringObject): number => roundTo(totalG(weights, object) / G_PER_CM, 1);

/** 처음 0에서 끝 길이까지 살짝 흔들리다 멈추는 정도(0에서 시작, 1.6초에 정확히 1, 최대 약 1.12) */
export function settle(t: number): number {
  const u = Math.min(1, Math.max(0, t / SPRING_SETTLE_S));
  return 1 - Math.pow(1 - u, 6) * Math.cos(2.5 * Math.PI * u);
}

/**
 * 용수철저울에 추와 물체를 건다. 수치는 이상화한 근사값이며 교사 검수 대상이다. 난수 없음.
 * 전체 무게 = 50 × 추 개수 + 물체 무게, 늘어난 길이 = 전체 무게 ÷ 25(50 g마다 2 cm), 눈금 = 전체 무게. 용수철 색깔은 계산에 쓰지 않는다.
 * 늘어난 길이는 0에서 시작해 살짝 흔들리다 1.6초에 멈추고 2초까지 그대로이다(0.05초 간격).
 */
export function simulateSpringScale(params: SpringScaleParams): SpringScaleOutput {
  checkParams(params);
  const total = totalG(params.weights, params.object);
  const stretch = stretchOf(params.weights, params.object);
  const steps = Math.round(SPRING_TOTAL_S / SPRING_SAMPLE_S);
  const samples: SpringScaleSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * SPRING_SAMPLE_S, 6);
    const k = t >= SPRING_SETTLE_S ? 1 : settle(t);
    samples.push({ t, stretchCm: roundTo(stretch * k, 9), readingG: roundTo(total * k, 9) });
  }
  return { samples, result: { stretch, reading: total } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateSpringScale(a: SpringScaleSample, b: SpringScaleSample, k: number): SpringScaleSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), stretchCm: lerp(a.stretchCm, b.stretchCm), readingG: lerp(a.readingG, b.readingG) };
}

/** 매니페스트의 용수철저울 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSpringScaleExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly (string | number)[]> = { weights: SPRING_WEIGHTS, object: SPRING_OBJECTS, springColor: SPRING_COLORS };
  for (const key of Object.keys(allowed)) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!allowed[key]!.includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}

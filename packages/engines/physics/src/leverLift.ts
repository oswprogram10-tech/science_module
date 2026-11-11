import type { VariableExperiment as Experiment } from '@sci/schema';

export const LIFT_TOOLS = ['none', 'lever', 'ramp'] as const;
export type LiftTool = (typeof LIFT_TOOLS)[number];
export const LIFT_ARMS = ['short', 'mid', 'long'] as const;
export type LiftArm = (typeof LIFT_ARMS)[number];
export const LIFT_COLORS = ['red', 'blue'] as const;
export type LiftColor = (typeof LIFT_COLORS)[number];

export interface LeverLiftParams {
  /** 쓰는 도구 */
  tool: LiftTool;
  /** 힘을 주는 쪽 길이(짧게·중간·길게). 도구 없이는 영향이 없다. */
  arm: LiftArm;
  /** 물체 색깔: 계산에 쓰지 않는 대조 변인 */
  color: LiftColor;
}

export interface LeverLiftSample {
  /** 손으로 당긴 거리(cm). 이 모델의 그래프 가로축이다. */
  t: number;
  /** 용수철저울 눈금(g): 들어 올리는 동안 일정하다. */
  force: number;
  /** 물체가 올라온 높이(cm): 0에서 20까지 당긴 거리에 비례한다. */
  liftCm: number;
}

export interface LeverLiftResult {
  /** 용수철저울 눈금(g), 정수 */
  force: number;
  /** 손으로 당긴 거리(cm), 정수 */
  pullCm: number;
}

export interface LeverLiftOutput {
  samples: LeverLiftSample[];
  result: LeverLiftResult;
}

/** 들어 올리는 물체의 무게(g): 고정 */
export const LOAD_G = 200;
/** 물체를 올리는 높이(cm): 고정. 지레에서 받침점에서 물체까지의 거리, 빗면의 높이와 같다. */
export const LIFT_HEIGHT_CM = 20;
/** 빗면의 마찰 보정(10 %). 정수로 계산하려고 11/10로 쓴다. */
export const RAMP_FRICTION_NUM = 11;
export const RAMP_FRICTION_DEN = 10;
/** 화면에서 두 눈금을 같다고 보는 기준(g) */
export const LIFT_SAME_G = 5;
/** 그래프 가로축(손으로 당긴 거리)과 세로축(저울 눈금)의 끝 */
export const LIFT_X_MAX_CM = 120;
export const LIFT_Y_MAX_G = 250;

/** 힘을 주는 쪽 길이(cm): 지레는 받침점에서 손까지, 빗면은 빗면 길이. 도구 없이는 해당 없음. */
export const ARM_CM: Record<'lever' | 'ramp', Record<LiftArm, number>> = {
  lever: { short: 20, mid: 40, long: 60 },
  ramp: { short: 40, mid: 80, long: 120 },
};

const checkParams = (p: LeverLiftParams): void => {
  if (!(LIFT_TOOLS as readonly string[]).includes(p.tool)) throw new RangeError(`도구 ${String(p.tool)}은(는) ${LIFT_TOOLS.join(', ')} 중 하나여야 합니다.`);
  if (!(LIFT_ARMS as readonly string[]).includes(p.arm)) throw new RangeError(`힘을 주는 쪽 길이 ${String(p.arm)}은(는) ${LIFT_ARMS.join(', ')} 중 하나여야 합니다.`);
  if (!(LIFT_COLORS as readonly string[]).includes(p.color)) throw new RangeError(`물체 색깔 ${String(p.color)}은(는) ${LIFT_COLORS.join(', ')} 중 하나여야 합니다.`);
};

/** 손으로 당긴 거리(cm). 도구 없이는 손으로 물체를 곧바로 들어 올리므로 높이와 같은 20 cm이다. */
export function pullCmOf(tool: LiftTool, arm: LiftArm): number {
  if (tool === 'none') return LIFT_HEIGHT_CM;
  return ARM_CM[tool][arm];
}

/**
 * 저울 눈금(g)의 반올림 전 값.
 * 지레: 200 × 20 / 팔 길이. 빗면: 200 × 20 / 길이 × 1.1(= 200 × 20 × 11 / (10 × 길이)). 도구 없이: 200.
 */
export function forceRaw(tool: LiftTool, arm: LiftArm): number {
  if (tool === 'none') return LOAD_G;
  const len = ARM_CM[tool][arm];
  if (tool === 'lever') return (LOAD_G * LIFT_HEIGHT_CM) / len;
  return (LOAD_G * LIFT_HEIGHT_CM * RAMP_FRICTION_NUM) / (RAMP_FRICTION_DEN * len);
}

/**
 * 도구로 물체를 들어 올린다. 수치는 이상화한 근사값이며 교사 검수 대상이다. 난수 없음.
 * 지레의 힘 = 200 × 20 / 팔 길이, 빗면의 힘 = 200 × 20 / 길이 × 1.1(마찰 10 %). 물체 색깔은 계산에 쓰지 않는다.
 * 손으로 당긴 거리는 지레가 팔 길이, 빗면이 빗면 길이, 도구 없이는 20 cm이다. 표본은 당긴 거리 1 cm마다 하나다.
 */
export function simulateLeverLift(params: LeverLiftParams): LeverLiftOutput {
  checkParams(params);
  const pullCm = pullCmOf(params.tool, params.arm);
  const force = Math.round(forceRaw(params.tool, params.arm));
  const samples: LeverLiftSample[] = [];
  for (let t = 0; t <= pullCm; t++) samples.push({ t, force, liftCm: (LIFT_HEIGHT_CM * t) / pullCm });
  return { samples, result: { force, pullCm } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateLeverLift(a: LeverLiftSample, b: LeverLiftSample, k: number): LeverLiftSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), force: lerp(a.force, b.force), liftCm: lerp(a.liftCm, b.liftCm) };
}

const KEYS = ['tool', 'armCm', 'color'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { tool: LIFT_TOOLS, armCm: LIFT_ARMS, color: LIFT_COLORS };

/** 매니페스트의 지레와 빗면 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateLeverLiftExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}

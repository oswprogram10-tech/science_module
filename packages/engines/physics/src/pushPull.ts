import type { VariableExperiment as Experiment } from '@sci/schema';

export const PUSH_OBJECTS = ['cart', 'ball', 'clay'] as const;
export type PushObject = (typeof PUSH_OBJECTS)[number];
export const PUSH_ACTIONS = ['push', 'pull'] as const;
export type PushAction = (typeof PUSH_ACTIONS)[number];
export const PUSH_STRENGTHS = ['weak', 'strong'] as const;
export type PushStrength = (typeof PUSH_STRENGTHS)[number];
export const PUSH_COLORS = ['red', 'blue'] as const;
export type PushColor = (typeof PUSH_COLORS)[number];
/** 움직인 방향: 손에서 멀어지는 쪽(away) / 손 쪽으로(toward) */
export type PushDirection = 'away' | 'toward';
/** 모양: 그대로(same) / 눌려 납작해짐(flat) / 길게 늘어남(long) */
export type PushShape = 'same' | 'flat' | 'long';

export interface PushPullParams {
  /** 물체 */
  object: PushObject;
  /** 하는 일: 밀기, 또는 물체에 맨 줄을 당기기 */
  action: PushAction;
  /** 힘의 세기 */
  strength: PushStrength;
  /** 물체 색깔: 계산에 쓰지 않는 대조 변인 */
  color: PushColor;
}

export interface PushPullSample {
  /** 초 */
  t: number;
  /** 출발점에서 떨어진 거리(cm) */
  distanceCm: number;
  /** 모양이 바뀐 정도(0~1): 찰흙만 0에서 1까지 변한다. 다른 물체는 언제나 0이다. */
  deform: number;
}

export interface PushPullResult {
  /** 움직인 거리(cm), 정수 */
  distance: number;
  /** 움직인 방향(범주) */
  direction: PushDirection;
  /** 모양(범주) */
  shape: PushShape;
}

export interface PushPullOutput {
  samples: PushPullSample[];
  result: PushPullResult;
}

/** 움직인 거리(cm): 물체 × 힘의 세기. 밀기와 당기기가 같다. */
export const PUSH_DISTANCE_CM: Record<PushObject, Record<PushStrength, number>> = {
  cart: { weak: 30, strong: 80 },
  ball: { weak: 20, strong: 50 },
  clay: { weak: 2, strong: 5 },
};
export const PUSH_TOTAL_S = 2;
export const PUSH_SAMPLE_S = 0.05;
/** 손이 물체에 닿는 때(초): 이때부터 물체가 움직이기 시작한다. */
export const PUSH_CONTACT_S = 0.25;
/** 물체가 움직임을 마치는 때(초) */
export const PUSH_MOVE_END_S = 1.4;
/** 찰흙의 모양이 다 바뀌는 때(초) */
export const PUSH_DEFORM_END_S = 0.55;
/** 화면에서 두 움직인 거리를 같다고 보는 기준(cm): 결과가 정수이다. */
export const PUSH_SAME_CM = 0.5;
/** 그래프 세로축 끝(cm) */
export const PUSH_Y_MAX_CM = 90;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: PushPullParams): void => {
  if (!(PUSH_OBJECTS as readonly string[]).includes(p.object)) throw new RangeError(`물체 ${String(p.object)}은(는) ${PUSH_OBJECTS.join(', ')} 중 하나여야 합니다.`);
  if (!(PUSH_ACTIONS as readonly string[]).includes(p.action)) throw new RangeError(`하는 일 ${String(p.action)}은(는) ${PUSH_ACTIONS.join(', ')} 중 하나여야 합니다.`);
  if (!(PUSH_STRENGTHS as readonly string[]).includes(p.strength)) throw new RangeError(`힘의 세기 ${String(p.strength)}은(는) ${PUSH_STRENGTHS.join(', ')} 중 하나여야 합니다.`);
  if (!(PUSH_COLORS as readonly string[]).includes(p.color)) throw new RangeError(`물체 색깔 ${String(p.color)}은(는) ${PUSH_COLORS.join(', ')} 중 하나여야 합니다.`);
};

/** 움직인 방향: 밀기는 손에서 멀어지는 쪽, 당기기는 손 쪽으로 */
export const directionOf = (action: PushAction): PushDirection => (action === 'push' ? 'away' : 'toward');

/** 모양: 찰흙만 변한다. 밀기는 눌려 납작해지고, 당기기는 길게 늘어난다. */
export const shapeOf = (object: PushObject, action: PushAction): PushShape => {
  if (object !== 'clay') return 'same';
  return action === 'push' ? 'flat' : 'long';
};

const ease = (u: number) => 1 - (1 - u) * (1 - u);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * 물체를 밀거나 당긴다. 수치는 이상화한 근사값이며 교사 검수 대상이다. 난수 없음.
 * 움직인 거리는 수레 30·80 cm, 고무공 20·50 cm, 찰흙 2·5 cm(약하게·세게)이고 밀기와 당기기가 같다. 색깔은 계산에 쓰지 않는다.
 * 방향은 밀기 → 손에서 멀어지는 쪽, 당기기 → 손 쪽으로. 모양은 찰흙만 변한다(밀기 → 눌려 납작해짐, 당기기 → 길게 늘어남).
 * 손이 0.25초에 물체에 닿고, 물체는 1.4초까지 출발점에서 떨어진 거리가 부드럽게 늘다가 2초까지 멈춰 있다(0.05초 간격).
 */
export function simulatePushPull(params: PushPullParams): PushPullOutput {
  checkParams(params);
  const distance = PUSH_DISTANCE_CM[params.object][params.strength];
  const result: PushPullResult = { distance, direction: directionOf(params.action), shape: shapeOf(params.object, params.action) };
  const steps = Math.round(PUSH_TOTAL_S / PUSH_SAMPLE_S);
  const samples: PushPullSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * PUSH_SAMPLE_S, 6);
    const move = ease(clamp01((t - PUSH_CONTACT_S) / (PUSH_MOVE_END_S - PUSH_CONTACT_S)));
    const deform = result.shape === 'same' ? 0 : ease(clamp01((t - PUSH_CONTACT_S) / (PUSH_DEFORM_END_S - PUSH_CONTACT_S)));
    samples.push({ t, distanceCm: roundTo(distance * move, 9), deform: roundTo(deform, 9) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolatePushPull(a: PushPullSample, b: PushPullSample, k: number): PushPullSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), distanceCm: lerp(a.distanceCm, b.distanceCm), deform: lerp(a.deform, b.deform) };
}

const KEYS = ['object', 'action', 'strength', 'color'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { object: PUSH_OBJECTS, action: PUSH_ACTIONS, strength: PUSH_STRENGTHS, color: PUSH_COLORS };

/** 매니페스트의 밀고 당기기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validatePushPullExperiment(exp: Experiment): string[] {
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

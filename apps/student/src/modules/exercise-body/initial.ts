import {
  BODY_DEFAULT_REST_BEFORE_MIN,
  simulateBody,
  type BodyParams,
  type BodyResult,
  type BodySample,
  type ExerciseKind,
  type WristKind,
} from '@sci/engine-life';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const bodyOptions = (exp: VariableExperiment) => ({
  totalMin: typeof exp.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
  restBeforeMin: typeof exp.params?.restBeforeMin === 'number' ? exp.params.restBeforeMin : undefined,
});

const toParams = (values: Values) => values as unknown as BodyParams;

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const bodyOutput = (values: Values, exp?: VariableExperiment) => simulateBody(toParams(values), exp ? bodyOptions(exp) : {});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 0분째 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): BodySample => bodyOutput(values, exp).samples[0]!;

export const kindOf = (values: Values): ExerciseKind => (values.kind === 'sit' || values.kind === 'run' ? values.kind : 'walk');
export const wristOf = (values: Values): WristKind => (values.wrist === 'right' ? 'right' : 'left');

export const KIND_TEXT: Record<ExerciseKind, string> = { sit: '가만히 앉아 있기', walk: '걷기', run: '제자리 달리기' };
export const WRIST_TEXT: Record<WristKind, string> = { left: '왼손 손목', right: '오른손 손목' };

/** 운동을 시작하는 시각(분) */
export const startMin = (exp?: VariableExperiment) => (exp ? bodyOptions(exp).restBeforeMin : undefined) ?? BODY_DEFAULT_REST_BEFORE_MIN;
/** 운동이 끝나는 시각(분) = 쉬는 시간 + 운동 시간 */
export const endMin = (values: Values, exp?: VariableExperiment) => startMin(exp) + Number(values.minutes);

/** 분(소수)을 "분:초"로. 예: 2 → "2:00", 1.5 → "1:30" */
export function clockText(min: number): string {
  const total = Math.max(0, Math.round(min * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export type BodyPhase = 'rest' | 'exercise' | 'after';

/** 그 시각의 단계: 운동 시작 전 / 운동 중 / 운동이 끝난 뒤 */
export function phaseAt(t: number, values: Values, exp?: VariableExperiment): BodyPhase {
  const eps = 1e-9;
  if (t <= startMin(exp) + eps) return 'rest';
  return t < endMin(values, exp) - eps ? 'exercise' : 'after';
}

export const PHASE_TEXT: Record<BodyPhase, string> = { rest: '쉬는 중', exercise: '운동 중', after: '운동 후 쉬는 중' };

/** 결과 열 글자 */
export const pulseEndText = (r: BodyResult) => String(r.pulseEnd);
export const breathEndText = (r: BodyResult) => String(r.breathEnd);
export const recoverText = (r: BodyResult) => r.recoverMin.toFixed(1);

/** 아래 문구 */
export function bodyNote(s: BodySample): string {
  return `${clockText(s.t)} · 맥박 ${Math.round(s.pulse)}회/분 · 호흡 ${Math.round(s.breath)}회/분`;
}


/** 가상 친구의 "운동 전 / 운동 직후 / 3분 뒤" 맥박(회/분). 내 맥박 칸 옆에 나란히 보여 주는 값이다. */
export const LATER_MIN = 3;
export function friendPulse(values: Values, exp?: VariableExperiment): Record<'before' | 'after' | 'later', number | null> {
  const { samples, result } = bodyOutput(values, exp);
  const at = (t: number) => {
    const s = samples.find((x) => Math.abs(x.t - t) < 1e-6);
    return s ? Math.round(s.pulse) : null;
  };
  return { before: at(startMin(exp)), after: result.pulseEnd, later: at(endMin(values, exp) + LATER_MIN) };
}

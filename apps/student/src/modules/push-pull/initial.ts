import {
  PUSH_ACTIONS,
  PUSH_COLORS,
  PUSH_OBJECTS,
  PUSH_STRENGTHS,
  simulatePushPull,
  type PushAction,
  type PushColor,
  type PushDirection,
  type PushObject,
  type PushPullParams,
  type PushPullResult,
  type PushPullSample,
  type PushShape,
  type PushStrength,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): PushPullParams => ({
  object: pick(PUSH_OBJECTS, values.object, 'cart'),
  action: pick(PUSH_ACTIONS, values.action, 'push'),
  strength: pick(PUSH_STRENGTHS, values.strength, 'weak'),
  color: pick(PUSH_COLORS, values.color, 'red'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const pushOutput = (values: Values) => simulatePushPull(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 물체는 출발점에 있고 모양은 그대로다. */
export const startSample = (values: Values): PushPullSample => pushOutput(values).samples[0]!;

export const pushResult = (values: Values): PushPullResult => pushOutput(values).result;

export const OBJECT_TEXT: Record<PushObject, string> = { cart: '장난감 수레', ball: '고무공', clay: '찰흙 덩어리' };
export const ACTION_TEXT: Record<PushAction, string> = { push: '밀기', pull: '당기기' };
export const STRENGTH_TEXT: Record<PushStrength, string> = { weak: '약하게', strong: '세게' };
export const COLOR_TEXT: Record<PushColor, string> = { red: '빨간색', blue: '파란색' };
export const DIRECTION_TEXT: Record<PushDirection, string> = { away: '손에서 멀어지는 쪽', toward: '손 쪽으로' };
export const SHAPE_TEXT: Record<PushShape, string> = { same: '그대로', flat: '눌려 납작해짐', long: '길게 늘어남' };

/** 결과 열 글자 */
export const distanceText = (r: Pick<PushPullResult, 'distance'>) => String(r.distance);
export const directionText = (r: Pick<PushPullResult, 'direction'>) => DIRECTION_TEXT[r.direction];
export const shapeText = (r: Pick<PushPullResult, 'shape'>) => SHAPE_TEXT[r.shape];

/** 눈으로 보기·줄자 아래 문구 */
export const pushNote = (s: Pick<PushPullSample, 't' | 'distanceCm'>) => `${s.t.toFixed(1)}초 · 출발점에서 ${Math.round(s.distanceCm)} cm`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

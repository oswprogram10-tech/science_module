import {
  LIFT_ARMS,
  LIFT_COLORS,
  LIFT_TOOLS,
  pullCmOf,
  simulateLeverLift,
  type LeverLiftParams,
  type LeverLiftResult,
  type LeverLiftSample,
  type LiftArm,
  type LiftColor,
  type LiftTool,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list as readonly string[]).includes(String(v)) ? (v as T) : fallback;

export const toParams = (values: Values): LeverLiftParams => ({
  tool: pick(LIFT_TOOLS, values.tool, 'none'),
  arm: pick(LIFT_ARMS, values.armCm, 'short'),
  color: pick(LIFT_COLORS, values.color, 'red'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const liftOutput = (values: Values) => simulateLeverLift(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 물체는 바닥에 있다. */
export const startSample = (values: Values): LeverLiftSample => liftOutput(values).samples[0]!;

export const liftResult = (values: Values): LeverLiftResult => liftOutput(values).result;

export const TOOL_TEXT: Record<LiftTool, string> = { none: '도구 없이', lever: '지레', ramp: '빗면' };
export const ARM_TEXT: Record<LiftArm, string> = { short: '짧게', mid: '중간', long: '길게' };
export const COLOR_TEXT: Record<LiftColor, string> = { red: '빨간 상자', blue: '파란 상자' };

/** 힘을 주는 쪽 길이를 설명하는 그림 속 글자 */
export const armLine = (tool: LiftTool, arm: LiftArm): string => {
  if (tool === 'none') return '손으로 곧바로 들어 올려요';
  const cm = pullCmOf(tool, arm);
  return tool === 'lever' ? `받침점에서 손까지 ${cm} cm` : `빗면 길이 ${cm} cm`;
};

/** 눈으로 보기 아래 문구 */
export const liftNote = (s: Pick<LeverLiftSample, 't' | 'force'>) => `손으로 ${Math.round(s.t)} cm 당김 · 저울 눈금 ${Math.round(s.force)} g`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

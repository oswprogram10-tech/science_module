import { simulateLever, type LeverParams, type LeverResult, type LeverSample, type TiltSide, type WeightShape } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const leverOptions = (exp?: VariableExperiment) => ({
  durationS: typeof exp?.params?.durationS === 'number' ? exp.params.durationS : undefined,
});

export const toParams = (values: Values): LeverParams => ({
  count: Number(values.count),
  distance: Number(values.distance),
  shape: values.shape === 'cube' ? 'cube' : 'cylinder',
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const leverOutput = (values: Values, exp?: VariableExperiment) => simulateLever(toParams(values), leverOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 t = 0 의 샘플(손으로 수평을 잡고 있다) */
export const startSample = (values: Values, exp?: VariableExperiment): LeverSample => leverOutput(values, exp).samples[0]!;

export const shapeOf = (values: Values): WeightShape => (values.shape === 'cube' ? 'cube' : 'cylinder');
export const SHAPE_TEXT: Record<WeightShape, string> = { cylinder: '원기둥', cube: '정육면체' };

/** 결과 열 글자 */
export const SIDE_TEXT: Record<TiltSide, string> = { left: '왼쪽이 내려감', level: '수평', right: '오른쪽이 내려감' };
export const sideText = (r: LeverResult) => SIDE_TEXT[r.side];

/** 눈으로 보기 아래 문구에 쓰는 말 */
export const SIDE_NOTE: Record<TiltSide, string> = { left: '왼쪽이 내려갔어요', level: '수평이에요', right: '오른쪽이 내려갔어요' };
/** 이 각도(도)보다 작게 기울어 있으면 수평으로 본다. */
const LEVEL_EPS_DEG = 0.05;
export const sideOfAngle = (angleDeg: number): TiltSide => (angleDeg > LEVEL_EPS_DEG ? 'right' : angleDeg < -LEVEL_EPS_DEG ? 'left' : 'level');

import {
  lightAreaRatio,
  simulateSunAngle,
  type SunAngleParams,
  type SunAngleResult,
  type SunAngleSample,
} from '@sci/engine-earth';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const sunOptions = (exp: VariableExperiment) => ({
  latDeg: typeof exp.params?.latDeg === 'number' ? exp.params.latDeg : undefined,
});

const toParams = (values: Values) => values as unknown as SunAngleParams;

/** 고른 조건 그대로 계산한 결과. 시간에 따라 변하지 않는다. */
export const sunResult = (values: Values, exp: VariableExperiment): SunAngleResult =>
  simulateSunAngle(toParams(values), sunOptions(exp)).result;

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 낮 12시의 샘플. exp가 없으면 기본 위도를 쓴다. */
export const noonSample = (values: Values, exp?: VariableExperiment): SunAngleSample =>
  simulateSunAngle(toParams(values), exp ? sunOptions(exp) : {}).samples.find((s) => s.t === 12)!;

/** 고른 조건에서 낮 12시 땅에 닿는 빛의 넓이가 봄의 몇 배인가. */
export const areaRatio = (values: Values, exp: VariableExperiment): number => lightAreaRatio(toParams(values), sunOptions(exp));

/** 시각(시, 0~24)을 "14시 5분"으로. */
export function clockText(t: number): string {
  const total = Math.round(t * 60);
  return `${Math.floor(total / 60)}시 ${total % 60}분`;
}

/** 낮의 길이(시간)를 "14시간 35분"으로. */
export function dayLengthText(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}시간 ${total % 60}분`;
}

/** 태양이 지평선 아래에 있다고 보는 고도(°) */
export const BELOW_HORIZON_DEG = 0.05;

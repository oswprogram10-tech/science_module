import { simulateConvexLens, type ConvexLensParams, type ConvexLensResult, type ConvexLensSample } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

const numParam = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const lensOptions = (exp: VariableExperiment) => ({
  roomC: numParam(exp.params?.roomC),
  durationS: numParam(exp.params?.durationS),
});

const simulate = (values: Values, exp: VariableExperiment) =>
  simulateConvexLens(values as unknown as ConvexLensParams, lensOptions(exp));

/** 고른 조건 그대로 계산한 결과(빛 원 지름, 밝기 배율). 시간에 따라 변하지 않는다. */
export const lensResult = (values: Values, exp: VariableExperiment): ConvexLensResult => simulate(values, exp).result;

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 t = 0 의 샘플. */
export const initialSample = (values: Values, exp: VariableExperiment): ConvexLensSample => simulate(values, exp).samples[0]!;

export const optionLabel = (exp: VariableExperiment, key: string, value: unknown) =>
  exp.variables.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value ?? '');

/** 밝기를 글자로: 1000배 이상은 한 줄로 묶는다. */
export const brightnessText = (concentration: number) =>
  concentration >= 1000 ? '햇빛의 1000배 이상' : `햇빛의 ${concentration}배`;

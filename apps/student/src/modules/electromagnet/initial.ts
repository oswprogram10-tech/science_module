import {
  simulateElectromagnet,
  type ElectromagnetParams,
  type ElectromagnetResult,
  type ElectromagnetSample,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

const numParam = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const magnetOptions = (exp: VariableExperiment) => ({
  durationS: numParam(exp.params?.durationS),
  onS: numParam(exp.params?.onS),
  offS: numParam(exp.params?.offS),
});

const simulate = (values: Values, exp: VariableExperiment) =>
  simulateElectromagnet(values as unknown as ElectromagnetParams, magnetOptions(exp));

/** 고른 조건 그대로 계산한 결과. 시간에 따라 변하지 않는다. */
export const magnetResult = (values: Values, exp: VariableExperiment): ElectromagnetResult => simulate(values, exp).result;

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 t = 0 의 샘플(스위치 꺼짐). */
export const initialSample = (values: Values, exp: VariableExperiment): ElectromagnetSample => simulate(values, exp).samples[0]!;

export const poleText = (pole: string) => `${pole}극`;

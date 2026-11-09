import { simulateInsulatedCup, type InsulatedCupParams, type InsulatedCupSample } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

const numParam = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const cupOptions = (exp: VariableExperiment) => ({
  startC: numParam(exp.params?.startC),
  roomC: numParam(exp.params?.roomC),
  durationS: numParam(exp.params?.durationS),
});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 t = 0 의 샘플. 고른 조건 그대로 계산한다. */
export function initialSample(values: Values, exp: VariableExperiment): InsulatedCupSample {
  return simulateInsulatedCup(values as unknown as InsulatedCupParams, cupOptions(exp)).samples[0]!;
}

export const optionLabel = (exp: VariableExperiment, key: string, value: unknown) =>
  exp.variables.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value ?? '');

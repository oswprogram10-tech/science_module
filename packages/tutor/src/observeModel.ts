import { SEOUL_LAT_DEG, answerFor } from '@sci/engine-earth';
import type { ObservationExperiment, ObservationTask } from '@sci/schema';

export const latOf = (exp: ObservationExperiment): number => {
  const v = exp.params?.latDeg;
  return typeof v === 'number' ? v : SEOUL_LAT_DEG;
};

/** 모델이 계산한 이 과제의 결과(선택지 value). 조작의 현재 값을 쓴다. */
export function modelAnswer(
  exp: ObservationExperiment,
  task: ObservationTask,
  controls: Record<string, string | number>,
): string {
  const day = exp.params?.dayOfYear;
  return answerFor(task.answer, controls, {
    latDeg: latOf(exp),
    dayOfYear: typeof day === 'number' ? day : undefined,
  });
}

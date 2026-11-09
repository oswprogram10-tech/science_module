import type { Trial } from '@sci/runtime';
import type { VariableExperiment } from '@sci/schema';
import type { AnyModule } from './types';

/**
 * 재생이 끝난 뒤 플레이헤드를 둘 시각. 숫자는 그대로, 함수는 그 시행의 조건·결과로 계산한다.
 * 모듈에 restPlayhead가 없으면 undefined(끝에 둔다).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function restPlayheadOf(mod: AnyModule, experiment: VariableExperiment, trial: Trial<any, any>): number | undefined {
  const r = mod.restPlayhead;
  return typeof r === 'function' ? r(experiment, trial) : r;
}

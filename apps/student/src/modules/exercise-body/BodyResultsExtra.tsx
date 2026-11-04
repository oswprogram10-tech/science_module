import { useMemo } from 'react';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';
import { friendPulse } from './initial';
import { RealPulsePanel } from './realPulse/RealPulsePanel';

/** 결과표 아래 "내 맥박 재기(선택)". 가상 친구의 같은 시점 값과 나란히 보여 줄 뿐, 시뮬레이션과 이어지지 않는다. */
export function BodyResultsExtra({ experiment, values }: { experiment: VariableExperiment; values: Values }) {
  const friend = useMemo(() => friendPulse(values, experiment), [values, experiment]);
  return <RealPulsePanel friend={friend} />;
}

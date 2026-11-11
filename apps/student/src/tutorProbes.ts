import { useMemo } from 'react';
import { applyTutorEdits, type ProbeTemplate } from '@sci/tutor';
import { useTutorEdits } from './classroom/bus';

/**
 * 활동의 튜터 질문(probes)에 선생님이 수업으로 보낸 덧씌우기를 적용한다(고치기·끄기·더하기).
 * 수업에 참여하지 않았거나 보낸 것이 없으면 받은 질문 그대로다. 가드(renderAndGuard)는 이 뒤에도 마지막 검사로 남는다.
 * taskId는 관찰 활동에서 과제(tasks[]) 하나의 질문을 넘길 때만 준다.
 */
export function useTutorProbes(unitId: string, experimentId: string, probes: ProbeTemplate[], taskId?: string): ProbeTemplate[] {
  const edits = useTutorEdits();
  const exp = edits?.units[unitId]?.[experimentId];
  return useMemo(() => applyTutorEdits(probes, exp, taskId), [probes, exp, taskId]);
}

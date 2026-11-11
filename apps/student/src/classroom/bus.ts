import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { TutorEdits } from '@sci/classroom';

/**
 * 실험 화면과 수업 연결 사이의 아주 작은 통로.
 * 이 파일은 항상 번들에 들어가므로 작게 유지하고, 서버와 통신하는 코드는 `ui.tsx`(필요할 때만 불러옴)에 둔다.
 * 서버 주소가 없으면 아무도 듣지 않으므로 아무 일도 일어나지 않는다.
 */

export type SafetyKind = 'NO_GOGGLES' | 'NO_GLOVES' | 'SPILL' | 'FOOD';

/** 서버로 보낼 진행 요약. 튜터 대화·카메라·센서 값은 들어 있지 않다. */
export interface StatusReport {
  unitId?: string;
  activity?: 'variable' | 'classify' | 'observe' | 'card-sort' | 'portfolio';
  /** 한 단원에 활동이 여럿일 때 어느 활동인지. */
  experimentId?: string;
  phase: 'designing' | 'running' | 'reviewing' | 'idle';
  trials: number;
  lastKind?: string;
  mismatch?: boolean;
  safetyLocked: boolean;
}

export type BusEvent =
  | { k: 'status'; status: StatusReport }
  | { k: 'safety'; type: SafetyKind; at: number }
  | { k: 'clear'; type: SafetyKind };

export const IDLE: StatusReport = { phase: 'idle', trials: 0, safetyLocked: false };

let status: StatusReport = IDLE;
let paused = false;
/** 선생님이 보낸 튜터 질문 덧씌우기. 메모리에만 둔다(sessionStorage·localStorage에는 쓰지 않는다). */
let tutorEdits: TutorEdits | null = null;
const eventListeners = new Set<(e: BusEvent) => void>();
const pauseListeners = new Set<() => void>();
const tutorListeners = new Set<() => void>();

export const bus = {
  getStatus: () => status,
  onEvent(l: (e: BusEvent) => void) {
    eventListeners.add(l);
    return () => void eventListeners.delete(l);
  },
  getPaused: () => paused,
  subscribePause(l: () => void) {
    pauseListeners.add(l);
    return () => void pauseListeners.delete(l);
  },
  setPaused(on: boolean) {
    if (paused === on) return;
    paused = on;
    pauseListeners.forEach((l) => l());
  },
  getTutorEdits: (): TutorEdits | null => tutorEdits,
  subscribeTutorEdits(l: () => void) {
    tutorListeners.add(l);
    return () => void tutorListeners.delete(l);
  },
  /** 서버가 보낸 덧씌우기를 둔다. 수업에서 나오거나 수업이 끝나면 null로 지운다. */
  setTutorEdits(next: TutorEdits | null) {
    if (tutorEdits === next) return;
    tutorEdits = next;
    tutorListeners.forEach((l) => l());
  },
};

const emit = (e: BusEvent) => eventListeners.forEach((l) => l(e));

export function reportStatus(next: StatusReport | null): void {
  status = next ?? IDLE;
  emit({ k: 'status', status });
}
export const reportSafety = (type: SafetyKind): void => emit({ k: 'safety', type, at: Date.now() });
export const reportSafetyClear = (types: Iterable<SafetyKind>): void => {
  for (const type of new Set(types)) emit({ k: 'clear', type });
};

/**
 * 활동이 둘 이상인 단원에서만 지금 활동의 id를 담는다(App의 Routes가 채운다).
 * 활동이 하나인 단원은 비어 있어 status 메시지에 experimentId가 실리지 않는다(기존 메시지와 같다).
 */
export const ExperimentIdContext = createContext<string | undefined>(undefined);

/** 실험 화면이 현재 상태를 알린다. 화면에서 나가면 '단원 목록(idle)'으로 알린다. */
export function useClassroomStatus(report: StatusReport): void {
  const experimentId = useContext(ExperimentIdContext);
  const key = JSON.stringify(experimentId ? { ...report, experimentId } : report);
  useEffect(() => {
    reportStatus(JSON.parse(key) as StatusReport);
  }, [key]);
  useEffect(() => () => reportStatus(null), []);
}

/** 선생님이 "모두 멈춤"을 눌렀는가. */
export const usePaused = (): boolean => useSyncExternalStore(bus.subscribePause, bus.getPaused);

/** 선생님이 수업에 보낸 튜터 질문 덧씌우기(없으면 null: 매니페스트의 기본 질문을 그대로 쓴다). */
export const useTutorEdits = (): TutorEdits | null => useSyncExternalStore(bus.subscribeTutorEdits, bus.getTutorEdits, bus.getTutorEdits);

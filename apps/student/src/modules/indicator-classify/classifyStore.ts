import {
  checkClassification,
  evidenceGroup,
  type CheckResult,
  type GroupKey,
} from '@sci/engine-matter';
import type { ClassificationExperiment, ClassifyProbeWhen } from '@sci/schema';
import type { SafetyEvent } from '@sci/vision';

export type Prediction = GroupKey | 'unsure';

export interface ClassifyState {
  selected: string | null;
  predictions: Record<string, Prediction | undefined>;
  /** 용액별로 시험한 지시약(시험한 순서, 중복 없음). */
  tests: Record<string, string[] | undefined>;
  placement: Record<string, GroupKey | null | undefined>;
  safetyConfirmed: boolean;
  checked: CheckResult | null;
  /** 아직 학생이 확인하지 않은 안전 경고. 하나라도 있으면 배너가 뜨고 시험이 잠긴다. */
  alerts: SafetyEvent[];
}

export type TestBlock = 'no-selection' | 'no-prediction' | 'alert-active' | 'safety-required';

export function createInitialState(): ClassifyState {
  return {
    selected: null,
    predictions: {},
    tests: {},
    placement: {},
    safetyConfirmed: false,
    checked: null,
    alerts: [],
  };
}

const hasSolution = (exp: ClassificationExperiment, key: string) => exp.solutions.some((s) => s.key === key);
const hasIndicator = (exp: ClassificationExperiment, key: string) => exp.indicators.some((i) => i.key === key);

/** 지금 지시약을 시험할 수 있는가. 못 하면 이유를 돌려준다. 우선순위는 위에서부터. */
export function testBlock(state: ClassifyState, exp: ClassificationExperiment): TestBlock | null {
  const sel = state.selected;
  if (!sel) return 'no-selection';
  if (!state.predictions[sel]) return 'no-prediction';
  if (state.alerts.length > 0) return 'alert-active';
  const sol = exp.solutions.find((s) => s.key === sel);
  if (sol?.hazard && !state.safetyConfirmed) return 'safety-required';
  return null;
}

export function select(state: ClassifyState, exp: ClassificationExperiment, solution: string): ClassifyState {
  if (!hasSolution(exp, solution)) return state;
  return { ...state, selected: solution };
}

export function predict(state: ClassifyState, exp: ClassificationExperiment, solution: string, p: Prediction): ClassifyState {
  if (!hasSolution(exp, solution)) return state;
  return { ...state, predictions: { ...state.predictions, [solution]: p } };
}

/** 선택한 용액을 지시약으로 시험한다. 막혀 있으면 상태를 바꾸지 않는다. 같은 지시약을 다시 시험해도 기록은 늘지 않는다. */
export function testIndicator(state: ClassifyState, exp: ClassificationExperiment, indicator: string): ClassifyState {
  if (!hasIndicator(exp, indicator) || testBlock(state, exp) !== null) return state;
  const sel = state.selected!;
  const prev = state.tests[sel] ?? [];
  if (prev.includes(indicator)) return state;
  return { ...state, tests: { ...state.tests, [sel]: [...prev, indicator] }, checked: null };
}

export function place(
  state: ClassifyState,
  exp: ClassificationExperiment,
  solution: string,
  group: GroupKey | null,
): ClassifyState {
  if (!hasSolution(exp, solution)) return state;
  return { ...state, placement: { ...state.placement, [solution]: group }, checked: null };
}

export function confirmSafety(state: ClassifyState): ClassifyState {
  return state.safetyConfirmed ? state : { ...state, safetyConfirmed: true };
}

export function raiseAlert(state: ClassifyState, event: SafetyEvent): ClassifyState {
  return { ...state, alerts: [...state.alerts, event] };
}

/** "착용했어요": 경고를 모두 닫는다. */
export function dismissAlerts(state: ClassifyState): ClassifyState {
  return state.alerts.length === 0 ? state : { ...state, alerts: [] };
}

export function allPlaced(state: ClassifyState, exp: ClassificationExperiment): boolean {
  return exp.solutions.every((s) => (state.placement[s.key] ?? null) !== null);
}

/** 8개를 모두 배치해야 확인할 수 있다. */
export function check(state: ClassifyState, exp: ClassificationExperiment): ClassifyState {
  if (!allPlaced(state, exp)) return state;
  return { ...state, checked: checkClassification(exp, state) };
}

/** 튜터 상자가 쓸 상황 키와 {solution} 치환값. 위에서부터 첫 규칙을 적용한다. */
export function tutorSituation(
  state: ClassifyState,
  exp: ClassificationExperiment,
): { when: ClassifyProbeWhen; solution: string } {
  const label = (key: string | null | undefined) => exp.solutions.find((s) => s.key === key)?.label ?? '';
  if (state.checked) {
    const kind = state.checked.kind;
    const bad = state.checked.items.find((i) => i.status === 'inconsistent');
    return { when: kind, solution: label(bad?.solution ?? state.selected) };
  }
  const sel = state.selected;
  const tested = sel ? (state.tests[sel] ?? []) : [];
  if (sel && tested.length === 0) return { when: 'before-test', solution: label(sel) };
  const pred = sel ? state.predictions[sel] : undefined;
  if (sel && (pred === 'acid' || pred === 'base')) {
    const ev = evidenceGroup(exp, sel, tested);
    if (ev !== null && ev !== pred) return { when: 'prediction-mismatch', solution: label(sel) };
  }
  return { when: 'testing', solution: label(sel) };
}

// ---- useSyncExternalStore용 얇은 저장소 ----

export interface ClassifyStore {
  getState(): ClassifyState;
  subscribe(listener: () => void): () => void;
  update(fn: (s: ClassifyState) => ClassifyState): ClassifyState;
}

export function createClassifyStore(initial: ClassifyState = createInitialState()): ClassifyStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      const next = fn(state);
      if (next !== state) {
        state = next;
        listeners.forEach((l) => l());
      }
      return state;
    },
  };
}

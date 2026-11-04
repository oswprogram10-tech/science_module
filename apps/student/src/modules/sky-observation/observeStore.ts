import type { ObservationExperiment, ObservationProbeWhen, ObservationTask } from '@sci/schema';
import { observeWhen } from '@sci/tutor';
import { DEFAULT_MONTH, defaultHour, modelAnswer, type Controls } from './model';

export type Value = string | number;

export interface Recorded {
  value: Value;
  /** 기록할 때의 조작 값. 모델 결과와 비교할 때 쓴다. */
  controls: Controls;
}

export interface TaskState {
  prediction: Value | null;
  controls: Controls;
  hour: number;
  month: number;
  /** 시각·달 슬라이더나 조건 토글을 한 번 이상 움직였는가. */
  observed: boolean;
  recorded: Recorded | null;
}

export interface ObserveState {
  selected: string;
  tasks: Record<string, TaskState | undefined>;
  /** 땅에서 보기 화면에 점선으로 남기는 지나온 시각들(과제를 바꾸거나 조건을 바꾸면 지운다). */
  trail: number[];
}

const taskOf = (exp: ObservationExperiment, id: string): ObservationTask | undefined => exp.tasks.find((t) => t.id === id);

export const quantizeHour = (h: number): number => Math.min(24, Math.max(0, Math.round(h * 2) / 2));

function initialTask(task: ObservationTask): TaskState {
  return {
    prediction: null,
    controls: Object.fromEntries((task.controls ?? []).map((c) => [c.key, c.default])),
    hour: defaultHour(task),
    month: DEFAULT_MONTH,
    observed: false,
    recorded: null,
  };
}

export function createInitialState(exp: ObservationExperiment): ObserveState {
  const tasks = Object.fromEntries(exp.tasks.map((t) => [t.id, initialTask(t)]));
  const first = exp.tasks[0]!;
  return { selected: first.id, tasks, trail: first.view === 'rotation' ? [tasks[first.id]!.hour] : [] };
}

/** 선택한 과제와 그 상태. */
export function current(state: ObserveState, exp: ObservationExperiment): { task: ObservationTask; ts: TaskState } {
  const task = taskOf(exp, state.selected) ?? exp.tasks[0]!;
  return { task, ts: state.tasks[task.id] ?? initialTask(task) };
}

function withTask(state: ObserveState, id: string, patch: Partial<TaskState>): ObserveState {
  const prev = state.tasks[id]!;
  return { ...state, tasks: { ...state.tasks, [id]: { ...prev, ...patch } } };
}

export function select(state: ObserveState, exp: ObservationExperiment, taskId: string): ObserveState {
  const task = taskOf(exp, taskId);
  if (!task || taskId === state.selected) return state;
  const ts = state.tasks[taskId]!;
  return { ...state, selected: taskId, trail: task.view === 'rotation' ? [ts.hour] : [] };
}

/** 예측을 고른다(바꿔도 된다). 선택지에 없는 값은 무시한다. */
export function predict(state: ObserveState, exp: ObservationExperiment, value: Value): ObserveState {
  const { task, ts } = current(state, exp);
  if (!task.options.some((o) => o.value === value) || ts.prediction === value) return state;
  return withTask(state, task.id, { prediction: value });
}

/** 예측을 골라야 관찰 조작이 켜진다. */
export const canObserve = (state: ObserveState, exp: ObservationExperiment): boolean =>
  current(state, exp).ts.prediction !== null;

/** 관찰 조작을 한 번 이상 해야 기록할 수 있다. */
export const canRecord = (state: ObserveState, exp: ObservationExperiment): boolean => {
  const { ts } = current(state, exp);
  return ts.prediction !== null && ts.observed;
};

/** rotation 과제의 시각(0~24시, 0.5시 단위). 막혀 있거나 값이 그대로면 상태를 바꾸지 않는다. */
export function setHour(state: ObserveState, exp: ObservationExperiment, hour: number): ObserveState {
  const { task, ts } = current(state, exp);
  if (task.view !== 'rotation' || ts.prediction === null || !Number.isFinite(hour)) return state;
  const h = quantizeHour(hour);
  if (h === ts.hour) return state;
  const trail = state.trail.includes(h) ? state.trail : [...state.trail, h];
  return { ...withTask(state, task.id, { hour: h, observed: true }), trail };
}

/** revolution 과제의 달(1~12월). */
export function setMonth(state: ObserveState, exp: ObservationExperiment, month: number): ObserveState {
  const { task, ts } = current(state, exp);
  if (task.view !== 'revolution' || ts.prediction === null || !Number.isFinite(month)) return state;
  const m = Math.min(12, Math.max(1, Math.round(month)));
  if (m === ts.month) return state;
  return withTask(state, task.id, { month: m, observed: true });
}

/** 과제의 조건 토글(예: 자전 방향). 조건이 바뀌면 지나온 태양 자리 점선을 지운다. */
export function setControl(state: ObserveState, exp: ObservationExperiment, key: string, value: Value): ObserveState {
  const { task, ts } = current(state, exp);
  const control = task.controls?.find((c) => c.key === key);
  if (!control || ts.prediction === null || !control.options.some((o) => o.value === value)) return state;
  if (ts.controls[key] === value) return state;
  return {
    ...withTask(state, task.id, { controls: { ...ts.controls, [key]: value }, observed: true }),
    trail: task.view === 'rotation' ? [ts.hour] : [],
  };
}

/** 관찰한 것을 기록한다. 같은 선택지를 다시 눌러도 그 시점의 조건으로 다시 기록한다. */
export function record(state: ObserveState, exp: ObservationExperiment, value: Value): ObserveState {
  const { task, ts } = current(state, exp);
  if (!canRecord(state, exp) || !task.options.some((o) => o.value === value)) return state;
  return withTask(state, task.id, { recorded: { value, controls: { ...ts.controls } } });
}

export const isCompleted = (state: ObserveState, taskId: string): boolean => (state.tasks[taskId]?.recorded ?? null) !== null;

/** 기록한 것이 기록 당시 조건의 모델 결과와 같은가. 기록이 없으면 null. */
export function recordMatchesModel(exp: ObservationExperiment, task: ObservationTask, ts: TaskState): boolean | null {
  if (!ts.recorded) return null;
  return ts.recorded.value === modelAnswer(exp, task, ts.recorded.controls);
}

export type FeedbackKind = 'idle' | 'mismatch' | 'match';

export function feedbackKind(state: ObserveState, exp: ObservationExperiment): FeedbackKind {
  const { task, ts } = current(state, exp);
  const m = recordMatchesModel(exp, task, ts);
  return m === null ? 'idle' : m ? 'match' : 'mismatch';
}

/** 튜터 칸 선택 규칙. 위에서부터 첫 규칙을 적용한다. */
export function tutorSituation(state: ObserveState, exp: ObservationExperiment): ObservationProbeWhen {
  const { task, ts } = current(state, exp);
  return observeWhen({
    prediction: ts.prediction,
    recorded: ts.recorded?.value ?? null,
    matchesModel: recordMatchesModel(exp, task, ts),
  });
}

// ---- useSyncExternalStore용 얇은 저장소 ----

export interface ObserveStore {
  getState(): ObserveState;
  subscribe(listener: () => void): () => void;
  update(fn: (s: ObserveState) => ObserveState): ObserveState;
}

export function createObserveStore(initial: ObserveState): ObserveStore {
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

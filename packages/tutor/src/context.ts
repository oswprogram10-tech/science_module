import {
  OBSERVED_LABEL,
  PREDICTION_LABEL,
  observedOutcome,
  type AnalysisKind,
  type Prediction,
} from '@sci/gateway';
import { indicatorColor, type CheckKind } from '@sci/engine-matter';
import {
  createSortState,
  isEmptySplit,
  isFinished,
  isOrderFinished,
  isTreeFinished,
  splitCount,
  type OrderState,
  type TreeState,
} from '@sci/cardsort';
import {
  isCardSortExperiment,
  isClassificationExperiment,
  isObservationExperiment,
  isVariableExperiment,
  type CardSortExperiment,
  type ClassificationExperiment,
  type Experiment,
  type ObservationExperiment,
  type ObservationTask,
  type VariableExperiment,
} from '@sci/schema';
import { pickProbeKey } from './index';
import { modelAnswer } from './observeModel';
import { cardSortWhen, classifyWhen, observeWhen } from './situation';

/** 입력 형식 버전. 형식을 바꾸면 올린다(학습 데이터를 다시 내보내야 한다). */
export const PROMPT_VERSION = 'v0';

/** 시행 요약에 담는 최근 시행 수. */
export const MAX_TRIALS = 3;

// ---- 상태 ----

export type TutorValue = string | number;
export type TutorResult = Record<string, number | string | boolean>;

export interface TutorTrial {
  index: number;
  values: Record<string, TutorValue>;
  ivKey: string | null;
  prediction: Prediction | null;
  result: TutorResult;
  analysis: { kind: AnalysisKind; changed: string[] };
  /** fair-test일 때 앞 시행과 비교한 실제 변화. */
  observed: Prediction | null;
}

export type ClassifyGuess = 'acid' | 'base' | 'unsure';

/** 튜터 모델 입력의 원천이 되는 실험 상태. JSON으로 직렬화할 수 있다. */
export type TutorState =
  | {
      kind: 'variable';
      unitId: string;
      experimentId: string;
      current: { values: Record<string, TutorValue>; ivKey: string | null; prediction: Prediction | null };
      /** 최근 3개까지. */
      trials: TutorTrial[];
    }
  | {
      kind: 'classify';
      unitId: string;
      experimentId: string;
      selected: string | null;
      predictions: Record<string, ClassifyGuess>;
      tests: Record<string, { indicator: string; color: string }[]>;
      placement: Record<string, string | null>;
      check: { kind: string; items: { solution: string; status: string }[] } | null;
    }
  | {
      kind: 'observe';
      unitId: string;
      experimentId: string;
      taskId: string;
      prediction: string | null;
      recorded: string | null;
      controls: Record<string, string>;
      matchesModel: boolean | null;
    }
  | {
      kind: 'card-sort';
      unitId: string;
      experimentId: string;
      selected: string | null;
      criterion: string | null;
      /** 카드 key -> 관찰한 특징 key들. */
      observed: Record<string, string[]>;
      /** 카드 key -> 지금 기준에서 넣은 무리 key. */
      placement: Record<string, string | null>;
      completed: string[];
      check: { kind: string; items: { card: string; status: string }[] } | null;
      /** 트리 배치일 때만. criterion·placement·check는 지금 나누는 노드의 것이다. */
      tree?: { finished: boolean; splitEmpty: boolean; splits: number; nodeCards: string[] };
      /**
       * 순서 놓기일 때만. check는 순서 확인 결과이고 criterion·placement·completed는 쓰지 않는다.
       * 칸에 놓은 카드와 followUp(무리 나누기)에서 학생이 한 활동만 담는다.
       */
      order?: {
        /** 칸(먼저 쌓인 칸부터)에 놓은 카드 key. 빈 칸은 null. */
        slots: (string | null)[];
        finished: boolean;
        followUp: {
          placement: Record<string, string | null>;
          check: { kind: string; items: { card: string; status: string }[] } | null;
        };
      };
    };

export interface UnitInfo {
  title: string;
  grade: number;
}

function expectKind<K extends TutorState['kind']>(
  state: TutorState,
  kind: K,
): Extract<TutorState, { kind: K }> {
  if (state.kind !== kind) throw new Error(`상태 종류가 맞지 않습니다: ${state.kind} (필요: ${kind})`);
  return state as Extract<TutorState, { kind: K }>;
}

function variableExp(experiment: Experiment): VariableExperiment {
  if (!isVariableExperiment(experiment)) throw new Error('변인 실험이 아닙니다.');
  return experiment;
}
function classifyExp(experiment: Experiment): ClassificationExperiment {
  if (!isClassificationExperiment(experiment)) throw new Error('분류 활동이 아닙니다.');
  return experiment;
}
function cardSortExp(experiment: Experiment): CardSortExperiment {
  if (!isCardSortExperiment(experiment)) throw new Error('카드 분류 활동이 아닙니다.');
  return experiment;
}
function observeExp(experiment: Experiment): ObservationExperiment {
  if (!isObservationExperiment(experiment)) throw new Error('관찰 활동이 아닙니다.');
  return experiment;
}

// ---- 상황 ----

/** 지금 상황 키. 변인 실험은 pickProbeKey, 분류·관찰은 앱과 같은 규칙(situation.ts)을 쓴다. */
export function situationOf(state: TutorState, experiment: Experiment): string {
  if (state.kind === 'variable') {
    variableExp(experiment);
    const last = state.trials[state.trials.length - 1];
    return pickProbeKey({
      lastAnalysis: last?.analysis,
      labels: {},
      prediction: last?.prediction ?? null,
      observed: last?.observed ?? null,
    });
  }
  if (state.kind === 'classify') {
    const exp = classifyExp(experiment);
    const sel = state.selected;
    return classifyWhen(exp, {
      selected: sel,
      predictions: state.predictions,
      tested: sel ? (state.tests[sel] ?? []).map((t) => t.indicator) : [],
      checkKind: (state.check?.kind as CheckKind | undefined) ?? null,
    });
  }
  if (state.kind === 'card-sort') {
    const exp = cardSortExp(experiment);
    const sel = state.selected;
    if (state.order) {
      return cardSortWhen(exp, {
        criterion: null,
        selected: sel,
        observed: sel ? (state.observed[sel] ?? []) : [],
        checkKind: state.check?.kind ?? null,
        finished: state.order.finished,
        order: {
          orderCheck: state.check?.kind ?? null,
          followUpCheck: state.order.followUp.check?.kind ?? null,
          feature: exp.orderBy?.feature ?? '',
        },
      });
    }
    return cardSortWhen(exp, {
      criterion: state.criterion,
      selected: sel,
      observed: sel ? (state.observed[sel] ?? []) : [],
      checkKind: state.check?.kind ?? null,
      finished: state.tree ? state.tree.finished : isFinished({ ...createSortState(), completed: state.completed }, exp),
      ...(state.tree ? { tree: true, treeSplitEmpty: state.tree.splitEmpty } : {}),
    });
  }
  observeExp(experiment);
  return observeWhen({
    prediction: state.prediction,
    recorded: state.recorded,
    matchesModel: state.matchesModel,
  });
}

// ---- 입력 문장화 ----

const JOIN = ' · ';

function optionLabel(options: { value: TutorValue; label: string }[], value: TutorValue | undefined): string {
  if (value === undefined) return '';
  return options.find((o) => o.value === value)?.label ?? String(value);
}

function formatNumber(n: number): string {
  return n.toFixed(1);
}

/** "5.7 g", "28.5초"처럼. 한글 단위는 붙여 쓴다. */
function formatMeasure(value: number | string | boolean, unit: string | undefined): string {
  const text = typeof value === 'number' ? formatNumber(value) : String(value);
  if (!unit) return text;
  return /^[가-힣]/.test(unit) ? `${text}${unit}` : `${text} ${unit}`;
}

function variableValues(
  exp: VariableExperiment,
  values: Record<string, TutorValue>,
  changed: readonly string[],
): string {
  return exp.variables
    .map((v) => `${v.label} ${optionLabel(v.options, values[v.key])}${changed.includes(v.key) ? '(바뀜)' : ''}`)
    .join(JOIN);
}

function variableBody(exp: VariableExperiment, state: Extract<TutorState, { kind: 'variable' }>): string[] {
  const labelOf = (key: string | null) => (key ? (exp.variables.find((v) => v.key === key)?.label ?? key) : null);
  const last = state.trials[state.trials.length - 1];
  const iv = labelOf(last ? last.ivKey : state.current.ivKey);
  const lines = [`[바꿀 조건] ${iv ?? '(고르지 않음)'}`, '[시행]'];
  if (state.trials.length === 0) {
    lines.push('(아직 실행하지 않음)');
    const pred = state.current.prediction ? ` · 예측 ${PREDICTION_LABEL[state.current.prediction]}` : '';
    lines.push(`[현재 조건] ${variableValues(exp, state.current.values, [])}${pred}`);
    return lines;
  }
  for (const t of state.trials) {
    const results = exp.dependent
      .filter((d) => t.result[d.key] !== undefined)
      .map((d) => `${d.label} ${formatMeasure(t.result[d.key]!, d.unit)}`);
    let line = `${t.index}) ${variableValues(exp, t.values, t.analysis.changed)} → ${results.join(JOIN)}`;
    if (t.prediction) line += `${JOIN}예측 ${PREDICTION_LABEL[t.prediction]}`;
    if (t.observed) line += `${JOIN}결과 ${OBSERVED_LABEL[t.observed]}`;
    lines.push(line);
  }
  return lines;
}

const STATUS_NAME: Record<string, string> = {
  consistent: '관찰과 분류가 맞음',
  inconsistent: '다시 비교 필요',
  untested: '시험 안 함',
  undetermined: '단서 부족',
  unplaced: '무리에 안 넣음',
};

function classifyBody(exp: ClassificationExperiment, state: Extract<TutorState, { kind: 'classify' }>): string[] {
  const solLabel = (key: string | null | undefined) => exp.solutions.find((s) => s.key === key)?.label ?? key ?? '';
  const groupLabel = (key: string) => exp.groups.find((g) => g.key === key)?.label ?? key;
  const indLabel = (key: string) => exp.indicators.find((i) => i.key === key)?.label ?? key;
  const colorLabel = (key: string) => exp.colors[key]?.label ?? key;
  const guessLabel = (g: ClassifyGuess) => (g === 'unsure' ? '잘 모르겠다' : groupLabel(g));

  const lines = [`[고른 용액] ${state.selected ? solLabel(state.selected) : '(없음)'}`, '[용액별 관찰]'];
  let any = false;
  // 학생이 한 활동(예측·시험·분류)만 적는다. 용액의 산성·염기성 정답은 쓰지 않는다.
  for (const s of exp.solutions) {
    const guess = state.predictions[s.key];
    const tests = state.tests[s.key] ?? [];
    const placed = state.placement[s.key] ?? null;
    if (!guess && tests.length === 0 && placed === null && state.selected !== s.key) continue;
    any = true;
    const parts = [
      `예측 ${guess ? guessLabel(guess) : '없음'}`,
      tests.length > 0
        ? `시험 ${tests.map((t) => `${indLabel(t.indicator)} → ${colorLabel(t.color)}`).join(', ')}`
        : '시험 없음',
      `넣은 무리 ${placed ? groupLabel(placed) : '없음'}`,
    ];
    lines.push(`- ${s.label}: ${parts.join(JOIN)}`);
  }
  if (!any) lines.push('(아직 없음)');
  if (state.check) {
    lines.push(
      `[확인 결과] ${state.check.items.map((i) => `${solLabel(i.solution)} ${STATUS_NAME[i.status] ?? i.status}`).join(JOIN)}`,
    );
  }
  return lines;
}

const SORT_STATUS_NAME: Record<string, string> = {
  ok: '문제 없음',
  unobserved: '아직 살펴보지 않음',
  inconsistent: '다시 비교 필요',
  unplaced: '무리에 안 넣음',
};

function orderBody(exp: CardSortExperiment, state: Extract<TutorState, { kind: 'card-sort' }>): string[] {
  const order = state.order!;
  const cardLabel = (key: string | null | undefined) => exp.cards.find((c) => c.key === key)?.label ?? key ?? '';
  const featureLabel = (key: string) => exp.features.find((f) => f.key === key)?.label ?? key;
  const groupLabel = (key: string) => exp.followUp?.groups.find((g) => g.value === key)?.label ?? key;
  const lines = [
    `[쌓인 차례(먼저 → 나중)] ${order.slots.map((k, i) => `${i + 1}번째 ${k ? cardLabel(k) : '(비어 있음)'}`).join(JOIN)}`,
    `[고른 카드] ${state.selected ? cardLabel(state.selected) : '(없음)'}`,
    '[카드별 기록]',
  ];
  // 학생이 한 활동(관찰·놓기)만 적는다. 카드의 특징값(높이 등)이나 알맞은 칸·무리는 쓰지 않는다.
  let any = false;
  for (const c of exp.cards) {
    const seen = state.observed[c.key] ?? [];
    const placed = order.followUp.placement[c.key] ?? null;
    if (seen.length === 0 && placed === null && state.selected !== c.key) continue;
    any = true;
    lines.push(
      `- ${c.label}: ${seen.length > 0 ? `관찰 ${seen.map(featureLabel).join(', ')}` : '관찰 없음'}${placed ? `${JOIN}넣은 무리 ${groupLabel(placed)}` : ''}`,
    );
  }
  if (!any) lines.push('(아직 없음)');
  if (state.check) {
    lines.push(
      `[순서 확인 결과] ${state.check.items.map((i) => `${cardLabel(i.card)} ${SORT_STATUS_NAME[i.status] ?? i.status}`).join(JOIN)}`,
    );
  }
  if (order.followUp.check) {
    lines.push(
      `[무리 확인 결과] ${order.followUp.check.items.map((i) => `${cardLabel(i.card)} ${SORT_STATUS_NAME[i.status] ?? i.status}`).join(JOIN)}`,
    );
  }
  return lines;
}

function cardSortBody(exp: CardSortExperiment, state: Extract<TutorState, { kind: 'card-sort' }>): string[] {
  if (state.order) return orderBody(exp, state);
  const cardLabel = (key: string | null | undefined) => exp.cards.find((c) => c.key === key)?.label ?? key ?? '';
  const crit = exp.criteria.find((c) => c.key === state.criterion);
  const featureLabel = (key: string) => exp.features.find((f) => f.key === key)?.label ?? key;
  const groupLabel = (key: string) => crit?.groups.find((g) => g.value === key)?.label ?? key;
  const lines = [
    ...(state.tree
      ? [`[지금 나누는 무리] ${state.tree.nodeCards.map(cardLabel).join(', ')}`, `[나눈 횟수] ${state.tree.splits}`]
      : []),
    `[분류 기준] ${crit ? crit.label : '(고르지 않음)'}`,
    `[고른 카드] ${state.selected ? cardLabel(state.selected) : '(없음)'}`,
    '[카드별 기록]',
  ];
  // 학생이 한 활동(관찰·분류)만 적는다. 카드의 특징값이나 알맞은 무리는 쓰지 않는다.
  let any = false;
  for (const c of exp.cards) {
    const seen = state.observed[c.key] ?? [];
    const placed = state.placement[c.key] ?? null;
    if (seen.length === 0 && placed === null && state.selected !== c.key) continue;
    any = true;
    lines.push(
      `- ${c.label}: ${seen.length > 0 ? `관찰 ${seen.map(featureLabel).join(', ')}` : '관찰 없음'}${JOIN}넣은 무리 ${placed ? groupLabel(placed) : '없음'}`,
    );
  }
  if (!any) lines.push('(아직 없음)');
  const done = state.completed.map((k) => exp.criteria.find((c) => c.key === k)?.label ?? k);
  lines.push(`[끝낸 기준] ${done.length > 0 ? done.join(', ') : '(없음)'}`);
  if (state.check) {
    lines.push(
      `[확인 결과] ${state.check.items.map((i) => `${cardLabel(i.card)} ${SORT_STATUS_NAME[i.status] ?? i.status}`).join(JOIN)}`,
    );
  }
  return lines;
}

function taskOf(exp: ObservationExperiment, id: string): ObservationTask {
  return exp.tasks.find((t) => t.id === id) ?? exp.tasks[0]!;
}

function observeBody(exp: ObservationExperiment, state: Extract<TutorState, { kind: 'observe' }>): string[] {
  const task = taskOf(exp, state.taskId);
  const optLabel = (v: string | null) => (v === null ? null : optionLabel(task.options, v));
  const lines = [`[과제] ${task.title}`, `[과제 질문] ${task.question}`];
  lines.push(`[예측] ${optLabel(state.prediction) ?? '(아직 고르지 않음)'}`);
  const controls = (task.controls ?? []).map(
    (c) => `${c.label} ${optionLabel(c.options, state.controls[c.key] ?? c.default)}`,
  );
  if (controls.length > 0) lines.push(`[조건] ${controls.join(JOIN)}`);
  lines.push(`[관찰 기록] ${optLabel(state.recorded) ?? '(아직 기록하지 않음)'}`);
  if (state.matchesModel !== null) {
    lines.push(`[관찰 화면과 비교] ${state.matchesModel ? '기록이 관찰 화면과 같음' : '기록이 관찰 화면과 다름'}`);
  }
  return lines;
}

/**
 * 튜터 모델 입력 문장. 결정적이다(같은 입력이면 같은 문자열). 학습과 추론이 모두 이 함수를 쓴다(T1).
 * unit을 주지 않으면 단원 줄에 unitId를 쓴다.
 */
export function buildTutorInput(
  experiment: Experiment,
  state: TutorState,
  utterance?: string,
  unit?: UnitInfo,
): string {
  const lines = [
    `[단원] ${unit ? `${unit.title} (${unit.grade}학년)` : state.unitId}`,
    `[탐구 질문] ${experiment.question}`,
    `[상황] ${situationOf(state, experiment)}`,
  ];
  if (state.kind === 'variable') lines.push(...variableBody(variableExp(experiment), state));
  else if (state.kind === 'classify') lines.push(...classifyBody(classifyExp(experiment), state));
  else if (state.kind === 'card-sort') lines.push(...cardSortBody(cardSortExp(experiment), state));
  else lines.push(...observeBody(observeExp(experiment), state));
  const said = utterance?.trim();
  lines.push(`[학생] ${said ? said : '(말하지 않음)'}`);
  return lines.join('\n');
}

export const TUTOR_SYSTEM = [
  '너는 초등학교 과학 실험을 돕는 탐구 안내 선생님이다. 학생의 실험 상태와 말을 보고, 학생이 스스로 생각하도록 돕는 탐침 질문만 한다.',
  '규칙:',
  '1. 한국어로 1~2문장만 쓰고, 반드시 질문으로 끝낸다. 120자를 넘기지 않는다.',
  '2. 정답, 결론, 보고서 문장을 말하지 않는다. 맞았는지 틀렸는지 판정하지 않는다.',
  '3. 학생이 배우지 않은 어려운 용어를 쓰지 않는다. 입력에 나온 낱말을 쓴다.',
  '4. 학생의 조건, 결과표, 예측에 나온 구체적인 내용을 짚어서 묻는다.',
  '5. 실험과 관계없는 요청, 숙제 대신하기, 개인정보, 욕설에는 답하지 않고 지금 하는 실험으로 돌아오는 질문을 한다.',
].join('\n');

// ---- 어댑터: 앱 상태 -> TutorState ----

interface RuntimeTrialLike {
  index: number;
  values: Record<string, TutorValue>;
  ivKey: string | null;
  prediction: Prediction | null;
  result: unknown;
  analysis: { kind: AnalysisKind; changed: string[] };
}

/** @sci/runtime의 RuntimeState가 그대로 들어맞는다. */
export interface RuntimeStateLike {
  values: Record<string, TutorValue>;
  ivKey: string | null;
  prediction: Prediction | null;
  trials: RuntimeTrialLike[];
  playing: boolean;
}

/** 앱 모듈(ExperimentModule)에서 어댑터가 쓰는 부분. */
export interface VariableModuleLike {
  metric: { resultKey: PropertyKey; sameThreshold(exp: VariableExperiment): number };
}

function primitiveResult(result: unknown): TutorResult {
  const out: TutorResult = {};
  if (result && typeof result === 'object') {
    for (const [k, v] of Object.entries(result)) {
      // 값이 없는(NaN) 결과는 담지 않는다(JSON에서 null이 되어 "null mm"로 읽히지 않게). 예: 초점이 맞지 않아 칸이 보이지 않는 현미경 관찰.
      if ((typeof v === 'number' && !Number.isNaN(v)) || typeof v === 'string' || typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

/** 앱처럼 재생 중인 시행은 아직 보이지 않으므로 뺀다. 최근 3개를 담는다. */
export function fromVariableRuntime(
  experiment: VariableExperiment,
  runtimeState: RuntimeStateLike,
  module: VariableModuleLike,
  unitId: string,
): Extract<TutorState, { kind: 'variable' }> {
  const shown = runtimeState.playing ? runtimeState.trials.slice(0, -1) : runtimeState.trials;
  const key = module.metric.resultKey as string;
  const metricOf = (t: RuntimeTrialLike) => Number((t.result as Record<string, unknown>)[key]);
  const threshold = module.metric.sameThreshold(experiment);
  const trials: TutorTrial[] = shown.map((t, i) => {
    const prev = shown[i - 1];
    const observed =
      prev && t.analysis.kind === 'fair-test' ? observedOutcome(metricOf(prev), metricOf(t), threshold) : null;
    return {
      index: t.index,
      values: { ...t.values },
      ivKey: t.ivKey,
      prediction: t.prediction,
      result: primitiveResult(t.result),
      analysis: { kind: t.analysis.kind, changed: [...t.analysis.changed] },
      observed,
    };
  });
  return {
    kind: 'variable',
    unitId,
    experimentId: experiment.id,
    current: { values: { ...runtimeState.values }, ivKey: runtimeState.ivKey, prediction: runtimeState.prediction },
    trials: trials.slice(-MAX_TRIALS),
  };
}

/** ClassifyState(앱 저장소)가 그대로 들어맞는다. */
export interface ClassifyStateLike {
  selected: string | null;
  predictions: Record<string, ClassifyGuess | undefined>;
  tests: Record<string, string[] | undefined>;
  placement: Record<string, string | null | undefined>;
  checked: { kind: string; items: { solution: string; status: string }[] } | null;
}

export function fromClassifyState(
  experiment: ClassificationExperiment,
  classifyState: ClassifyStateLike,
  unitId: string,
): Extract<TutorState, { kind: 'classify' }> {
  const predictions: Record<string, ClassifyGuess> = {};
  const tests: Record<string, { indicator: string; color: string }[]> = {};
  const placement: Record<string, string | null> = {};
  for (const s of experiment.solutions) {
    const p = classifyState.predictions[s.key];
    if (p) predictions[s.key] = p;
    const tested = classifyState.tests[s.key] ?? [];
    if (tested.length > 0) {
      tests[s.key] = tested.map((indicator) => ({ indicator, color: indicatorColor(experiment, s.key, indicator) }));
    }
    const placed = classifyState.placement[s.key];
    if (placed !== undefined) placement[s.key] = placed;
  }
  return {
    kind: 'classify',
    unitId,
    experimentId: experiment.id,
    selected: classifyState.selected,
    predictions,
    tests,
    placement,
    check: classifyState.checked
      ? {
          kind: classifyState.checked.kind,
          items: classifyState.checked.items.map((i) => ({ solution: i.solution, status: i.status })),
        }
      : null,
  };
}

/** ObserveState(앱 저장소)가 그대로 들어맞는다. */
export interface ObserveStateLike {
  selected: string;
  tasks: Record<
    string,
    | {
        prediction: TutorValue | null;
        controls: Record<string, TutorValue>;
        recorded: { value: TutorValue; controls: Record<string, TutorValue> } | null;
      }
    | undefined
  >;
}

export function fromObserveState(
  experiment: ObservationExperiment,
  observeState: ObserveStateLike,
  unitId: string,
): Extract<TutorState, { kind: 'observe' }> {
  const task = taskOf(experiment, observeState.selected);
  const ts = observeState.tasks[task.id];
  const str = (v: TutorValue | null | undefined) => (v === null || v === undefined ? null : String(v));
  const controls: Record<string, string> = {};
  for (const [k, v] of Object.entries(ts?.controls ?? {})) controls[k] = String(v);
  return {
    kind: 'observe',
    unitId,
    experimentId: experiment.id,
    taskId: task.id,
    prediction: str(ts?.prediction),
    recorded: str(ts?.recorded?.value),
    controls,
    matchesModel: ts?.recorded ? ts.recorded.value === modelAnswer(experiment, task, ts.recorded.controls) : null,
  };
}

/** CardSortState(앱 저장소)가 그대로 들어맞는다. */
export interface CardSortStateLike {
  selected: string | null;
  criterion: string | null;
  observed: Record<string, string[]>;
  placement: Record<string, string | null>;
  completed: string[];
  checked: { kind: string; items: { card: string; status: string }[] } | null;
}

export function fromCardSortState(
  experiment: CardSortExperiment,
  sortState: CardSortStateLike,
  unitId: string,
): Extract<TutorState, { kind: 'card-sort' }> {
  const observed: Record<string, string[]> = {};
  const placement: Record<string, string | null> = {};
  for (const c of experiment.cards) {
    const seen = sortState.observed[c.key] ?? [];
    if (seen.length > 0) observed[c.key] = [...seen];
    const placed = sortState.placement[c.key];
    if (placed !== undefined) placement[c.key] = placed;
  }
  return {
    kind: 'card-sort',
    unitId,
    experimentId: experiment.id,
    selected: sortState.selected,
    criterion: sortState.criterion,
    observed,
    placement,
    completed: [...sortState.completed],
    check: sortState.checked
      ? { kind: sortState.checked.kind, items: sortState.checked.items.map((i) => ({ card: i.card, status: i.status })) }
      : null,
  };
}

/** 트리 상태(앱 저장소). 지금 나누는 노드를 카드 분류 상태 모양으로 옮긴다. */
export interface TreeStateLike extends Pick<TreeState, 'nodes' | 'root' | 'observed' | 'selectedNode'> {
  selected: string | null;
}

export function fromTreeState(
  experiment: CardSortExperiment,
  treeState: TreeStateLike,
  unitId: string,
): Extract<TutorState, { kind: 'card-sort' }> {
  const node = treeState.nodes[treeState.selectedNode] ?? treeState.nodes[treeState.root]!;
  const base = fromCardSortState(
    experiment,
    {
      selected: treeState.selected,
      criterion: node.criterion,
      observed: treeState.observed,
      placement: node.placement,
      completed: [],
      checked: node.checked,
    },
    unitId,
  );
  return {
    ...base,
    tree: {
      finished: isTreeFinished(treeState, experiment),
      splitEmpty: isEmptySplit(treeState, node.id),
      splits: splitCount(treeState),
      nodeCards: [...node.cards],
    },
  };
}

/** 순서 놓기 상태(앱 저장소). 칸에 놓은 카드와 followUp을 카드 분류 상태 모양으로 옮긴다. */
export interface OrderStateLike extends Pick<OrderState, 'slots' | 'observed' | 'checked' | 'followUp'> {
  selected: string | null;
}

export function fromOrderState(
  experiment: CardSortExperiment,
  orderState: OrderStateLike,
  unitId: string,
): Extract<TutorState, { kind: 'card-sort' }> {
  const base = fromCardSortState(
    experiment,
    {
      selected: orderState.selected,
      criterion: null,
      observed: orderState.observed,
      placement: {},
      completed: [],
      checked: orderState.checked,
    },
    unitId,
  );
  const placement: Record<string, string | null> = {};
  for (const c of experiment.cards) {
    const placed = orderState.followUp.placement[c.key];
    if (placed !== undefined) placement[c.key] = placed;
  }
  const fc = orderState.followUp.checked;
  return {
    ...base,
    order: {
      slots: [...orderState.slots],
      finished: isOrderFinished(orderState, experiment),
      followUp: {
        placement,
        check: fc ? { kind: fc.kind, items: fc.items.map((i) => ({ card: i.card, status: i.status })) } : null,
      },
    },
  };
}

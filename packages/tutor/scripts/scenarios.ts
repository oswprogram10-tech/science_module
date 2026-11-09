/**
 * 튜터 단원(TUTOR_UNITS)의 튜터 시나리오 라이브러리를 시뮬레이션으로 만든다(결정적).
 * 변인 실험은 앱의 모듈 시뮬레이션과 런타임으로, 분류·카드 분류·관찰 활동은 앱의 저장소 함수(와 @sci/cardsort)로 상태를 만든다.
 * 규칙을 바꾸면 시나리오 번호(생성 순서)가 바뀐다. 데이터가 쌓인 뒤에는 새 시나리오를 뒤에 덧붙이는 식으로만 늘린다.
 */
import { truthGroup } from '@sci/engine-matter';
import { modelAnswer } from '../src/observeModel';
import { PREDICTION_LABEL, analyzeTrial, observedOutcome, type Prediction } from '@sci/gateway';
import { createRuntime } from '@sci/runtime';
import {
  isCardSortExperiment,
  isClassificationExperiment,
  isObservationExperiment,
  isPortfolioExperiment,
  type CardSortExperiment,
  type ClassificationExperiment,
  type Experiment,
  type ObservationExperiment,
  type VariableExperiment,
} from '@sci/schema';
import {
  check,
  confirmSafety,
  createInitialState,
  place,
  predict,
  select,
  testIndicator,
  type ClassifyState,
} from '../../../apps/student/src/modules/indicator-classify/classifyStore';
import { MODULES } from '../../../apps/student/src/modules';
import * as sortStore from '../../../apps/student/src/modules/card-sort/cardSortStore';
import * as treeStore from '../../../apps/student/src/modules/card-sort/treeStore';
import * as orderStore from '../../../apps/student/src/modules/card-sort/orderStore';
import { NORTH_HOUR_MAX, NORTH_HOUR_MIN } from '../../../apps/student/src/modules/sky-observation/nightModel';
import * as obsStore from '../../../apps/student/src/modules/sky-observation/observeStore';
import { isNodeHomogeneous, availableCriteria, treeLeaves, type TreeSide } from '@sci/cardsort';
import {
  fromCardSortState,
  fromClassifyState,
  fromObserveState,
  fromOrderState,
  fromTreeState,
  fromVariableRuntime,
  situationOf,
  type TutorState,
} from '../src/context';
import type { Scenario, UnitData } from '../src/dataset';

type Draft = { title: string; state: TutorState };

// ---- 변인 실험 ----

type Values = Record<string, string | number>;
interface Step {
  /** 앞 시행에서 바꿀 값. */
  change: Values;
  iv: string;
  /** match/mismatch는 실제 시뮬레이션 결과와 같거나 다른 예측으로 자동으로 고른다. */
  pred: Prediction | 'match' | 'mismatch';
}

function genVariable(unitId: string, exp: VariableExperiment): Draft[] {
  const mod = MODULES[exp.module]!;
  const vars = exp.variables;
  // 변인이 4개보다 적은 단원은 처음부터 다시 돌아가며 쓴다(4개 단원은 예전 규칙과 같다).
  const V = (i: number) => vars[i % vars.length]!;
  /** i번째부터 돌아가며 avoid에 없는 변인의 key(모두 겹치면 V(i)). */
  const notKey = (i: number, avoid: string[]): string => {
    for (let j = 0; j < vars.length; j++) {
      const key = V(i + j).key;
      if (!avoid.includes(key)) return key;
    }
    return V(i).key;
  };
  const labelOf = (key: string) => vars.find((v) => v.key === key)?.label ?? key;
  const optLabel = (key: string, value: string | number | undefined) =>
    vars.find((v) => v.key === key)?.options.find((o) => o.value === value)?.label ?? String(value);
  const labels = Object.fromEntries(vars.map((v) => [v.key, v.label]));
  const metricOf = (values: Values) => Number((mod.simulate(values, exp).result as Record<string, unknown>)[mod.metric.resultKey as string]);
  const threshold = mod.metric.sameThreshold(exp);

  /** seed마다 다른 출발 조건(seed 0은 기본값). */
  const base = (seed: number): Values =>
    Object.fromEntries(
      vars.map((v, k) => [v.key, seed === 0 ? v.default : v.options[(seed + k) % v.options.length]!.value]),
    );
  /** 현재 값과 다른 선택지(k로 어느 쪽인지 정한다). */
  const other = (key: string, cur: string | number, k: number): string | number => {
    const v = vars.find((x) => x.key === key)!;
    const i = v.options.findIndex((o) => o.value === cur);
    return v.options[(i + 1 + (k % (v.options.length - 1))) % v.options.length]!.value;
  };

  const start = (values: Values) => createRuntime({ defaults: values });
  const exec = (rt: ReturnType<typeof start>, values: Values, step: Step) => {
    for (const [k, v] of Object.entries(values)) rt.setValue(k, v);
    rt.setIV(step.iv);
    let pred: Prediction;
    if (step.pred === 'match' || step.pred === 'mismatch') {
      const prev = rt.getSnapshot().trials.at(-1);
      const real: Prediction = prev
        ? observedOutcome(Number((prev.result as Record<string, unknown>)[mod.metric.resultKey as string]), metricOf(values), threshold)
        : 'increase';
      pred = step.pred === 'match' ? real : real === 'increase' ? 'decrease' : 'increase';
    } else pred = step.pred;
    rt.setPrediction(pred);
    rt.run(
      (v) => mod.simulate(v, exp),
      (prev, cur) => analyzeTrial(prev, cur, labels),
    );
    rt.tick(1e9); // 재생을 끝낸다.
  };
  /** 출발 조건으로 첫 시행을 하고, steps를 차례로 적용한 상태. */
  const chain = (seed: number, firstIv: string, firstPred: Prediction, steps: Step[]): TutorState => {
    const values = base(seed);
    const rt = start(values);
    exec(rt, values, { change: {}, iv: firstIv, pred: firstPred });
    let cur = { ...values };
    for (const s of steps) {
      cur = { ...cur, ...s.change };
      exec(rt, cur, s);
    }
    return fromVariableRuntime(exp, rt.getSnapshot(), mod, unitId);
  };
  const beforeRun = (iv: string | null, pred: Prediction | null): TutorState => {
    const rt = start(base(0));
    if (iv) rt.setIV(iv);
    if (pred) rt.setPrediction(pred);
    return fromVariableRuntime(exp, rt.getSnapshot(), mod, unitId);
  };

  const describe = (state: Extract<TutorState, { kind: 'variable' }>): string => {
    const last = state.trials.at(-1);
    if (!last) {
      const iv = state.current.ivKey ? labelOf(state.current.ivKey) : '아직 안 고름';
      const pred = state.current.prediction ? `, 예측: ${PREDICTION_LABEL[state.current.prediction]}` : '';
      return `실행 전(바꿀 조건: ${iv}${pred})`;
    }
    const prev = state.trials.at(-2);
    const iv = last.ivKey ? labelOf(last.ivKey) : '없음';
    const pred = last.prediction ? PREDICTION_LABEL[last.prediction] : '없음';
    const changed = last.analysis.changed
      .map((k) => `${labelOf(k)} ${optLabel(k, prev?.values[k])}→${optLabel(k, last.values[k])}`)
      .join(', ');
    switch (last.analysis.kind) {
      case 'first-trial':
        return `첫 시행: ${vars.map((v) => optLabel(v.key, last.values[v.key])).join(' · ')}(바꿀 조건: ${iv}, 예측: ${pred})`;
      case 'repeat':
        return `앞 시행과 같은 조건으로 다시 실행(바꿀 조건: ${iv})`;
      case 'confounded':
        return `${changed} 함께 변경(바꿀 조건: ${iv})`;
      case 'iv-unchanged':
        return `바꿀 조건은 ${iv}인데 ${changed} 변경`;
      default: {
        const lead = last.ivKey !== vars[0]!.key ? `${optLabel(vars[0]!.key, last.values[vars[0]!.key])}, ` : '';
        const diff1 = last.analysis.changed.map((k) => `${optLabel(k, prev?.values[k])}→${optLabel(k, last.values[k])}`).join(', ');
        const diff = last.observed && last.prediction && last.observed !== last.prediction ? ' · 결과가 예측과 다름' : '';
        return `${lead}${iv}만 ${diff1} 변경(예측: ${pred}${diff})`;
      }
    }
  };

  const out: Draft[] = [];
  const add = (state: TutorState) => {
    if (state.kind === 'variable') out.push({ title: describe(state), state });
  };

  // before-run
  add(beforeRun(null, null));
  add(beforeRun(V(0).key, null));
  add(beforeRun(V(2).key, 'increase'));
  add(beforeRun(V(1).key, 'decrease'));
  // first-trial
  add(chain(0, V(0).key, 'increase', []));
  add(chain(1, V(2).key, 'decrease', []));
  // confounded (조건 2~3개를 함께 바꿈)
  const b0 = base(0);
  const b1 = base(1);
  const b2 = base(2);
  add(chain(0, V(1).key, 'increase', [{ change: { [V(1).key]: other(V(1).key, b0[V(1).key]!, 0), [V(2).key]: other(V(2).key, b0[V(2).key]!, 0) }, iv: V(1).key, pred: 'increase' }]));
  add(chain(1, V(0).key, 'decrease', [{ change: { [V(0).key]: other(V(0).key, b1[V(0).key]!, 0), [notKey(3, [V(0).key])]: other(notKey(3, [V(0).key]), b1[notKey(3, [V(0).key])]!, 0) }, iv: V(0).key, pred: 'increase' }]));
  add(chain(2, V(2).key, 'increase', [{ change: { [V(2).key]: other(V(2).key, b2[V(2).key]!, 0), [V(1).key]: other(V(1).key, b2[V(1).key]!, 0), [V(3).key]: other(V(3).key, b2[V(3).key]!, 0) }, iv: V(2).key, pred: 'increase' }]));
  // iv-unchanged (고른 변인은 그대로, 다른 조건이 바뀜)
  add(chain(0, V(0).key, 'increase', [{ change: { [notKey(2, [V(0).key])]: other(notKey(2, [V(0).key]), b0[notKey(2, [V(0).key])]!, 1) }, iv: V(0).key, pred: 'increase' }]));
  {
    const iv = V(3).key;
    const k1 = notKey(1, [iv]);
    const k2 = notKey(2, [iv, k1]);
    add(chain(1, iv, 'decrease', [{ change: { [k1]: other(k1, b1[k1]!, 1), [k2]: other(k2, b1[k2]!, 1) }, iv, pred: 'decrease' }]));
  }
  // repeat
  add(chain(0, V(2).key, 'increase', [{ change: {}, iv: V(2).key, pred: 'same' }]));
  add(chain(1, V(1).key, 'decrease', [
    { change: { [V(1).key]: other(V(1).key, b1[V(1).key]!, 0) }, iv: V(1).key, pred: 'match' },
    { change: {}, iv: V(1).key, pred: 'same' },
  ]));
  // fair-test: 조작변인마다 예측이 맞은 경우, 틀린 경우
  for (let i = 0; i < vars.length; i++) {
    const key = V(i).key;
    const b = base(i);
    add(chain(i, key, 'increase', [{ change: { [key]: other(key, b[key]!, 0) }, iv: key, pred: 'match' }]));
  }
  for (let i = 0; i < vars.length; i++) {
    const key = V(i).key;
    const b = base(i + 1);
    add(chain(i + 1, key, 'decrease', [{ change: { [key]: other(key, b[key]!, 1) }, iv: key, pred: 'mismatch' }]));
  }
  // 시행이 3개 쌓인 경우
  {
    const k0 = V(2).key;
    const k1 = V(3).key;
    const b = base(0);
    const v1 = other(k0, b[k0]!, 0);
    const v2 = other(k1, b[k1]!, 0);
    add(chain(0, k0, 'increase', [
      { change: { [k0]: v1 }, iv: k0, pred: 'match' },
      { change: { [k1]: v2 }, iv: k1, pred: 'match' },
    ]));
  }
  return out;
}

// ---- 분류 활동 ----

function genClassify(unitId: string, exp: ClassificationExperiment): Draft[] {
  const solLabel = (key: string | null) => exp.solutions.find((s) => s.key === key)?.label ?? '';
  const indLabel = (key: string) => exp.indicators.find((i) => i.key === key)?.label ?? key;
  const colorLabel = (key: string) => exp.colors[key]?.label ?? key;
  const groupLabel = (key: string) => exp.groups.find((g) => g.key === key)?.label ?? key;

  const fresh = () => confirmSafety(createInitialState());
  type Plan = Array<[solution: string, guess: 'acid' | 'base' | 'unsure', indicators: string[]]>;
  const choose = (s: ClassifyState, solution: string, guess: 'acid' | 'base' | 'unsure' | null, inds: string[]) => {
    let cur = select(s, exp, solution);
    if (guess) cur = predict(cur, exp, solution, guess);
    for (const i of inds) cur = testIndicator(cur, exp, i);
    return cur;
  };
  const run = (plan: Plan, selected?: string) => {
    let s = fresh();
    for (const [sol, guess, inds] of plan) s = choose(s, sol, guess, inds);
    return selected ? select(s, exp, selected) : s;
  };
  /** 모든 용액을 놓는다. wrong에 든 용액은 시험에서 나온 쪽과 반대 무리에 넣는다. */
  const placeAll = (s: ClassifyState, wrong: string[] = []) => {
    let cur = s;
    for (const sol of exp.solutions) {
      const truth = truthGroup(exp, sol.key);
      const g = wrong.includes(sol.key) ? (truth === 'acid' ? 'base' : 'acid') : truth;
      cur = place(cur, exp, sol.key, g);
    }
    return check(cur, exp);
  };
  /** 모든 용액에 주어진 지시약을 모두 시험한다(예측은 일부를 '잘 모르겠다'로). */
  const testAll = (indicators: string[]): Plan =>
    exp.solutions.map((s, i) => [s.key, i % 3 === 0 ? 'unsure' : truthGroup(exp, s.key), indicators]);

  const out: Draft[] = [];
  const add = (s: ClassifyState) => {
    const state = fromClassifyState(exp, s, unitId);
    const parts: string[] = [state.selected ? `${solLabel(state.selected)} 선택` : '용액을 고르지 않음'];
    const sel = state.selected;
    if (sel && state.predictions[sel]) parts.push(`예측: ${state.predictions[sel] === 'unsure' ? '잘 모르겠다' : groupLabel(state.predictions[sel]!)}`);
    const tested = sel ? (state.tests[sel] ?? []) : [];
    parts.push(tested.length > 0 ? `시험: ${tested.map((t) => `${indLabel(t.indicator)}→${colorLabel(t.color)}`).join(', ')}` : '아직 시험 전');
    if (state.check) {
      const n = (st: string[]) => state.check!.items.filter((i) => st.includes(i.status)).length;
      parts.push(
        state.check.kind === 'check-inconsistent'
          ? `확인 결과: 다시 비교 필요 ${n(['inconsistent'])}개`
          : state.check.kind === 'check-untested'
            ? `확인 결과: 시험 안 함·단서 부족 ${n(['untested', 'undetermined'])}개`
            : '확인 결과: 모두 관찰과 맞음',
      );
    }
    out.push({ title: parts.join(', '), state });
  };

  // before-test
  add(run([['lemon', 'acid', []]]));
  add(run([['soap', 'unsure', []]]));
  add(run([['naoh', 'base', []]]));
  add(run([['lemon', 'acid', ['blueLitmus']], ['vinegar', 'acid', []]]));
  add(select(fresh(), exp, 'soda'));
  // testing
  add(run([['lemon', 'acid', ['blueLitmus']]]));
  add(run([['soap', 'base', ['phenol']]]));
  add(run([['vinegar', 'unsure', ['cabbage']]]));
  add(run([['cleaner', 'base', ['redLitmus', 'phenol']]]));
  add(run([['lemon', 'acid', ['phenol']]]));
  // prediction-mismatch
  add(run([['lemon', 'base', ['blueLitmus']]]));
  add(run([['soap', 'acid', ['redLitmus']]]));
  add(run([['soda', 'base', ['cabbage']]]));
  // check-untested: 모두 넣었지만 시험이 부족함
  add(placeAll(run([['lemon', 'acid', ['blueLitmus']], ['soap', 'base', ['phenol']]], 'soap')));
  add(placeAll(run([['hcl', 'acid', ['cabbage']], ['vinegar', 'unsure', ['phenol']], ['limewater', 'base', ['redLitmus']]], 'vinegar')));
  add(placeAll(run(testAll(['cabbage']).slice(0, 6), 'lemon')));
  // check-inconsistent: 시험 결과와 다른 무리에 넣음
  add(placeAll(run(testAll(['cabbage']), 'lemon'), ['lemon']));
  add(placeAll(run(testAll(['cabbage', 'redLitmus']), 'soap'), ['soap', 'vinegar']));
  add(placeAll(run(testAll(['blueLitmus', 'cabbage', 'redLitmus']), 'cleaner'), ['cleaner']));
  // check-complete
  add(placeAll(run(testAll(['cabbage']), 'naoh')));
  add(placeAll(run(testAll(['cabbage', 'phenol']), 'vinegar')));
  add(placeAll(run(testAll(['redLitmus', 'blueLitmus', 'cabbage']), 'limewater')));
  return out;
}

// ---- 카드 분류 활동 ----

const CHECK_LABEL: Record<string, string> = {
  'check-subjective': '주관적 기준이라 확인 불가',
  'check-unplaced': '넣지 않은 카드 있음',
  'check-unobserved': '살펴보지 않은 카드 있음',
  'check-inconsistent': '관찰과 다른 무리에 넣은 카드 있음',
  'check-complete': '확인 통과',
};

const ORDER_CHECK_LABEL: Record<string, string> = {
  'check-unplaced': '빈 칸 있음',
  'check-unobserved': '높이를 안 본 카드 있음',
  'check-inconsistent': '높이 순서와 어긋난 카드 있음',
};

/** 카드 분류 상태의 한 줄 설명(카드·기준 이름만 쓴다). */
function describeSort(exp: CardSortExperiment, state: Extract<TutorState, { kind: 'card-sort' }>): string {
  const cardLabel = (k: string | null) => exp.cards.find((c) => c.key === k)?.label ?? '';
  const parts: string[] = [];
  if (state.order) {
    const filled = state.order.slots.filter((k) => k !== null).length;
    parts.push(`칸 ${filled}/${state.order.slots.length}개 채움`);
  } else {
    if (state.tree) parts.push(`지금 나누는 무리 ${state.tree.nodeCards.length}장(나눈 횟수 ${state.tree.splits})`);
    const crit = exp.criteria.find((c) => c.key === state.criterion);
    parts.push(crit ? `기준 ${crit.label}` : '기준 안 고름');
  }
  parts.push(state.selected ? `${cardLabel(state.selected)} 선택` : '카드를 고르지 않음');
  const observed = Object.values(state.observed).filter((v) => v.length > 0).length;
  parts.push(observed > 0 ? `${observed}장 관찰` : '관찰 전');
  const placed = state.order
    ? Object.values(state.order.followUp.placement).filter((v) => v !== null).length
    : Object.values(state.placement).filter((v) => v !== null).length;
  if (placed > 0) parts.push(`${placed}장 넣음`);
  if (state.completed.length > 0) parts.push(`끝낸 기준 ${state.completed.length}개`);
  if (state.order) {
    if (state.check) {
      const label = state.check.kind === 'check-complete' ? '통과' : (ORDER_CHECK_LABEL[state.check.kind] ?? state.check.kind);
      parts.push(`순서 확인: ${label}`);
    }
    const fc = state.order.followUp.check;
    if (fc) parts.push(`무리 확인: ${CHECK_LABEL[fc.kind] ?? fc.kind}`);
  } else if (state.check) parts.push(`확인: ${CHECK_LABEL[state.check.kind] ?? state.check.kind}`);
  if (state.tree?.splitEmpty) parts.push('한쪽이 빈 채로 나눔');
  return parts.join(', ');
}

function genCardSort(unitId: string, exp: CardSortExperiment): Draft[] {
  if (exp.layout === 'order') return genOrder(unitId, exp);
  if (exp.layout === 'tree') return genTree(unitId, exp);
  return genGroups(unitId, exp);
}

const keysOf = (exp: CardSortExperiment) => exp.cards.map((c) => c.key);
const truthOf = (exp: CardSortExperiment, card: string, feature: string) =>
  String(exp.cards.find((c) => c.key === card)!.features[feature]);

function genGroups(unitId: string, exp: CardSortExperiment): Draft[] {
  const objective = exp.criteria.filter((c) => c.objective);
  const subjective = exp.criteria.filter((c) => !c.objective);
  const O = (i: number) => objective[i % objective.length]!;
  const cards = keysOf(exp);
  const C = (i: number) => cards[((i % cards.length) + cards.length) % cards.length]!;

  const fresh = () => sortStore.createInitialState();
  const watch = (s: sortStore.CardSortState, critKey: string, list: string[]) => {
    const feature = exp.criteria.find((c) => c.key === critKey)?.feature;
    let cur = s;
    if (feature) for (const k of list) cur = sortStore.observe(cur, exp, k, feature);
    return cur;
  };
  const withCrit = (key: string, s = fresh()) => sortStore.chooseCriterion(s, exp, key);
  /** 모든 카드를 넣는다. wrong에 든 카드는 특징값과 다른 무리에 넣는다(주관적 기준은 번갈아). */
  const placeAll = (s: sortStore.CardSortState, wrong: string[] = []) => {
    const crit = exp.criteria.find((c) => c.key === s.criterion)!;
    let cur = s;
    cards.forEach((k, i) => {
      let g: string;
      if (!crit.feature) g = crit.groups[i % crit.groups.length]!.value;
      else {
        const truth = truthOf(exp, k, crit.feature);
        g = wrong.includes(k) ? crit.groups.find((x) => x.value !== truth)!.value : truth;
      }
      cur = sortStore.place(cur, exp, k, g);
    });
    return cur;
  };
  /** 기준 하나를 관찰하고 맞게 넣어 확인까지 끝낸다. */
  const complete = (s: sortStore.CardSortState, key: string) =>
    sortStore.check(placeAll(watch(withCrit(key, s), key, cards)), exp);

  const out: Draft[] = [];
  const add = (s: sortStore.CardSortState) => {
    const state = fromCardSortState(exp, { ...s, checked: s.checked }, unitId);
    out.push({ title: describeSort(exp, state), state });
  };

  // choose-criterion
  add(fresh());
  add(sortStore.select(fresh(), exp, C(2)));
  // pick-card
  add(withCrit(O(0).key));
  add(withCrit(O(1).key));
  if (subjective[0]) add(withCrit(subjective[0].key));
  // before-observe
  add(sortStore.select(withCrit(O(0).key), exp, C(1)));
  add(sortStore.select(withCrit(O(1).key), exp, C(4)));
  // sorting
  add(sortStore.select(watch(withCrit(O(0).key), O(0).key, [C(1)]), exp, C(1)));
  {
    let s = watch(withCrit(O(1).key), O(1).key, [C(0), C(3), C(5)]);
    for (const k of [C(0), C(3)]) s = sortStore.place(s, exp, k, truthOf(exp, k, O(1).feature!));
    add(sortStore.select(s, exp, C(5)));
  }
  if (subjective[0]) add(sortStore.select(withCrit(subjective[0].key), exp, C(2)));
  {
    // 관찰에 맞지 않게 넣어 둔 카드가 있는 채로 계속 분류 중
    let s = watch(withCrit(O(2).key), O(2).key, [C(2), C(7)]);
    const crit = O(2);
    const bad = crit.groups.find((g) => g.value !== truthOf(exp, C(2), crit.feature!))!.value;
    s = sortStore.place(s, exp, C(2), bad);
    add(sortStore.select(s, exp, C(7)));
  }
  // check-subjective
  if (subjective[0]) {
    add(sortStore.check(placeAll(withCrit(subjective[0].key)), exp));
  }
  // check-unobserved
  add(sortStore.check(placeAll(withCrit(O(0).key)), exp));
  add(sortStore.check(placeAll(watch(withCrit(O(1).key), O(1).key, cards.slice(0, 5))), exp));
  add(sortStore.check(placeAll(watch(withCrit(O(2).key), O(2).key, cards.filter((_, i) => i !== 6))), exp));
  // check-inconsistent
  add(sortStore.check(placeAll(watch(withCrit(O(0).key), O(0).key, cards), [C(1)]), exp));
  add(sortStore.check(placeAll(watch(withCrit(O(1).key), O(1).key, cards), [C(0), C(5)]), exp));
  add(sortStore.check(placeAll(watch(withCrit(O(2).key), O(2).key, cards), [C(2), C(4), C(7)]), exp));
  // check-complete (기준 하나만 끝냄)
  add(complete(fresh(), O(0).key));
  add(complete(fresh(), O(1).key));
  // 하나 끝낸 뒤 다음 기준을 고름
  add(withCrit(O(1).key, complete(fresh(), O(0).key)));
  // finished (객관적 기준 2개 완료)
  add(complete(complete(fresh(), O(0).key), O(1).key));
  add(complete(complete(fresh(), O(1).key), O(2).key));
  add(complete(complete(fresh(), O(2).key), O(0).key));
  return out;
}

function genTree(unitId: string, exp: CardSortExperiment): Draft[] {
  const objective = exp.criteria.filter((c) => c.objective);
  const subjective = exp.criteria.filter((c) => !c.objective);
  const O = (i: number) => objective[i % objective.length]!;
  const cards = keysOf(exp);
  const C = (i: number) => cards[((i % cards.length) + cards.length) % cards.length]!;
  type T = treeStore.TreeLabState;
  const fresh = (): T => treeStore.createInitialTreeState(exp);
  const nodeOf = (s: T, id = s.selectedNode) => s.nodes[id]!;
  const watch = (s: T, list: readonly string[], critKey: string): T => {
    const feature = exp.criteria.find((c) => c.key === critKey)?.feature;
    let cur = s;
    if (feature) for (const k of list) cur = treeStore.observe(cur, exp, k, feature);
    return cur;
  };
  const crit = (s: T, key: string, id = s.selectedNode): T => treeStore.chooseCriterion(s, exp, id, key);
  /** 노드의 카드를 모두 넣는다. wrong에 든 카드는 특징값과 반대쪽에 넣는다. */
  const placeAll = (s: T, wrong: readonly string[] = [], id = s.selectedNode): T => {
    const node = nodeOf(s, id);
    const c = exp.criteria.find((x) => x.key === node.criterion)!;
    let cur = s;
    node.cards.forEach((k, i) => {
      let side: TreeSide;
      if (!c.feature) side = i % 2 === 0 ? 'yes' : 'no';
      else {
        const t = truthOf(exp, k, c.feature) === 'yes' ? 'yes' : 'no';
        side = wrong.includes(k) ? (t === 'yes' ? 'no' : 'yes') : t;
      }
      cur = treeStore.place(cur, exp, id, k, side);
    });
    return cur;
  };
  const check = (s: T, id = s.selectedNode): T => treeStore.checkNode(s, exp, id);
  /** 노드를 기준 하나로 끝까지 나눈다(관찰하고 맞게 넣고 확인). */
  const splitWith = (s: T, key: string, id = s.selectedNode): T => {
    const node = nodeOf(s, id);
    return check(placeAll(watch(crit(s, key, id), node.cards, key), [], id), id);
  };
  /** 노드의 카드를 두 쪽으로 나누는 기준(아직 안 쓴 객관적 기준 중 처음 것). */
  const splitter = (s: T, id: string, skip: readonly string[] = []): string | undefined =>
    availableCriteria(s, exp, id).find((k) => {
      const c = exp.criteria.find((x) => x.key === k)!;
      if (!c.objective || skip.includes(k)) return false;
      const vals = new Set(nodeOf(s, id).cards.map((card) => truthOf(exp, card, c.feature!)));
      return vals.size > 1;
    });
  /** 더 나눌 수 없을 때까지 모든 잎을 나눈다. first는 뿌리를 나누는 기준. */
  const solve = (first: string): T => {
    let s = splitWith(fresh(), first);
    for (let guard = 0; guard < 20; guard++) {
      const open = treeLeaves(s).find((id) => !isNodeHomogeneous(exp, nodeOf(s, id).cards));
      if (!open) break;
      const key = splitter(s, open);
      if (!key) break;
      s = splitWith(treeStore.selectNode(s, open), key, open);
    }
    return s;
  };
  /** 노드 안의 카드가 모두 같은 값인 아직 안 쓴 객관적 기준(한쪽이 비는 나누기). */
  const sameValueCriterion = (s: T, id: string): string | undefined =>
    availableCriteria(s, exp, id).find((k) => {
      const c = exp.criteria.find((x) => x.key === k)!;
      return !!c.objective && isNodeHomogeneous({ ...exp, criteria: [c] }, nodeOf(s, id).cards);
    });

  const out: Draft[] = [];
  const add = (s: T) => {
    const state = fromTreeState(exp, s, unitId);
    out.push({ title: describeSort(exp, state), state });
  };

  const rootSplit = splitWith(fresh(), O(0).key);
  const kids = nodeOf(rootSplit).children!;

  // choose-criterion
  add(fresh());
  add(treeStore.selectCard(fresh(), exp, C(3)));
  add(treeStore.selectNode(rootSplit, kids.yes));
  add(treeStore.selectNode(rootSplit, kids.no));
  // pick-card
  add(crit(fresh(), O(0).key));
  if (subjective[0]) add(crit(fresh(), subjective[0].key));
  add(crit(treeStore.selectNode(rootSplit, kids.yes), splitter(rootSplit, kids.yes)!, kids.yes));
  // before-observe
  add(treeStore.selectCard(crit(fresh(), O(0).key), exp, C(1)));
  // sorting
  add(treeStore.selectCard(watch(crit(fresh(), O(0).key), [C(1)], O(0).key), exp, C(1)));
  {
    let s = watch(crit(fresh(), O(1).key), [C(0), C(4), C(6)], O(1).key);
    for (const k of [C(0), C(4)]) s = treeStore.place(s, exp, TREE_ROOT_ID, k, truthOf(exp, k, O(1).feature!) === 'yes' ? 'yes' : 'no');
    add(treeStore.selectCard(s, exp, C(6)));
  }
  // check-subjective
  if (subjective[0]) add(check(placeAll(crit(fresh(), subjective[0].key))));
  // check-unobserved
  add(check(placeAll(crit(fresh(), O(0).key))));
  add(check(placeAll(watch(crit(fresh(), O(1).key), cards.slice(0, 5), O(1).key))));
  // check-inconsistent
  add(check(placeAll(watch(crit(fresh(), O(0).key), cards, O(0).key), [C(1)])));
  add(check(placeAll(watch(crit(fresh(), O(1).key), cards, O(1).key), [C(0), C(5)])));
  {
    // 나눈 뒤 아래 무리에서 틀리게 나눔
    const node = kids.yes;
    const s0 = treeStore.selectNode(rootSplit, node);
    const key = splitter(s0, node)!;
    const s1 = watch(crit(s0, key, node), nodeOf(s0, node).cards, key);
    add(check(placeAll(s1, [nodeOf(s0, node).cards[0]!], node), node));
  }
  // tree-next-node
  add(rootSplit);
  add(splitWith(fresh(), O(1).key));
  {
    const s = splitWith(treeStore.selectNode(rootSplit, kids.no), splitter(rootSplit, kids.no)!, kids.no);
    add(s);
  }
  // tree-split-empty (아래 무리에서 모두 같은 값인 기준으로 나눔)
  for (const side of [kids.yes, kids.no]) {
    const s0 = treeStore.selectNode(rootSplit, side);
    const key = sameValueCriterion(s0, side);
    if (key) add(splitWith(s0, key, side));
  }
  // finished
  add(solve(O(0).key));
  add(solve(O(1).key));
  add(solve(O(2).key));
  return out;
}

const TREE_ROOT_ID = 'r';

function genOrder(unitId: string, exp: CardSortExperiment): Draft[] {
  const by = exp.orderBy!;
  const fu = exp.followUp;
  const cards = keysOf(exp);
  const C = (i: number) => cards[((i % cards.length) + cards.length) % cards.length]!;
  type S = orderStore.OrderLabState;
  const fresh = (): S => orderStore.createInitialOrderState(exp);
  const height = (k: string) => Number(exp.cards.find((c) => c.key === k)!.features[by.feature]);
  /** 높이가 맞는 순서(먼저 → 나중). */
  const correct = [...cards].sort((a, b) => (by.direction === 'ascending' ? height(a) - height(b) : height(b) - height(a)));
  const watch = (s: S, list: readonly string[], feature = by.feature): S => {
    let cur = s;
    for (const k of list) cur = orderStore.observe(cur, exp, k, feature);
    return cur;
  };
  const fill = (s: S, order: readonly string[]): S => {
    let cur = s;
    order.forEach((k, i) => (cur = orderStore.placeInSlot(cur, k, i)));
    return cur;
  };
  /** correct에서 두 카드의 자리를 바꾼 순서. */
  const swapped = (...pairs: Array<[number, number]>) => {
    const o = [...correct];
    for (const [i, j] of pairs) [o[i], o[j]] = [o[j]!, o[i]!];
    return o;
  };
  const followAll = (s: S, wrong: readonly string[] = []): S => {
    if (!fu) return s;
    let cur = s;
    for (const k of cards) {
      const truth = truthOf(exp, k, fu.feature!);
      const g = wrong.includes(k) ? fu.groups.find((x) => x.value !== truth)!.value : truth;
      cur = orderStore.followUpPlace(cur, exp, k, g);
    }
    return cur;
  };
  const ordered = (): S => orderStore.checkOrder(fill(watch(fresh(), cards), correct), exp);
  const evidence = fu?.evidenceFeature ?? fu?.feature;

  const out: Draft[] = [];
  const add = (s: S) => {
    const state = fromOrderState(exp, s, unitId);
    out.push({ title: describeSort(exp, state), state });
  };

  // pick-card
  add(fresh());
  add(fill(fresh(), [correct[0]!]));
  add(watch(fresh(), [C(0), C(2)]));
  // before-observe
  add(orderStore.select(fresh(), exp, C(0)));
  add(orderStore.select(fill(fresh(), [correct[2]!, correct[0]!]), exp, C(3)));
  // sorting
  add(orderStore.select(watch(fresh(), [C(1)]), exp, C(1)));
  add(orderStore.select(watch(fill(fresh(), [C(2), C(4)]), [C(2), C(4), C(0)]), exp, C(0)));
  // order-check-unobserved (칸을 모두 채웠지만 높이를 안 본 카드가 있음)
  add(orderStore.checkOrder(fill(fresh(), cards), exp));
  add(orderStore.checkOrder(fill(watch(fresh(), cards.slice(0, 3)), swapped([0, 4])), exp));
  add(orderStore.checkOrder(fill(watch(fresh(), cards.slice(1)), correct), exp));
  // order-check-inconsistent
  add(orderStore.checkOrder(fill(watch(fresh(), cards), swapped([0, 1])), exp));
  add(orderStore.checkOrder(fill(watch(fresh(), cards), swapped([1, 3])), exp));
  add(orderStore.checkOrder(fill(watch(fresh(), cards), swapped([0, 4], [1, 2])), exp));
  add(orderStore.checkOrder(fill(watch(fresh(), cards), [...correct].reverse()), exp));
  // order-check-complete (followUp 시작 전, 일부 넣음)
  add(ordered());
  if (fu) {
    const base = ordered();
    add(orderStore.select(base, exp, C(0)));
    add(orderStore.followUpPlace(base, exp, C(1), fu.groups[0]!.value));
    // followUp 확인: 근거 특징을 안 봄 / 관찰과 다른 무리 / 통과
    const seeAll = watch(ordered(), cards, evidence!);
    add(orderStore.checkFollowUp(followAll(ordered()), exp));
    add(orderStore.checkFollowUp(followAll(watch(ordered(), cards.slice(0, 3), evidence!)), exp));
    add(orderStore.checkFollowUp(followAll(seeAll, [C(1)]), exp));
    add(orderStore.checkFollowUp(followAll(seeAll, [C(0), C(3)]), exp));
    add(orderStore.checkFollowUp(followAll(seeAll), exp));
    // 화석을 먼저 보고 높이를 나중에 본 학생이 끝냄(관찰 순서가 다르다)
    const fossilFirst = orderStore.checkOrder(fill(watch(watch(fresh(), cards, evidence!), cards), correct), exp);
    add(orderStore.checkFollowUp(followAll(fossilFirst), exp));
  }
  return out;
}

// ---- 관찰 활동 ----

function genObservation(unitId: string, exp: ObservationExperiment): Draft[] {
  const out: Draft[] = [];
  const optLabel = (task: ObservationExperiment['tasks'][number], v: string | number | null) =>
    v === null ? '' : (task.options.find((o) => o.value === v)?.label ?? String(v));

  exp.tasks.forEach((task, ti) => {
    const base = obsStore.select(obsStore.createInitialState(exp), exp, task.id);
    const answerOf = (s: obsStore.ObserveState) => modelAnswer(exp, task, obsStore.current(s, exp).ts.controls);
    /** 과제에 맞는 관찰 조작을 한 번 한다(조건 토글이 있으면 번갈아 바꾼다). */
    const interact = (s: obsStore.ObserveState, variant: number): obsStore.ObserveState => {
      let cur = s;
      const control = task.controls?.[0];
      if (control && variant % 2 === 1) {
        const next = control.options.find((o) => o.value !== control.default)!.value;
        cur = obsStore.setControl(cur, exp, control.key, next);
      }
      if (task.view === 'solar-system') return obsStore.touchView(cur, exp);
      if (task.view === 'moon') return obsStore.setDay(cur, exp, [10, 15, 22, 18][(ti + variant) % 4]!);
      if (task.view === 'revolution') return obsStore.setMonth(cur, exp, [8, 11, 2, 5][(ti + variant) % 4]!);
      const hours = task.view === 'north-sky' ? [NORTH_HOUR_MIN + 3, NORTH_HOUR_MIN + 6, NORTH_HOUR_MIN + 1, NORTH_HOUR_MAX] : [15, 18, 22, 6];
      return obsStore.setHour(cur, exp, hours[(ti + variant) % 4]!);
    };
    const wrongOption = (answer: string, k: number) => {
      const others = task.options.filter((o) => String(o.value) !== answer);
      return others[(ti + k) % others.length]!.value;
    };
    const add = (s: obsStore.ObserveState) => {
      const state = fromObserveState(exp, s, unitId);
      const { ts } = obsStore.current(s, exp);
      const parts = [
        `${task.title}`,
        ts.prediction === null ? '예측 전' : `예측: ${optLabel(task, ts.prediction)}`,
        ...(ts.prediction !== null && !ts.recorded ? [ts.observed ? '관찰 조작함' : '관찰 조작 전'] : []),
        ...(ts.recorded ? [`기록: ${optLabel(task, ts.recorded.value)}`, state.matchesModel ? '관찰 화면과 같음' : '관찰 화면과 다름'] : []),
        ...(ts.recorded && ts.prediction !== null && ts.recorded.value !== ts.prediction ? ['예측과 다르게 기록'] : []),
      ];
      out.push({ title: parts.join(', '), state });
    };

    // before-observe
    add(base);
    // observing: 예측만 한 상태 / 관찰 조작까지 한 상태
    const answer0 = answerOf(base);
    const guess = (k: number) => wrongOption(answer0, k);
    // (과제마다 한 가지만 두어 단원당 25개를 넘기지 않는다: 짝수 번째 과제는 예측만, 홀수 번째는 조작까지)
    if (ti % 2 === 0) add(obsStore.predict(base, exp, task.options[ti % task.options.length]!.value));
    else add(interact(obsStore.predict(base, exp, guess(1)), 0));
    // record-mismatch: 관찰과 다른 선택지를 기록
    {
      const s0 = interact(obsStore.predict(base, exp, guess(0)), 1);
      add(obsStore.record(s0, exp, wrongOption(answerOf(s0), 2)));
    }
    // record-match: 예측도 기록도 관찰 결과와 같음
    {
      const s0 = interact(obsStore.predict(base, exp, answer0), 1);
      const ans = answerOf(s0);
      add(obsStore.record(obsStore.predict(s0, exp, ans), exp, ans));
    }
    // prediction-mismatch: 관찰대로 기록했지만 예측은 달랐음
    {
      const s0 = interact(obsStore.predict(base, exp, guess(2)), 0);
      add(obsStore.record(s0, exp, answerOf(s0)));
    }
  });
  return out;
}

// ---- 전체 ----

export function generateScenarios(unitId: string, unit: UnitData): Scenario[] {
  const drafts: Draft[] = [];
  for (const exp of unit.manifest.experiments as Experiment[]) {
    if (isPortfolioExperiment(exp)) continue; // 진로 포트폴리오는 정답을 알려 줄 위험이 없어 튜터가 없다.
    if (isClassificationExperiment(exp)) drafts.push(...genClassify(unitId, exp));
    else if (isCardSortExperiment(exp)) drafts.push(...genCardSort(unitId, exp));
    else if (isObservationExperiment(exp)) drafts.push(...genObservation(unitId, exp));
    else drafts.push(...genVariable(unitId, exp));
  }
  return drafts.map((d, i) => ({
    scenarioId: `${unitId}-s${String(i + 1).padStart(3, '0')}`,
    unitId,
    title: d.title,
    state: d.state,
  }));
}

/** 시나리오가 만들어 내는 상황 키의 분포(보고와 테스트용). */
export function situationCounts(units: Record<string, UnitData>, scenarios: Scenario[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const s of scenarios) {
    const exp = units[s.unitId]!.manifest.experiments.find((e) => e.id === s.state.experimentId)!;
    const key = situationOf(s.state, exp);
    (out[s.unitId] ??= {})[key] = (out[s.unitId]![key] ?? 0) + 1;
  }
  return out;
}

/**
 * 대표 단원의 튜터 시나리오 라이브러리를 시뮬레이션으로 만든다(결정적).
 * 변인 실험은 앱의 모듈 시뮬레이션과 런타임으로, 분류 활동은 앱의 저장소 함수로 상태를 만든다.
 * 규칙을 바꾸면 시나리오 번호(생성 순서)가 바뀐다. 데이터가 쌓인 뒤에는 새 시나리오를 뒤에 덧붙이는 식으로만 늘린다.
 */
import { truthGroup } from '@sci/engine-matter';
import { PREDICTION_LABEL, analyzeTrial, observedOutcome, type Prediction } from '@sci/gateway';
import { createRuntime } from '@sci/runtime';
import type { ClassificationExperiment, Experiment, VariableExperiment } from '@sci/schema';
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
import { fromClassifyState, fromVariableRuntime, situationOf, type TutorState } from '../src/context';
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
  const V = (i: number) => vars[Math.min(i, vars.length - 1)]!;
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
  add(chain(1, V(0).key, 'decrease', [{ change: { [V(0).key]: other(V(0).key, b1[V(0).key]!, 0), [V(3).key]: other(V(3).key, b1[V(3).key]!, 0) }, iv: V(0).key, pred: 'increase' }]));
  add(chain(2, V(2).key, 'increase', [{ change: { [V(2).key]: other(V(2).key, b2[V(2).key]!, 0), [V(1).key]: other(V(1).key, b2[V(1).key]!, 0), [V(3).key]: other(V(3).key, b2[V(3).key]!, 0) }, iv: V(2).key, pred: 'increase' }]));
  // iv-unchanged (고른 변인은 그대로, 다른 조건이 바뀜)
  add(chain(0, V(0).key, 'increase', [{ change: { [V(2).key]: other(V(2).key, b0[V(2).key]!, 1) }, iv: V(0).key, pred: 'increase' }]));
  add(chain(1, V(3).key, 'decrease', [{ change: { [V(1).key]: other(V(1).key, b1[V(1).key]!, 1), [V(2).key]: other(V(2).key, b1[V(2).key]!, 1) }, iv: V(3).key, pred: 'decrease' }]));
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

// ---- 전체 ----

export function generateScenarios(unitId: string, unit: UnitData): Scenario[] {
  const drafts: Draft[] = [];
  for (const exp of unit.manifest.experiments as Experiment[]) {
    if (exp.module === 'indicator-classify') drafts.push(...genClassify(unitId, exp));
    else if (exp.module === 'sky-observation' || exp.module === 'card-sort' || exp.module === 'career-portfolio') continue; // 관찰·카드 분류·진로 활동은 이번 대표 단원에 없다.
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

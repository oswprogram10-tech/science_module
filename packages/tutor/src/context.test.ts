import { describe, expect, it } from 'vitest';
import { analyzeTrial, type AnalysisKind, type Prediction } from '@sci/gateway';
import { createRuntime } from '@sci/runtime';
import {
  parseManifest,
  type ClassificationExperiment,
  type ObservationExperiment,
  type VariableExperiment,
} from '@sci/schema';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import earthJson from '../../../content/units/g6-earth-motion/manifest.json';
import electricityJson from '../../../content/units/g6-electricity/manifest.json';
import plantJson from '../../../content/units/g6-plant/manifest.json';
import { MODULES } from '../../../apps/student/src/modules';
import * as cls from '../../../apps/student/src/modules/indicator-classify/classifyStore';
import * as obs from '../../../apps/student/src/modules/sky-observation/observeStore';
import {
  PROMPT_VERSION,
  TUTOR_SYSTEM,
  buildTutorInput,
  fromClassifyState,
  fromObserveState,
  fromVariableRuntime,
  situationOf,
  type TutorState,
} from './context';
import { pickProbeKey } from './index';

const solution = parseManifest(solutionJson);
const gases = parseManifest(gasesJson);
const acidBase = parseManifest(acidBaseJson);
const earth = parseManifest(earthJson);
const dissolveExp = solution.experiments[0] as VariableExperiment;
const gasExp = gases.experiments[0] as VariableExperiment;
const classifyExp = acidBase.experiments[0] as ClassificationExperiment;
const observeExp = earth.experiments[0] as ObservationExperiment;
const unitOf = (m: { title: string; grade: number }) => ({ title: m.title, grade: m.grade });

/** 앱과 같은 방식으로 시행을 실행한다. */
function runVariable(
  exp: VariableExperiment,
  moduleKind: 'dissolution' | 'gas-syringe',
  steps: { values: Record<string, string | number>; iv: string; pred: Prediction }[],
) {
  const mod = MODULES[moduleKind];
  const labels = Object.fromEntries(exp.variables.map((v) => [v.key, v.label]));
  const rt = createRuntime({ defaults: Object.fromEntries(exp.variables.map((v) => [v.key, v.default])) });
  for (const s of steps) {
    for (const [k, v] of Object.entries(s.values)) rt.setValue(k, v);
    rt.setIV(s.iv);
    rt.setPrediction(s.pred);
    rt.run((v) => mod.simulate(v, exp), (prev, cur) => analyzeTrial(prev, cur, labels));
    rt.tick(1e9);
  }
  return { rt, mod };
}

describe('buildTutorInput: 변인 실험', () => {
  const { rt, mod } = runVariable(dissolveExp, 'dissolution', [
    { values: { solute: 'alum' }, iv: 'waterTempC', pred: 'increase' },
    { values: { waterTempC: 60 }, iv: 'waterTempC', pred: 'increase' },
  ]);
  const state = fromVariableRuntime(dissolveExp, rt.getSnapshot(), mod, 'g5-solution');

  it('사양의 형식대로 문장화한다', () => {
    expect(buildTutorInput(dissolveExp, state, '왜 이렇게 많이 녹았어요?', unitOf(solution))).toBe(
      [
        '[단원] 용해와 용액 (5학년)',
        '[탐구 질문] 어떤 조건에서 용질이 더 많이 녹을까?',
        '[상황] fair-test',
        '[바꿀 조건] 물의 온도',
        '[시행]',
        '1) 용질의 종류 백반 · 물의 양 50 mL · 물의 온도 20 °C · 젓기 천천히 → 녹은 양 5.7 g · 걸린 시간 28.5초 · 예측 늘어난다',
        '2) 용질의 종류 백반 · 물의 양 50 mL · 물의 온도 60 °C(바뀜) · 젓기 천천히 → 녹은 양 28.7 g · 걸린 시간 71.8초 · 예측 늘어난다 · 결과 늘어났다',
        '[학생] 왜 이렇게 많이 녹았어요?',
      ].join('\n'),
    );
  });

  it('학생 발화가 없으면 (말하지 않음)', () => {
    expect(buildTutorInput(dissolveExp, state, undefined, unitOf(solution)).endsWith('[학생] (말하지 않음)')).toBe(true);
    expect(buildTutorInput(dissolveExp, state, '  ', unitOf(solution)).endsWith('[학생] (말하지 않음)')).toBe(true);
  });

  it('결정적이다', () => {
    const a = buildTutorInput(dissolveExp, state, '안녕', unitOf(solution));
    const b = buildTutorInput(dissolveExp, JSON.parse(JSON.stringify(state)) as TutorState, '안녕', unitOf(solution));
    expect(a).toBe(b);
  });

  it('실행 전에는 현재 조건을 보여 준다', () => {
    const fresh = createRuntime({ defaults: { solute: 'salt', waterMl: 50, waterTempC: 20, stir: 1 } });
    fresh.setIV('stir');
    fresh.setPrediction('same');
    const s = fromVariableRuntime(dissolveExp, fresh.getSnapshot(), mod, 'g5-solution');
    expect(buildTutorInput(dissolveExp, s, '', unitOf(solution))).toMatchInlineSnapshot(`
      "[단원] 용해와 용액 (5학년)
      [탐구 질문] 어떤 조건에서 용질이 더 많이 녹을까?
      [상황] before-run
      [바꿀 조건] 젓기
      [시행]
      (아직 실행하지 않음)
      [현재 조건] 용질의 종류 소금 · 물의 양 50 mL · 물의 온도 20 °C · 젓기 천천히 · 예측 변하지 않는다
      [학생] (말하지 않음)"
    `);
  });

  it('기체 단원: 음수 변화와 단위', () => {
    const g = runVariable(gasExp, 'gas-syringe', [
      { values: { push: 1, bathTempC: 60 }, iv: 'bathTempC', pred: 'decrease' },
      { values: { bathTempC: 0 }, iv: 'bathTempC', pred: 'decrease' },
    ]);
    const s = fromVariableRuntime(gasExp, g.rt.getSnapshot(), g.mod, 'g4-gases');
    expect(buildTutorInput(gasExp, s, '눈금이 내려갔어요.', unitOf(gases))).toMatchInlineSnapshot(`
      "[단원] 여러 가지 기체 (4학년)
      [탐구 질문] 주사기 속 기체의 부피는 어떤 조건에 따라 달라질까?
      [상황] fair-test
      [바꿀 조건] 주사기를 담근 물의 온도
      [시행]
      1) 피스톤을 누르는 힘 살짝 누름 · 주사기를 담근 물의 온도 뜨거운 물 60 °C · 기체의 종류 공기 · 처음 기체의 부피 30 mL → 기체의 부피 27.3 mL · 부피 변화 -2.7 mL · 예측 줄어든다
      2) 피스톤을 누르는 힘 살짝 누름 · 주사기를 담근 물의 온도 얼음물 0 °C(바뀜) · 기체의 종류 공기 · 처음 기체의 부피 30 mL → 기체의 부피 22.4 mL · 부피 변화 -7.6 mL · 예측 줄어든다 · 결과 줄어들었다
      [학생] 눈금이 내려갔어요."
    `);
  });

  it('TUTOR_SYSTEM과 PROMPT_VERSION', () => {
    expect(PROMPT_VERSION).toBe('v1');
    expect(TUTOR_SYSTEM).toContain('1~2문장');
    expect(TUTOR_SYSTEM).toContain('질문으로 끝낸다');
  });
});

describe('어댑터: fromVariableRuntime', () => {
  it('최근 3개 시행만 담고, 재생 중인 시행은 뺀다', () => {
    const steps = ['alum', 'salt', 'sugar', 'bakingSoda'].map((s) => ({ values: { solute: s }, iv: 'solute', pred: 'increase' as const }));
    const { rt, mod } = runVariable(dissolveExp, 'dissolution', steps);
    const s = fromVariableRuntime(dissolveExp, rt.getSnapshot(), mod, 'g5-solution');
    expect(s.trials.map((t) => t.index)).toEqual([2, 3, 4]);
    expect(s.trials[0]!.observed).not.toBeNull(); // 창 밖의 앞 시행과 비교해 계산한다.
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);

    // 재생 중(playing)이면 마지막 시행은 아직 보이지 않는다.
    const rt2 = createRuntime({ defaults: { solute: 'salt', waterMl: 50, waterTempC: 20, stir: 1 } });
    rt2.setIV('solute');
    rt2.setPrediction('increase');
    rt2.run((v) => mod.simulate(v, dissolveExp), (p, c) => analyzeTrial(p, c));
    expect(rt2.getSnapshot().playing).toBe(true);
    expect(fromVariableRuntime(dissolveExp, rt2.getSnapshot(), mod, 'g5-solution').trials).toEqual([]);
  });
});

describe('situationOf: 변인 실험은 pickProbeKey와 전수 비교', () => {
  const kinds: AnalysisKind[] = ['first-trial', 'repeat', 'fair-test', 'confounded', 'iv-unchanged'];
  const preds: (Prediction | null)[] = [null, 'increase', 'decrease', 'same'];
  it('모든 조합이 같다', () => {
    let n = 0;
    for (const kind of kinds)
      for (const prediction of preds)
        for (const observed of preds) {
          const state: TutorState = {
            kind: 'variable',
            unitId: 'g5-solution',
            experimentId: dissolveExp.id,
            current: { values: {}, ivKey: null, prediction: null },
            trials: [{ index: 1, values: {}, ivKey: 'stir', prediction, result: {}, analysis: { kind, changed: [] }, observed }],
          };
          const expected = pickProbeKey({ lastAnalysis: { kind, changed: [] }, labels: {}, prediction, observed });
          expect(situationOf(state, dissolveExp)).toBe(expected);
          n++;
        }
    expect(n).toBe(5 * 4 * 4);
    const none: TutorState = { kind: 'variable', unitId: 'u', experimentId: 'e', current: { values: {}, ivKey: null, prediction: null }, trials: [] };
    expect(situationOf(none, dissolveExp)).toBe(pickProbeKey({ labels: {} }));
  });
});

describe('분류 활동', () => {
  const exp = classifyExp;
  const ready = (sol: string, guess: 'acid' | 'base' | 'unsure', inds: string[] = []) => {
    let s = cls.confirmSafety(cls.createInitialState());
    s = cls.predict(cls.select(s, exp, sol), exp, sol, guess);
    for (const i of inds) s = cls.testIndicator(s, exp, i);
    return s;
  };
  const GROUPS = ['산성 용액', '염기성 용액'];

  it('어댑터: 실제 저장소 상태를 JSON 상태로 바꾼다', () => {
    const s = ready('lemon', 'base', ['blueLitmus', 'phenol']);
    const t = fromClassifyState(exp, s, 'g6-acid-base');
    expect(t).toEqual({
      kind: 'classify',
      unitId: 'g6-acid-base',
      experimentId: 'indicator-classify',
      selected: 'lemon',
      predictions: { lemon: 'base' },
      tests: { lemon: [{ indicator: 'blueLitmus', color: 'red' }, { indicator: 'phenol', color: 'clear' }] },
      placement: {},
      check: null,
    });
    expect(situationOf(t, exp)).toBe('prediction-mismatch');
  });

  it('입력에 정답 무리 정보가 없다: 무리 이름은 학생이 한 예측·분류에만 나온다', () => {
    // 학생이 아무것도 예측·분류하지 않은 상태: 무리 이름이 하나도 없어야 한다.
    const bare = fromClassifyState(exp, cls.select(cls.createInitialState(), exp, 'lemon'), 'g6-acid-base');
    const bareText = buildTutorInput(exp, bare, '', unitOf(acidBase));
    for (const g of GROUPS) expect(bareText).not.toContain(g);
    expect(bareText).not.toMatch(/level|정답|\d\.\d/);

    // 모두 올바르게 분류한 상태에서도, 용액 줄의 무리 이름은 학생의 예측·분류와 정확히 같다.
    let s = cls.confirmSafety(cls.createInitialState());
    for (const sol of exp.solutions) {
      s = cls.predict(cls.select(s, exp, sol.key), exp, sol.key, 'unsure');
      s = cls.testIndicator(s, exp, 'cabbage');
      s = cls.place(s, exp, sol.key, sol.level < 7 ? 'acid' : 'base');
    }
    s = cls.check(s, exp);
    const t = fromClassifyState(exp, s, 'g6-acid-base');
    const text = buildTutorInput(exp, t, '', unitOf(acidBase));
    for (const sol of exp.solutions) {
      const line = text.split('\n').find((l) => l.startsWith(`- ${sol.label}:`))!;
      const groupsInLine = GROUPS.filter((g) => line.includes(g));
      expect(groupsInLine).toEqual([sol.level < 7 ? '산성 용액' : '염기성 용액']); // 학생이 넣은 무리 하나뿐
      expect(line).toContain('예측 잘 모르겠다');
    }
    // 상태 JSON에도 정답 필드(level)나 hazard 정보가 없다.
    expect(JSON.stringify(t)).not.toMatch(/level|truth|hazard/);
  });

  it('situationOf가 앱의 tutorSituation과 전수 비교해 같다', () => {
    const indicatorSets = [[], ...exp.indicators.map((i) => [i.key]), ['blueLitmus', 'phenol'], ['redLitmus', 'cabbage']];
    const guesses = [null, 'acid', 'base', 'unsure'] as const;
    let n = 0;
    for (const sol of exp.solutions) {
      for (const g of guesses) {
        for (const inds of indicatorSets) {
          let s = cls.confirmSafety(cls.select(cls.createInitialState(), exp, sol.key));
          if (g) s = cls.predict(s, exp, sol.key, g);
          for (const i of inds) s = cls.testIndicator(s, exp, i);
          const t = fromClassifyState(exp, s, 'g6-acid-base');
          expect(situationOf(t, exp), `${sol.key}/${g}/${inds}`).toBe(cls.tutorSituation(s, exp).when);
          // 확인한 뒤의 상황도 같다.
          let placed = s;
          for (const x of exp.solutions) placed = cls.place(placed, exp, x.key, x.level < 7 ? 'acid' : 'base');
          placed = cls.check(placed, exp);
          const tp = fromClassifyState(exp, placed, 'g6-acid-base');
          expect(situationOf(tp, exp)).toBe(cls.tutorSituation(placed, exp).when);
          n += 2;
        }
      }
    }
    expect(n).toBe(8 * 4 * indicatorSets.length * 2);
    // 아무것도 고르지 않은 처음 상태
    const initial = cls.createInitialState();
    expect(situationOf(fromClassifyState(exp, initial, 'g6-acid-base'), exp)).toBe(cls.tutorSituation(initial, exp).when);
  });

  it('입력 스냅샷: 확인 결과가 있는 상태', () => {
    let s = cls.confirmSafety(cls.createInitialState());
    for (const [sol, g, ind] of [['lemon', 'acid', 'blueLitmus'], ['soap', 'base', 'phenol']] as const) {
      s = cls.testIndicator(cls.predict(cls.select(s, exp, sol), exp, sol, g), exp, ind);
    }
    for (const x of exp.solutions) s = cls.place(s, exp, x.key, x.key === 'lemon' ? 'base' : x.level < 7 ? 'acid' : 'base');
    s = cls.check(s, exp);
    const text = buildTutorInput(exp, fromClassifyState(exp, s, 'g6-acid-base'), '왜 다시 보래요?', unitOf(acidBase));
    expect(text).toMatchSnapshot();
    expect(text).toContain('[확인 결과]');
    expect(text).toContain('레몬즙 다시 비교 필요');
    expect(text).toContain('묽은 염산 시험 안 함');
  });
});

describe('관찰 활동', () => {
  const exp = observeExp;

  it('어댑터와 입력: 기록·모델 비교, 정답 라벨 없음', () => {
    let s = obs.predict(obs.select(obs.createInitialState(exp), exp, 'sun-path'), exp, 'west-to-east');
    s = obs.record(obs.setHour(s, exp, 9), exp, 'east-to-west');
    const t = fromObserveState(exp, s, 'g6-earth-motion');
    expect(t).toMatchObject({ kind: 'observe', taskId: 'sun-path', prediction: 'west-to-east', recorded: 'east-to-west', matchesModel: true });
    expect(situationOf(t, exp)).toBe('prediction-mismatch');
    const text = buildTutorInput(exp, t, '예상이랑 달라요.', { title: '지구의 운동', grade: 6 });
    expect(text).toMatchSnapshot();
    // 정답(모델 결과)은 학생이 기록·예측한 값으로만 나온다: 정답 필드나 선택지 전체 목록은 입력에 없다.
    expect(text).not.toContain('[정답]');
    expect(JSON.stringify(t)).not.toMatch(/answer/);
  });

  it('situationOf가 앱의 tutorSituation과 전수 비교해 같다', () => {
    let n = 0;
    for (const task of exp.tasks) {
      for (const pred of [null, ...task.options.map((o) => o.value)]) {
        for (const rec of [null, ...task.options.map((o) => o.value)]) {
          for (const moved of [false, true]) {
            let s = obs.select(obs.createInitialState(exp), exp, task.id);
            if (pred !== null) s = obs.predict(s, exp, pred);
            if (moved) {
              s = task.view === 'rotation' ? obs.setHour(s, exp, 9) : task.view === 'moon' ? obs.setDay(s, exp, 10) : obs.setMonth(s, exp, 1);
              if (task.controls?.[0]) s = obs.setControl(s, exp, task.controls[0].key, task.controls[0].options[1]!.value);
            }
            if (rec !== null) s = obs.record(s, exp, rec);
            const t = fromObserveState(exp, s, 'g6-earth-motion');
            expect(situationOf(t, exp), `${task.id}/${pred}/${rec}/${moved}`).toBe(obs.tutorSituation(s, exp));
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(50);
  });
});

describe('상태 종류와 실험 종류가 맞지 않으면 오류', () => {
  it('던진다', () => {
    const t = fromClassifyState(classifyExp, cls.createInitialState(), 'g6-acid-base');
    expect(() => situationOf(t, dissolveExp)).toThrow();
    expect(() => buildTutorInput(observeExp, t)).toThrow();
  });
});

// ---- 3차 묶음 E1: 바꿀 조건 없이 실행(bulb-light)과 값이 없는(NaN) 결과(microscope-cells) ----

describe('bulb-light: 바꿀 조건을 고르지 않고 실행한 시행', () => {
  const bulb = parseManifest(electricityJson).experiments[1] as VariableExperiment;
  const mod = MODULES['bulb-light'];
  const labels = Object.fromEntries(bulb.variables.map((v) => [v.key, v.label]));
  const defaults = Object.fromEntries(bulb.variables.map((v) => [v.key, v.default]));
  /** 앱처럼: 바꿀 조건(setIV)을 고르지 않고 예측만 고른 뒤 실행한다. */
  const runFree = (changes: Record<string, string>[]) => {
    const rt = createRuntime({ defaults });
    for (const c of changes) {
      for (const [k, v] of Object.entries(c)) rt.setValue(k, v);
      rt.setPrediction('increase');
      rt.run((v) => mod.simulate(v, bulb), (prev, cur) => analyzeTrial(prev, cur, labels));
      rt.tick(1e9);
    }
    return fromVariableRuntime(bulb, rt.getSnapshot(), mod, 'g6-electricity');
  };

  it('첫 시행은 first-trial, 하나만 바꾸면 그 조건의 fair-test, 둘 이상 바꾸면 confounded, 같은 조건은 repeat이다', () => {
    expect(situationOf(runFree([{}]), bulb)).toBe('first-trial');
    const one = runFree([{}, { switch: 'closed' }]);
    expect(one.trials.at(-1)!.analysis).toEqual({ kind: 'fair-test', changed: ['switch'] });
    expect(one.trials.at(-1)!.ivKey).toBeNull();
    // fair-test이므로 예측과 관찰을 견준다: '늘어난다'고 예측했지만 기준 연결은 스위치를 닫아도 켜지지 않아 예측과 다르다.
    expect(one.trials.at(-1)!.observed).toBe('same');
    expect(situationOf(one, bulb)).toBe('prediction-mismatch');
    expect(situationOf(runFree([{}, { switch: 'closed', wireColor: 'black' }]), bulb)).toBe('confounded');
    expect(situationOf(runFree([{}, {}]), bulb)).toBe('repeat');
  });

  it('입력 문장에는 바꿀 조건이 "(고르지 않음)"이고 결과(밝기 눈금·전구)가 읽힌다', () => {
    const state = runFree([{}, { plusEnd: 'tip', minusEnd: 'side', switch: 'closed' }]);
    const input = buildTutorInput(bulb, state, '', unitOf(parseManifest(electricityJson)));
    expect(input).toContain('[바꿀 조건] (고르지 않음)');
    expect(input).toContain('전구의 밝기 6.0눈금 · 전구 켜짐');
    expect(input).toContain('전구의 밝기 0.0눈금 · 전구 켜지지 않음');
    expect(input).toContain('[상황] confounded');
  });
});

describe('microscope-cells: 칸이 보이지 않는 시행(size = NaN)', () => {
  const plant = parseManifest(plantJson);
  const micro = plant.experiments[1] as VariableExperiment;
  const mod = MODULES['microscope-cells'];
  const labels = Object.fromEntries(micro.variables.map((v) => [v.key, v.label]));
  const defaults = Object.fromEntries(micro.variables.map((v) => [v.key, v.default]));
  const run = (steps: { change: Record<string, string | number>; iv: string; pred: Prediction }[]) => {
    const rt = createRuntime({ defaults });
    for (const s of steps) {
      for (const [k, v] of Object.entries(s.change)) rt.setValue(k, v);
      rt.setIV(s.iv);
      rt.setPrediction(s.pred);
      rt.run((v) => mod.simulate(v, micro), (prev, cur) => analyzeTrial(prev, cur, labels));
      rt.tick(1e9);
    }
    return fromVariableRuntime(micro, rt.getSnapshot(), mod, 'g6-plant');
  };

  it('결과에 NaN을 담지 않아 JSON으로 저장해도 null이 되지 않고, 입력 문장에 "NaN"·"null"이 나오지 않는다', () => {
    const state = run([{ change: {}, iv: 'focus', pred: 'increase' }, { change: { focus: 'on' }, iv: 'focus', pred: 'increase' }]);
    expect(state.trials[0]!.result).toEqual({ seen: '흐릿함' });
    expect(state.trials[1]!.result).toEqual({ size: 10, seen: '투명한 칸들' });
    expect(JSON.stringify(state)).not.toMatch(/NaN|"size":null/);
    const input = buildTutorInput(micro, state, '', unitOf(plant));
    expect(input).not.toMatch(/NaN|null/);
    expect(input).toContain('보인 것 흐릿함');
    expect(input).toContain('화면에서 본 칸 하나의 길이 10.0 mm');
  });

  it('칸이 보이지 않던 시행에서 보이게 되면 "늘어났다", 반대면 "줄어들었다"(보이지 않음은 0으로 본다)', () => {
    expect(run([{ change: {}, iv: 'focus', pred: 'increase' }, { change: { focus: 'on' }, iv: 'focus', pred: 'increase' }]).trials[1]!.observed).toBe('increase');
    expect(run([{ change: { focus: 'on' }, iv: 'focus', pred: 'increase' }, { change: { focus: 'off' }, iv: 'focus', pred: 'increase' }]).trials[1]!.observed).toBe('decrease');
    // 둘 다 보이지 않으면(초점 안 맞춤) 배율을 바꿔도 변하지 않았다.
    expect(run([{ change: {}, iv: 'power', pred: 'increase' }, { change: { power: 100 }, iv: 'power', pred: 'increase' }]).trials[1]!.observed).toBe('same');
  });
});

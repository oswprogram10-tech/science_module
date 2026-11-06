import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNITS } from '../../../apps/student/src/units';
import { generateScenarios, situationCounts } from '../scripts/scenarios';
import { buildTutorInput, situationOf } from './context';
import { CONTENT_DIR, TUTOR_DIR, TUTOR_UNITS, loadUnits, scenarioFile } from './datasetIo';

const units = loadUnits();

describe('튜터 단원 목록', () => {
  it('g6-career를 뺀 모든 단원이고, 학년 순 · 같은 학년은 앱 목록 순서다', () => {
    const all = readdirSync(CONTENT_DIR).filter((d) => d !== 'g6-career');
    expect([...TUTOR_UNITS].sort()).toEqual(all.sort());
    const order = UNITS.filter((u) => u.id !== 'g6-career')
      .map((u, i) => ({ id: u.id, grade: u.ok ? u.manifest.grade : 0, i }))
      .sort((a, b) => a.grade - b.grade || a.i - b.i)
      .map((u) => u.id);
    expect([...TUTOR_UNITS]).toEqual(order);
  });
});

describe('시나리오 생성기', () => {
  const generated = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));
  const expOf = (s: (typeof generated)[number]) => units[s.unitId]!.manifest.experiments.find((e) => e.id === s.state.experimentId)!;

  it('두 번 만들어도 같고, 저장소의 scenarios/*.jsonl과 같다(결정성·최신 여부)', () => {
    const again = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));
    expect(again).toEqual(generated);
    for (const id of TUTOR_UNITS) {
      const expected = generated.filter((s) => s.unitId === id).map((s) => JSON.stringify(s)).join('\n') + '\n';
      expect(readFileSync(scenarioFile(TUTOR_DIR, id), 'utf8'), `${id}: pnpm tutor:scenarios를 다시 실행하세요`).toBe(expected);
    }
  });

  it('단원마다 15~25개이고, 입력이 서로 다르다', () => {
    for (const id of TUTOR_UNITS) {
      const list = generated.filter((s) => s.unitId === id);
      expect(list.length, id).toBeGreaterThanOrEqual(15);
      expect(list.length, id).toBeLessThanOrEqual(25);
      const inputs = list.map((s) => buildTutorInput(expOf(s), s.state, '', { title: units[id]!.manifest.title, grade: units[id]!.manifest.grade }));
      expect(new Set(inputs).size, id).toBe(inputs.length);
    }
  });

  it('상황 키마다 2개 이상(변인·분류)', () => {
    const counts = situationCounts(units, generated);
    const variable = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];
    const classify = ['before-test', 'testing', 'prediction-mismatch', 'check-untested', 'check-inconsistent', 'check-complete'];
    for (const id of TUTOR_UNITS) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (exp.module === 'indicator-classify') for (const k of classify) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(2);
      else if ('variables' in exp) for (const k of variable) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('카드 분류: 레이아웃마다 닿을 수 있는 상황을 모두 덮는다', () => {
    const counts = situationCounts(units, generated);
    const groups = ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished'];
    const tree = ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'tree-split-empty', 'tree-next-node', 'finished'];
    const order = ['pick-card', 'before-observe', 'sorting', 'order-check-unobserved', 'order-check-inconsistent', 'order-check-complete', 'check-unobserved', 'check-inconsistent', 'finished'];
    for (const k of groups) for (const id of ['g3-animal', 'g3-material']) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(1);
    for (const k of tree) expect(counts['g3-plantlife']![k], `g3-plantlife/${k}`).toBeGreaterThanOrEqual(1);
    for (const k of order) expect(counts['g5-strata']![k], `g5-strata/${k}`).toBeGreaterThanOrEqual(1);
  });

  it('관찰: 과제마다 다섯 상황이 모두 있다', () => {
    for (const id of ['g6-earth-motion', 'g4-night-sky']) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (!('tasks' in exp)) throw new Error('관찰 활동이 아닙니다.');
      for (const task of exp.tasks) {
        const keys = generated
          .filter((s) => s.unitId === id && s.state.kind === 'observe' && s.state.taskId === task.id)
          .map((s) => situationOf(s.state, exp));
        expect(new Set(keys), `${id}/${task.id}`).toEqual(new Set(['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch']));
      }
    }
  });

  it('조작변인마다 fair-test가 있다', () => {
    for (const id of TUTOR_UNITS) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (!('variables' in exp)) continue;
      for (const v of exp.variables) {
        const has = generated.some(
          (s) => s.unitId === id && s.state.kind === 'variable' && s.state.trials.at(-1)?.analysis.kind === 'fair-test' && s.state.trials.at(-1)?.ivKey === v.key,
        );
        expect(has, `${id}/${v.key}`).toBe(true);
      }
    }
  });

  it('입력에 정답 문구가 없다(학생이 기록한 관찰 결과 자체는 예외: 관찰 단원의 [예측]·[관찰 기록] 줄)', () => {
    for (const s of generated) {
      const exp = expOf(s);
      const lines = buildTutorInput(exp, s.state, '').split('\n');
      // 학생이 직접 고른 예측과 기록은 학생의 활동이므로 검사에서 뺀다.
      const text = (s.state.kind === 'observe' ? lines.filter((l) => !l.startsWith('[예측]') && !l.startsWith('[관찰 기록]')) : lines).join('\n');
      for (const f of exp.tutor.forbiddenAnswers) expect(text.includes(f), `${s.scenarioId}: ${f}`).toBe(false);
    }
  });
});

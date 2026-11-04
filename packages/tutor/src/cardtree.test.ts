import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import plantJson from '../../../content/units/g3-plantlife/manifest.json';
import * as ts from '../../../apps/student/src/modules/card-sort/treeStore';
import { buildTutorInput, fromTreeState, situationOf } from './context';
import { cardSortWhen } from './situation';

const plant = parseManifest(plantJson);
const exp = plant.experiments[0] as CardSortExperiment;
const ALL = exp.cards.map((c) => c.key);
const truth = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f] as 'yes' | 'no';

function splitNode(s: ts.TreeLabState, node: string, crit: string, feature: string): ts.TreeLabState {
  let cur = ts.chooseCriterion(s, exp, node, crit);
  for (const c of cur.nodes[node]!.cards) {
    cur = ts.observe(cur, exp, c, feature);
    cur = ts.place(cur, exp, node, c, truth(c, feature));
  }
  return ts.checkNode(cur, exp, node);
}

describe('cardSortWhen: 트리', () => {
  const base = { criterion: 'parallel', selected: null, observed: [], checkKind: null, finished: false, tree: true };
  it('확인이 끝난 노드는 한쪽이 비면 tree-split-empty, 아니면 완료 전 tree-next-node, 완료면 finished', () => {
    expect(cardSortWhen(exp, { ...base, checkKind: 'check-complete', treeSplitEmpty: true })).toBe('tree-split-empty');
    expect(cardSortWhen(exp, { ...base, checkKind: 'check-complete', treeSplitEmpty: false })).toBe('tree-next-node');
    expect(cardSortWhen(exp, { ...base, checkKind: 'check-complete', finished: true })).toBe('finished');
  });
  it('다른 확인 결과와 확인 전 상황은 무리 나누기와 같다', () => {
    expect(cardSortWhen(exp, { ...base, checkKind: 'check-unobserved' })).toBe('check-unobserved');
    expect(cardSortWhen(exp, { ...base, criterion: null })).toBe('choose-criterion');
    expect(cardSortWhen(exp, base)).toBe('pick-card');
    expect(cardSortWhen(exp, { ...base, selected: 'iris' })).toBe('before-observe');
    expect(cardSortWhen(exp, { ...base, selected: 'iris', observed: ['parallel'] })).toBe('sorting');
  });
  it('tree 표시가 없으면 무리 나누기 규칙이다', () => {
    expect(cardSortWhen(exp, { ...base, tree: undefined, checkKind: 'check-complete' })).toBe('check-complete');
  });
});

describe('TutorState: 트리', () => {
  it('앱 저장소 상태에서 만들고 상황이 앱과 같다', () => {
    let s = ts.createInitialTreeState(exp);
    expect(situationOf(fromTreeState(exp, s, 'g3-plantlife'), exp)).toBe(ts.treeTutorSituation(s, exp).when);
    s = splitNode(s, 'r', 'parallel', 'parallel');
    let t = fromTreeState(exp, s, 'g3-plantlife');
    expect(t.tree).toMatchObject({ finished: false, splitEmpty: false, splits: 1 });
    expect(situationOf(t, exp)).toBe('tree-next-node');
    expect(situationOf(t, exp)).toBe(ts.treeTutorSituation(s, exp).when);
    // 부모가 쓴 기준을 한쪽이 빈 채로 확인
    s = ts.selectNode(s, 'r/yes');
    s = splitNode(s, 'r/yes', 'serrated', 'serrated');
    t = fromTreeState(exp, s, 'g3-plantlife');
    expect(t.tree!.splitEmpty).toBe(true);
    expect(situationOf(t, exp)).toBe('tree-split-empty');
    expect(situationOf(t, exp)).toBe(ts.treeTutorSituation(s, exp).when);
    // 완성
    s = splitNode(ts.selectNode(s, 'r/no'), 'r/no', 'serrated', 'serrated');
    s = splitNode(s, 'r/no/yes', 'lobed', 'lobed');
    t = fromTreeState(exp, s, 'g3-plantlife');
    expect(t.tree!.finished).toBe(true);
    expect(situationOf(t, exp)).toBe('finished');
  });
  it('입력 문장은 결정적이고 카드의 특징값·정답 무리·그물맥을 담지 않는다', () => {
    let s = ts.chooseCriterion(ts.createInitialTreeState(exp), exp, 'r', 'parallel');
    s = ts.observe(ts.selectCard(s, exp, 'iris'), exp, 'iris', 'parallel');
    s = ts.place(s, exp, 'r', 'iris', 'yes');
    const t = fromTreeState(exp, s, 'g3-plantlife');
    const unit = { title: plant.title, grade: plant.grade };
    const a = buildTutorInput(exp, t, '왜요?', unit);
    expect(a).toBe(buildTutorInput(exp, t, '왜요?', unit));
    expect(a).toContain('[지금 나누는 무리] ' + ALL.map((k) => exp.cards.find((c) => c.key === k)!.label).join(', '));
    expect(a).toContain('[나눈 횟수] 0');
    expect(a).toContain('[분류 기준] 잎맥이 나란한가요?');
    expect(a).toContain('- 붓꽃: 관찰 잎맥 · 넣은 무리 잎맥이 나란하다');
    expect(a).not.toContain('나란히 뻗어');
    expect(a).not.toContain('그물맥');
    expect(a).not.toContain('[확인 결과]');
  });
});

import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import plantJson from '../../../content/units/g3-plantlife/manifest.json';
import {
  allPlacedInNode,
  ancestorsOf,
  availableCriteria,
  checkNode,
  chooseNodeCriterion,
  createTree,
  isEmptySplit,
  isTreeFinished,
  observe,
  placeInNode,
  selectNode,
  splitCount,
  treeLeaves,
  validateCardSortExperiment,
  type TreeSide,
  type TreeState,
} from './index';

const exp = parseManifest(plantJson).experiments[0] as CardSortExperiment;
const ALL = exp.cards.map((c) => c.key);
const val = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f]!;
const critFeature = (key: string) => exp.criteria.find((c) => c.key === key)!.feature!;

/** 노드에서 기준을 고르고, 관찰하고, 특징값 그대로 넣고, 확인한다. override는 일부러 다르게 넣을 카드. */
function split(
  s: TreeState,
  node: string,
  key: string,
  opts: { observeAll?: boolean; override?: Record<string, TreeSide> } = {},
): TreeState {
  let cur = chooseNodeCriterion(s, exp, node, key);
  const f = critFeature(key);
  for (const c of cur.nodes[node]!.cards) {
    if (opts.observeAll !== false) cur = observe(cur, exp, c, f);
    cur = placeInNode(cur, exp, node, c, opts.override?.[c] ?? (val(c, f) as TreeSide));
  }
  return checkNode(cur, exp, node);
}
const fresh = () => createTree(ALL);
/** 사양 §1의 완성 트리. */
function finishedTree(): TreeState {
  let s = split(fresh(), 'r', 'parallel');
  s = split(s, 'r/no', 'serrated');
  s = split(s, 'r/no/yes', 'lobed');
  return s;
}

describe('잎 카드 표 (사양 §1)', () => {
  const TABLE: Record<string, [string, string, string]> = {
    maple: ['yes', 'yes', 'no'],
    chrysanthemum: ['yes', 'yes', 'no'],
    cherry: ['yes', 'no', 'no'],
    camellia: ['yes', 'no', 'no'],
    persimmon: ['no', 'no', 'no'],
    lilac: ['no', 'no', 'no'],
    iris: ['no', 'no', 'yes'],
    lily: ['no', 'no', 'yes'],
  };
  it('카드 8장의 특징값이 사양과 같다', () => {
    expect(exp.layout).toBe('tree');
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    expect(exp.cards.map((c) => c.label)).toEqual(['단풍나무', '국화', '벚나무', '동백나무', '감나무', '라일락', '붓꽃', '백합']);
    expect(exp.cards.map((c) => c.icon)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      expect([c.features.serrated, c.features.lobed, c.features.parallel], c.key).toEqual(TABLE[c.key]);
    }
  });
  it('기준 4가지(마지막만 주관)와 특징 3가지', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.objective])).toEqual([
      ['serrated', '잎 가장자리가 톱니 모양인가요?', true],
      ['lobed', '잎이 여러 갈래로 갈라져 있나요?', true],
      ['parallel', '잎맥이 나란한가요?', true],
      ['pretty', '잎이 예쁜가요?', false],
    ]);
    for (const c of exp.criteria) expect(c.groups.map((g) => g.value)).toEqual(['yes', 'no']);
    expect(exp.features.map((f) => f.key)).toEqual(['serrated', 'lobed', 'parallel']);
  });
  it('관찰 문장이 사양과 같다', () => {
    const o = (k: string) => exp.cards.find((c) => c.key === k)!.observations;
    expect(o('maple')).toEqual({ serrated: '가장자리에 뾰족뾰족한 톱니가 있어요.', lobed: '손바닥처럼 5~7갈래로 깊게 갈라져 있어요.', parallel: '잎맥이 손바닥 모양으로 퍼져 있어요.' });
    expect(o('chrysanthemum')).toEqual({ serrated: '갈라진 조각 끝에 톱니가 있어요.', lobed: '잎이 여러 갈래로 갈라져 있어요.', parallel: '잎맥이 그물처럼 퍼져 있어요.' });
    expect(o('cherry')).toEqual({ serrated: '가장자리에 잔 톱니가 촘촘해요.', lobed: '갈라지지 않은 둥근 달걀 모양이에요.', parallel: '가운데 잎맥에서 옆으로 잎맥이 뻗어 그물 모양이에요.' });
    expect(o('camellia')).toEqual({ serrated: '가장자리에 아주 작은 톱니가 있어요.', lobed: '갈라지지 않은 길쭉한 둥근 모양이고 반질반질해요.', parallel: '잎맥이 그물처럼 퍼져 있어요.' });
    expect(o('persimmon')).toEqual({ serrated: '가장자리가 매끈해요.', lobed: '갈라지지 않은 넓은 달걀 모양이에요.', parallel: '잎맥이 그물처럼 퍼져 있어요.' });
    expect(o('lilac')).toEqual({ serrated: '가장자리가 매끈해요.', lobed: '갈라지지 않은 하트 모양이에요.', parallel: '잎맥이 그물처럼 퍼져 있어요.' });
    expect(o('iris')).toEqual({ serrated: '가장자리가 매끈해요.', lobed: '갈라지지 않은 칼처럼 긴 모양이에요.', parallel: '잎맥이 잎 끝까지 나란히 뻗어 있어요.' });
    expect(o('lily')).toEqual({ serrated: '가장자리가 매끈해요.', lobed: '갈라지지 않은 길쭉한 모양이에요.', parallel: '잎맥이 잎 끝까지 나란히 뻗어 있어요.' });
  });
  it('매니페스트 일관성 검사를 통과하고 용어 "그물맥"은 관찰 문장에 없다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
    expect(exp.limits).toEqual(['외떡잎', '쌍떡잎', '그물맥', '나란히맥', '겹잎', '홑잎']);
    for (const c of exp.cards) for (const t of Object.values(c.observations)) expect(t).not.toContain('그물맥');
  });
});

describe('트리 기본', () => {
  it('처음에는 뿌리 하나에 카드 8장이 있고 기준은 모두 고를 수 있다', () => {
    const s = fresh();
    expect(Object.keys(s.nodes)).toEqual(['r']);
    expect(s.nodes.r!.cards).toEqual(ALL);
    expect(s.selectedNode).toBe('r');
    expect(availableCriteria(s, exp, 'r')).toEqual(['serrated', 'lobed', 'parallel', 'pretty']);
    expect(treeLeaves(s)).toEqual(['r']);
    expect(splitCount(s)).toBe(0);
    expect(isTreeFinished(s, exp)).toBe(false);
  });
  it('모르는 노드·기준·카드는 무시한다', () => {
    const s = fresh();
    expect(chooseNodeCriterion(s, exp, 'x', 'parallel')).toBe(s);
    expect(chooseNodeCriterion(s, exp, 'r', 'nope')).toBe(s);
    expect(placeInNode(s, exp, 'r', 'maple', 'yes')).toBe(s); // 기준 없음
    const c = chooseNodeCriterion(s, exp, 'r', 'parallel');
    expect(chooseNodeCriterion(c, exp, 'r', 'parallel')).toBe(c);
    expect(placeInNode(c, exp, 'r', 'nope', 'yes')).toBe(c);
    expect(placeInNode(c, exp, 'r', 'maple', 'maybe' as never)).toBe(c);
    expect(selectNode(c, 'x')).toBe(c);
    expect(selectNode(c, 'r')).toBe(c);
    expect(checkNode(s, exp, 'r')).toBe(s);
  });
  it('관찰은 공용 기록을 쓰고 중복되지 않는다', () => {
    const s = observe(fresh(), exp, 'maple', 'lobed');
    expect(s.observed).toEqual({ maple: ['lobed'] });
    expect(observe(s, exp, 'maple', 'lobed')).toBe(s);
    expect(observe(s, exp, 'nope', 'lobed')).toBe(s);
    expect(observe(s, exp, 'maple', 'nope')).toBe(s);
  });
});

describe('노드 확인', () => {
  it('우선순위: 주관 -> 안 넣음 -> 관찰 안 함 -> 관찰과 다름 -> 완료', () => {
    let s = chooseNodeCriterion(fresh(), exp, 'r', 'pretty');
    for (const c of ALL) s = placeInNode(s, exp, 'r', c, 'yes');
    expect(checkNode(s, exp, 'r').nodes.r!.checked!.kind).toBe('check-subjective');

    s = chooseNodeCriterion(fresh(), exp, 'r', 'parallel');
    s = placeInNode(s, exp, 'r', 'maple', 'no');
    expect(checkNode(s, exp, 'r').nodes.r!.checked!.kind).toBe('check-unplaced');
    expect(allPlacedInNode(s, 'r')).toBe(false);

    for (const c of ALL) s = placeInNode(s, exp, 'r', c, val(c, 'parallel') as TreeSide);
    // 관찰 안 함이 관찰과 다름보다 먼저다: 붓꽃을 일부러 틀리게 넣어도 관찰하지 않았다고 먼저 말한다.
    s = placeInNode(s, exp, 'r', 'iris', 'no');
    const unobserved = checkNode(s, exp, 'r').nodes.r!.checked!;
    expect(unobserved.kind).toBe('check-unobserved');
    expect(unobserved.items.every((i) => i.status === 'unobserved')).toBe(true);

    // 모두 관찰하면 관찰과 다른 카드만 짚는다.
    for (const c of ALL) s = observe(s, exp, c, 'parallel');
    const wrong = checkNode(s, exp, 'r').nodes.r!.checked!;
    expect(wrong.kind).toBe('check-inconsistent');
    expect(wrong.items.filter((i) => i.status === 'inconsistent').map((i) => i.card)).toEqual(['iris']);

    s = placeInNode(s, exp, 'r', 'iris', 'yes');
    expect(checkNode(s, exp, 'r').nodes.r!.checked!.kind).toBe('check-complete');
  });
  it('다른 기준의 특징을 관찰했다고 지금 기준의 관찰이 되지는 않는다', () => {
    let s = chooseNodeCriterion(fresh(), exp, 'r', 'parallel');
    for (const c of ALL) s = placeInNode(observe(s, exp, c, 'lobed'), exp, 'r', c, val(c, 'parallel') as TreeSide);
    expect(checkNode(s, exp, 'r').nodes.r!.checked!.kind).toBe('check-unobserved');
  });
  it('확인 결과는 이 노드의 카드만 다룬다', () => {
    let s = split(fresh(), 'r', 'parallel');
    s = chooseNodeCriterion(s, exp, 'r/yes', 'serrated');
    for (const c of ['iris', 'lily']) s = placeInNode(s, exp, 'r/yes', c, 'no');
    const c = checkNode(s, exp, 'r/yes').nodes['r/yes']!.checked!;
    expect(c.items.map((i) => i.card)).toEqual(['iris', 'lily']);
  });
  it('완료이고 두 쪽 모두 카드가 있으면 자식 둘이 생기고, 카드는 넣은 쪽을 따른다', () => {
    const s = split(fresh(), 'r', 'parallel');
    expect(s.nodes.r!.children).toEqual({ yes: 'r/yes', no: 'r/no' });
    expect(s.nodes['r/yes']!.cards).toEqual(['iris', 'lily']);
    expect(s.nodes['r/no']!.cards).toEqual(['maple', 'chrysanthemum', 'cherry', 'camellia', 'persimmon', 'lilac']);
    expect(treeLeaves(s)).toEqual(['r/yes', 'r/no']);
    expect(splitCount(s)).toBe(1);
    expect(ancestorsOf(s, 'r/yes')).toEqual(['r']);
    // 다시 확인해도 자식은 그대로이다.
    const again = checkNode(s, exp, 'r');
    expect(again.nodes['r/yes']).toBe(s.nodes['r/yes']);
  });
  it('한쪽이 빈 노드는 완료로 두되 자식이 없다', () => {
    let s = split(fresh(), 'r', 'parallel');
    s = split(s, 'r/yes', 'serrated'); // 붓꽃·백합은 모두 톱니가 없다
    const n = s.nodes['r/yes']!;
    expect(n.checked!.kind).toBe('check-complete');
    expect(n.children).toBeNull();
    expect(Object.keys(s.nodes).sort()).toEqual(['r', 'r/no', 'r/yes']);
    expect(isEmptySplit(s, 'r/yes')).toBe(true);
    expect(isEmptySplit(s, 'r')).toBe(false);
    expect(splitCount(s)).toBe(1);
    // 기준을 바꿀 수 있고, 바꾸면 확인 결과가 지워진다.
    const changed = chooseNodeCriterion(s, exp, 'r/yes', 'lobed');
    expect(changed.nodes['r/yes']!.criterion).toBe('lobed');
    expect(changed.nodes['r/yes']!.checked).toBeNull();
  });
});

describe('기준 선택', () => {
  it('조상이 쓴 기준은 다시 고르지 못한다', () => {
    const s = split(fresh(), 'r', 'parallel');
    expect(availableCriteria(s, exp, 'r/no')).toEqual(['serrated', 'lobed', 'pretty']);
    expect(availableCriteria(s, exp, 'r')).toEqual(['serrated', 'lobed', 'parallel', 'pretty']);
    const blocked = chooseNodeCriterion(s, exp, 'r/no', 'parallel');
    expect(blocked).toBe(s);
    const deeper = split(s, 'r/no', 'serrated');
    expect(availableCriteria(deeper, exp, 'r/no/yes')).toEqual(['lobed', 'pretty']);
    expect(chooseNodeCriterion(deeper, exp, 'r/no/yes', 'parallel')).toBe(deeper);
    expect(chooseNodeCriterion(deeper, exp, 'r/no/yes', 'serrated')).toBe(deeper);
  });
  it('기준을 바꾸면 그 노드의 넣은 카드·확인과 자손이 지워지고 관찰은 남는다', () => {
    let s = split(fresh(), 'r', 'parallel');
    s = split(s, 'r/no', 'serrated');
    expect(Object.keys(s.nodes)).toHaveLength(5);
    s = selectNode(s, 'r/no/yes');
    const changed = chooseNodeCriterion(s, exp, 'r', 'serrated');
    expect(Object.keys(changed.nodes)).toEqual(['r']);
    expect(changed.nodes.r).toMatchObject({ criterion: 'serrated', placement: {}, checked: null, children: null });
    expect(changed.selectedNode).toBe('r'); // 지워진 노드를 고르고 있었으면 바꾼 노드로
    expect(changed.observed.maple).toEqual(['parallel', 'serrated']);
    // 자손을 지우지 않는 경우에는 고른 노드를 그대로 둔다.
    const kept = chooseNodeCriterion(selectNode(s, 'r/yes'), exp, 'r/no', 'lobed');
    expect(kept.selectedNode).toBe('r/yes');
    expect(Object.keys(kept.nodes).sort()).toEqual(['r', 'r/no', 'r/yes']);
  });
  it('넣은 곳을 바꾸면 확인과 자손이 지워진다', () => {
    let s = split(fresh(), 'r', 'parallel');
    s = placeInNode(s, exp, 'r', 'iris', 'no');
    expect(Object.keys(s.nodes)).toEqual(['r']);
    expect(s.nodes.r!.checked).toBeNull();
    expect(s.nodes.r!.children).toBeNull();
  });
  it('깊이는 객관 기준 수(3)를 넘지 않는다', () => {
    const s = finishedTree();
    const depth = (id: string): number => {
      const k = s.nodes[id]!.children;
      return k ? 1 + Math.max(depth(k.yes), depth(k.no)) : 0;
    };
    expect(depth('r')).toBe(3);
    // 주관 기준은 판정이 끝나지 않아 자식을 만들지 못한다.
    let t = chooseNodeCriterion(fresh(), exp, 'r', 'pretty');
    for (const c of ALL) t = placeInNode(t, exp, 'r', c, 'yes');
    t = checkNode(t, exp, 'r');
    expect(t.nodes.r!.children).toBeNull();
  });
});

describe('완료 판정', () => {
  it('사양 §1의 완성 트리는 끝난 것이고 잎 무리는 4개다', () => {
    const s = finishedTree();
    expect(isTreeFinished(s, exp)).toBe(true);
    expect(splitCount(s)).toBe(3);
    const leaves = treeLeaves(s).map((id) => [...s.nodes[id]!.cards].sort());
    expect(leaves).toHaveLength(4);
    expect(leaves).toEqual([
      ['iris', 'lily'],
      ['chrysanthemum', 'maple'],
      ['camellia', 'cherry'],
      ['lilac', 'persimmon'],
    ]);
  });
  it('다른 순서(톱니 -> 갈라짐 / 잎맥)로 나누어도 끝난다', () => {
    let s = split(fresh(), 'r', 'serrated');
    s = split(s, 'r/yes', 'lobed');
    s = split(s, 'r/no', 'parallel');
    expect(isTreeFinished(s, exp)).toBe(true);
    // 같은 카드를 쓰는 다른 갈래: 갈라짐 -> 잎맥 -> 톱니
    let t = split(fresh(), 'r', 'lobed');
    t = split(t, 'r/no', 'parallel');
    t = split(t, 'r/no/no', 'serrated');
    expect(isTreeFinished(t, exp)).toBe(true);
  });
  it('한 단계만 나누면 끝나지 않았다', () => {
    expect(isTreeFinished(split(fresh(), 'r', 'parallel'), exp)).toBe(false);
    let s = split(fresh(), 'r', 'parallel');
    s = split(s, 'r/no', 'serrated');
    expect(isTreeFinished(s, exp)).toBe(false); // 톱니가 있는 무리가 아직 갈라짐으로 나뉘지 않았다
  });
  it('기준을 하나도 안 골랐거나 확인 전이면 끝나지 않았다', () => {
    expect(isTreeFinished(fresh(), exp)).toBe(false);
    let s = chooseNodeCriterion(fresh(), exp, 'r', 'parallel');
    for (const c of ALL) s = placeInNode(observe(s, exp, c, 'parallel'), exp, 'r', c, val(c, 'parallel') as TreeSide);
    expect(isTreeFinished(s, exp)).toBe(false);
  });
  it('나눈 노드의 확인이 check-complete가 아니면 끝나지 않았다(내부 점검)', () => {
    const s = finishedTree();
    const broken: TreeState = { ...s, nodes: { ...s.nodes, r: { ...s.nodes.r!, checked: null } } };
    expect(isTreeFinished(broken, exp)).toBe(false);
  });
  it('끝난 트리도 위의 기준을 바꾸면 다시 끝나지 않은 상태가 된다', () => {
    const s = chooseNodeCriterion(finishedTree(), exp, 'r', 'lobed');
    expect(isTreeFinished(s, exp)).toBe(false);
    expect(Object.keys(s.nodes)).toEqual(['r']);
  });
});

describe('g3-animal은 트리 코드를 건드리지 않는다', () => {
  it('동물 매니페스트의 layout은 groups이고 validate가 통과한다', () => {
    const animal = parseManifest(animalJson).experiments[0] as CardSortExperiment;
    expect(animal.layout).toBe('groups');
    expect(validateCardSortExperiment(animal)).toEqual([]);
  });
});

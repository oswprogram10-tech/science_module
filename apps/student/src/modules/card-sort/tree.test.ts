import { describe, expect, it } from 'vitest';
import { judgeCards, type SortCheck } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import plantJson from '../../../../../content/units/g3-plantlife/manifest.json';
import { createCardSortStore } from './cardSortStore';
import { FEEDBACK_IDLE, cardSortFeedback } from './feedback';
import { LEAF_ICON_KEYS } from './LeafIcons';
import { ANIMAL_ICON_KEYS } from './AnimalIcons';
import {
  checkNode,
  chooseCriterion,
  createInitialTreeState,
  isTreeFinished,
  observe,
  place,
  selectCard,
  selectNode,
  splitCount,
  treeTutorSituation,
  type TreeLabState,
} from './treeStore';

const exp = parseManifest(plantJson).experiments[0] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const truth = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f] as 'yes' | 'no';
const fresh = () => createInitialTreeState(exp);

function split(s: TreeLabState, node: string, crit: string, feature: string, wrong: Record<string, 'yes' | 'no'> = {}) {
  let cur = chooseCriterion(s, exp, node, crit);
  for (const c of cur.nodes[node]!.cards) {
    cur = observe(cur, exp, c, feature);
    cur = place(cur, exp, node, c, wrong[c] ?? truth(c, feature));
  }
  return checkNode(cur, exp, node);
}

describe('트리 저장소', () => {
  it('카드를 고르고 다시 누르면 풀고, 지금 노드의 카드만 고를 수 있다', () => {
    let s = selectCard(fresh(), exp, 'iris');
    expect(s.selected).toBe('iris');
    expect(selectCard(s, exp, 'iris').selected).toBeNull();
    expect(selectCard(s, exp, 'nope')).toBe(s);
    s = split(fresh(), 'r', 'parallel', 'parallel');
    s = selectNode(s, 'r/yes');
    expect(selectCard(s, exp, 'maple')).toBe(s); // 이 무리에 없는 카드
    expect(selectCard(s, exp, 'iris').selected).toBe('iris');
  });
  it('노드를 바꾸면 고른 카드가 풀린다', () => {
    let s = selectCard(split(fresh(), 'r', 'parallel', 'parallel'), exp, 'maple');
    s = selectNode(s, 'r/yes');
    expect(s.selectedNode).toBe('r/yes');
    expect(s.selected).toBeNull();
    expect(selectNode(s, 'r/yes')).toBe(s);
  });
  it('넣으면 고른 카드가 풀린다. 노드의 카드를 모두 넣기 전에는 확인하지 않는다', () => {
    let s = chooseCriterion(fresh(), exp, 'r', 'parallel');
    s = place(selectCard(s, exp, 'iris'), exp, 'r', 'iris', 'yes');
    expect(s.selected).toBeNull();
    expect(checkNode(s, exp, 'r')).toBe(s);
    expect(s.nodes.r!.checked).toBeNull();
  });
  it('기준을 바꾸면 자손이 지워지고 고른 노드가 지워졌으면 그 노드로 옮기며 카드도 푼다', () => {
    let s = split(split(fresh(), 'r', 'parallel', 'parallel'), 'r/no', 'serrated', 'serrated');
    s = selectCard(selectNode(s, 'r/no/yes'), exp, 'maple');
    const changed = chooseCriterion(s, exp, 'r', 'lobed');
    expect(Object.keys(changed.nodes)).toEqual(['r']);
    expect(changed.selectedNode).toBe('r');
    expect(changed.selected).toBeNull();
    expect(chooseCriterion(s, exp, 'r/no/yes', 'parallel')).toBe(s); // 조상 기준
  });
  it('저장소는 같은 상태면 구독자를 부르지 않는다', () => {
    const store = createCardSortStore();
    let n = 0;
    store.subscribe(() => n++);
    store.update((s) => s);
    expect(n).toBe(0);
  });
});

describe('피드백 문장', () => {
  it('트리에서 한쪽이 빈 확인은 "모든 잎이 한쪽으로 모였어요."', () => {
    const s = split(split(fresh(), 'r', 'parallel', 'parallel'), 'r/yes', 'serrated', 'serrated');
    expect(cardSortFeedback(exp, s.nodes['r/yes']!.checked, true)).toBe('모든 잎이 한쪽으로 모였어요.');
    expect(cardSortFeedback(exp, s.nodes.r!.checked, false)).toBe('관찰한 특징과 분류가 서로 잘 맞아요.');
    expect(cardSortFeedback(exp, null, false)).toBe(FEEDBACK_IDLE);
  });
  it('관찰 안 함은 잎 이름만, 관찰과 다름은 쪽 이름 없이 다시 비교하라고만 한다', () => {
    let s = chooseCriterion(fresh(), exp, 'r', 'parallel');
    for (const c of ALL) s = place(s, exp, 'r', c, truth(c, 'parallel'));
    expect(cardSortFeedback(exp, checkNode(s, exp, 'r').nodes.r!.checked)).toBe(
      '단풍나무, 국화, 벚나무, 동백나무, 감나무, 라일락, 붓꽃, 백합은 아직 이 기준의 특징을 살펴보지 않았어요.',
    );
    const wrong = split(fresh(), 'r', 'parallel', 'parallel', { iris: 'no' });
    expect(cardSortFeedback(exp, wrong.nodes.r!.checked)).toBe('붓꽃은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
    for (const text of [cardSortFeedback(exp, wrong.nodes.r!.checked)]) {
      expect(text).not.toContain('나란하');
      expect(text).not.toContain('잎맥');
    }
  });
});

describe('튜터 (사양 §4)', () => {
  it('상황이 순서대로 정해진다: 지금 나누는 노드의 상황이다', () => {
    let s = fresh();
    expect(treeTutorSituation(s, exp).when).toBe('choose-criterion');
    s = chooseCriterion(s, exp, 'r', 'parallel');
    expect(treeTutorSituation(s, exp).when).toBe('pick-card');
    s = selectCard(s, exp, 'iris');
    expect(treeTutorSituation(s, exp)).toEqual({ when: 'before-observe', card: '붓꽃', criterion: '잎맥이 나란한가요?' });
    s = observe(s, exp, 'iris', 'parallel');
    expect(treeTutorSituation(s, exp).when).toBe('sorting');
    s = split(fresh(), 'r', 'parallel', 'parallel');
    expect(treeTutorSituation(s, exp).when).toBe('tree-next-node');
    // 자식 노드로 옮기면 그 노드의 처음 상황이다.
    expect(treeTutorSituation(selectNode(s, 'r/no'), exp).when).toBe('choose-criterion');
  });
  it('관찰 안 함·관찰과 다름·안 넣음·주관은 카드 이름과 질문이 채워진다', () => {
    let s = chooseCriterion(fresh(), exp, 'r', 'parallel');
    for (const c of ALL) s = place(s, exp, 'r', c, truth(c, 'parallel'));
    expect(treeTutorSituation(checkNode(s, exp, 'r'), exp)).toEqual({ when: 'check-unobserved', card: '단풍나무', criterion: '잎맥이 나란한가요?' });
    const wrong = split(fresh(), 'r', 'parallel', 'parallel', { iris: 'no' });
    expect(treeTutorSituation(wrong, exp)).toEqual({ when: 'check-inconsistent', card: '붓꽃', criterion: '잎맥이 나란한가요?' });
    expect(renderAndGuard('check-inconsistent', { card: '붓꽃', criterion: '' }, exp.tutor.probes, guard)).toBe(
      '붓꽃 잎에서 관찰한 내용과 넣은 쪽을 다시 비교해 볼까요?',
    );
  });
  it('한쪽이 빈 노드는 tree-split-empty, 완성하면 finished', () => {
    let s = split(selectNode(split(fresh(), 'r', 'parallel', 'parallel'), 'r/yes'), 'r/yes', 'serrated', 'serrated');
    expect(treeTutorSituation(s, exp).when).toBe('tree-split-empty');
    expect(renderAndGuard('tree-split-empty', { card: '', criterion: '' }, exp.tutor.probes, guard)).toContain('이 질문으로는 나누어지지 않았어요');
    s = split(selectNode(s, 'r/no'), 'r/no', 'serrated', 'serrated');
    s = split(s, 'r/no/yes', 'lobed', 'lobed');
    expect(isTreeFinished(s, exp)).toBe(true);
    expect(splitCount(s)).toBe(3);
    expect(treeTutorSituation(s, exp).when).toBe('finished');
  });
  it('probe가 모든 상황을 덮는다', () => {
    const whens = exp.tutor.probes.map((p) => p.when);
    for (const w of ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unplaced', 'check-unobserved', 'check-inconsistent', 'check-complete', 'tree-split-empty', 'tree-next-node', 'finished']) {
      expect(whens).toContain(w);
    }
  });
  it('전수 가드: 모든 probe × 모든 카드 × 모든 기준(비어 있는 값 포함)이 가드를 통과하고 폴백이 아니며 "그물맥"이 없다', () => {
    const cards = ['', ...exp.cards.map((c) => c.label)];
    const crits = ['', ...exp.criteria.map((c) => c.label)];
    let n = 0;
    for (const probe of exp.tutor.probes) {
      for (const card of cards) {
        for (const criterion of crits) {
          const out = renderAndGuard(probe.when, { card, criterion }, exp.tutor.probes, guard);
          const where = `${probe.when}/${card}/${criterion}: ${out}`;
          expect(out, where).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(out, guard).ok, where).toBe(true);
          expect(out, where).not.toContain('그물맥');
          expect(out, where).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)|\(을\)/);
          n++;
        }
      }
    }
    expect(n).toBe(exp.tutor.probes.length * cards.length * crits.length);
  });
  it('모든 확인 결과(카드 × 기준 × 틀린 카드 × 관찰 여부)의 튜터 문장과 피드백이 가드를 통과한다', () => {
    const outs: string[] = [];
    for (const crit of exp.criteria) {
      for (const bad of [undefined, ...ALL]) {
        for (const observedAll of [true, false]) {
          let s = chooseCriterion(fresh(), exp, 'r', crit.key);
          for (const c of ALL) {
            if (crit.feature && observedAll) s = observe(s, exp, c, crit.feature);
            const right = crit.feature ? truth(c, crit.feature) : 'yes';
            s = place(s, exp, 'r', c, c === bad ? (right === 'yes' ? 'no' : 'yes') : right);
          }
          s = checkNode(s, exp, 'r');
          const checked = s.nodes.r!.checked as SortCheck;
          outs.push(cardSortFeedback(exp, checked, false), cardSortFeedback(exp, checked, true));
          const sit = treeTutorSituation(s, exp);
          outs.push(renderAndGuard(sit.when, { card: sit.card, criterion: sit.criterion }, exp.tutor.probes, guard));
        }
      }
    }
    // 카드 하나·전체를 라벨로 쓴 합성 결과
    for (const status of ['unobserved', 'inconsistent'] as const) {
      for (const set of [...ALL.map((c) => [c]), ALL]) {
        const kind = status === 'unobserved' ? ('check-unobserved' as const) : ('check-inconsistent' as const);
        outs.push(cardSortFeedback(exp, { kind, items: set.map((card) => ({ card, status })) }));
      }
    }
    for (const text of outs) {
      expect(guardOutput(text, guard).ok, text).toBe(true);
      expect(text, text).not.toContain('그물맥');
      expect(text, text).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)/);
      expect(text, text).not.toMatch(/(톱니가 있다|톱니가 없다|갈라져 있다|잎맥이 나란하다)/);
    }
  });
  it('금지 문장은 실제로 가드에 걸린다', () => {
    expect(exp.tutor.forbiddenAnswers).toHaveLength(7);
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
    expect(guardOutput('그물맥이라고 해요.', guard).ok).toBe(false);
  });
  it('judgeCards를 직접 써도 노드 카드만 다룬다', () => {
    const c = judgeCards(exp, exp.criteria[2]!, ['iris', 'lily'], { iris: 'yes', lily: 'yes' }, { iris: ['parallel'], lily: ['parallel'] });
    expect(c.kind).toBe('check-complete');
    expect(c.items.map((i) => i.card)).toEqual(['iris', 'lily']);
  });
});

describe('잎 그림', () => {
  it('카드마다 잎 그림이 있고 동물 그림 key와 겹치지 않는다', () => {
    for (const c of exp.cards) {
      expect(LEAF_ICON_KEYS, c.icon).toContain(c.icon);
      expect(ANIMAL_ICON_KEYS, c.icon).not.toContain(c.icon);
    }
    expect(exp.cards.map((c) => c.icon)).toEqual(['maple', 'chrysanthemum', 'cherry', 'camellia', 'persimmon', 'lilac', 'iris', 'lily']);
  });
});

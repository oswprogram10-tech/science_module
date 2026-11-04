import {
  allPlacedInNode,
  checkNode as checkTreeNode,
  chooseNodeCriterion as chooseTreeCriterion,
  createTree,
  isEmptySplit,
  isTreeFinished,
  observe as observeSort,
  placeInNode as placeTree,
  selectNode as selectTreeNode,
  splitCount,
  type TreeSide,
  type TreeState,
} from '@sci/cardsort';
import type { CardSortExperiment, CardSortProbeWhen } from '@sci/schema';
import { cardSortWhen } from '@sci/tutor';

export { isTreeFinished, splitCount };

/** 트리 판정 상태(TreeState)에 화면이 고른 카드를 더한 것. */
export interface TreeLabState extends TreeState {
  selected: string | null;
}

export function createInitialTreeState(exp: CardSortExperiment): TreeLabState {
  return { ...createTree(exp.cards.map((c) => c.key)), selected: null };
}

const hasCard = (exp: CardSortExperiment, key: string) => exp.cards.some((c) => c.key === key);

/** 카드를 고른다. 다시 누르면 푼다. 지금 나누는 노드의 카드만 고를 수 있다. */
export function selectCard(state: TreeLabState, exp: CardSortExperiment, card: string | null): TreeLabState {
  if (card !== null && (!hasCard(exp, card) || !state.nodes[state.selectedNode]?.cards.includes(card))) return state;
  const next = state.selected === card ? null : card;
  return next === state.selected ? state : { ...state, selected: next };
}

/** 지금 나누는 노드를 바꾼다. 고른 카드는 풀린다. */
export function selectNode(state: TreeLabState, nodeId: string): TreeLabState {
  const next = selectTreeNode(state, nodeId);
  return next === state ? state : { ...next, selected: null };
}

/** 노드의 기준을 고른다. 자손이 지워지면 고른 노드가 그 노드로 옮겨질 수 있다. */
export function chooseCriterion(state: TreeLabState, exp: CardSortExperiment, nodeId: string, key: string): TreeLabState {
  const next = chooseTreeCriterion(state, exp, nodeId, key);
  if (next === state) return state;
  return { ...state, ...next, selected: next.selectedNode === state.selectedNode ? state.selected : null };
}

export function observe(state: TreeLabState, exp: CardSortExperiment, card: string, feature: string): TreeLabState {
  return observeSort(state, exp, card, feature);
}

/** 카드를 노드의 한쪽에 넣거나(null이면 빼고) 고른 카드를 푼다. */
export function place(
  state: TreeLabState,
  exp: CardSortExperiment,
  nodeId: string,
  card: string,
  side: TreeSide | null,
): TreeLabState {
  const next = placeTree(state, exp, nodeId, card, side);
  return next === state ? state : { ...state, ...next, selected: null };
}

/** 노드의 모든 카드를 넣어야 확인할 수 있다. 자식 무리가 생기면 그 노드가 그대로 지금 나누는 노드다. */
export function checkNode(state: TreeLabState, exp: CardSortExperiment, nodeId: string): TreeLabState {
  if (!allPlacedInNode(state, nodeId)) return state;
  const next = checkTreeNode(state, exp, nodeId);
  return next === state ? state : { ...state, ...next };
}

/** 튜터 상자가 쓸 상황 키와 {card}·{criterion} 치환값. 지금 나누는 노드의 상황이다. */
export function treeTutorSituation(
  state: TreeLabState,
  exp: CardSortExperiment,
): { when: CardSortProbeWhen; card: string; criterion: string } {
  const node = state.nodes[state.selectedNode]!;
  const label = (key: string | null | undefined) => exp.cards.find((c) => c.key === key)?.label ?? '';
  const sel = state.selected;
  const when = cardSortWhen(exp, {
    criterion: node.criterion,
    selected: sel,
    observed: sel ? (state.observed[sel] ?? []) : [],
    checkKind: node.checked?.kind ?? null,
    finished: isTreeFinished(state, exp),
    tree: true,
    treeSplitEmpty: isEmptySplit(state, node.id),
  });
  const criterion = exp.criteria.find((c) => c.key === node.criterion)?.label ?? '';
  if (node.checked && when === node.checked.kind) {
    const bad = node.checked.items.find((i) => i.status !== 'ok');
    return { when, card: label(bad?.card ?? sel), criterion };
  }
  return { when, card: label(sel), criterion };
}

import type { CardSortExperiment } from '@sci/schema';
import { criterionOf, judgeCards, type SortCheck } from './index';

/**
 * 카드 분류 트리(layout: 'tree')의 판정 로직. 순수 함수이고 난수가 없다. React를 쓰지 않는다.
 * 노드마다 "예/아니요" 기준 하나로 그 노드의 카드를 두 무리로 나눈다. 판정은 무리 나누기와 같은 judgeCards를 쓴다.
 * 정답 무리는 판정에만 쓰고 밖으로 돌려주지 않는다.
 */

export type TreeSide = 'yes' | 'no';

export interface TreeNode {
  id: string;
  /** 이 노드(무리)에 있는 카드 key들. */
  cards: string[];
  /** 이 노드를 나누는 기준 key. */
  criterion: string | null;
  /** 카드 key -> 어느 쪽에 넣었는가. 없거나 null이면 넣지 않은 카드. */
  placement: Record<string, TreeSide | null>;
  checked: SortCheck | null;
  /** 두 쪽 모두 카드가 있는 채로 확인을 끝냈을 때만 있다. */
  children: { yes: string; no: string } | null;
}

export interface TreeState {
  nodes: Record<string, TreeNode>;
  root: string;
  /** 카드 key -> 관찰한 특징 key들. 모든 노드가 함께 쓴다. */
  observed: Record<string, string[]>;
  /** 지금 나누는 노드. */
  selectedNode: string;
}

export const TREE_ROOT = 'r';

const childId = (id: string, side: TreeSide) => `${id}/${side}`;

export function createTree(cards: readonly string[]): TreeState {
  const root: TreeNode = { id: TREE_ROOT, cards: [...cards], criterion: null, placement: {}, checked: null, children: null };
  return { nodes: { [TREE_ROOT]: root }, root: TREE_ROOT, observed: {}, selectedNode: TREE_ROOT };
}

/** 노드의 조상 노드 id들(가까운 부모부터). 없는 노드면 빈 배열. */
export function ancestorsOf(state: TreeState, nodeId: string): string[] {
  const out: string[] = [];
  let cur = nodeId;
  for (;;) {
    const parent = Object.values(state.nodes).find((n) => n.children && (n.children.yes === cur || n.children.no === cur));
    if (!parent) return out;
    out.push(parent.id);
    cur = parent.id;
  }
}

/** 노드에서 고를 수 있는 기준 key들(조상이 쓴 기준은 뺀다). 매니페스트 순서. */
export function availableCriteria(state: TreeState, exp: CardSortExperiment, nodeId: string): string[] {
  if (!state.nodes[nodeId]) return [];
  const used = new Set(ancestorsOf(state, nodeId).map((a) => state.nodes[a]!.criterion));
  return exp.criteria.filter((c) => !used.has(c.key)).map((c) => c.key);
}

/** 노드를 지금 나누는 노드로 한다. 없는 노드면 바꾸지 않는다. */
export function selectNode(state: TreeState, nodeId: string): TreeState {
  if (!state.nodes[nodeId] || state.selectedNode === nodeId) return state;
  return { ...state, selectedNode: nodeId };
}

/** 노드의 자손을 모두 지운 노드 맵을 돌려준다. */
function withoutDescendants(nodes: Record<string, TreeNode>, nodeId: string): Record<string, TreeNode> {
  const out = { ...nodes };
  const walk = (id: string) => {
    const kids = out[id]?.children;
    if (!kids) return;
    for (const k of [kids.yes, kids.no]) {
      walk(k);
      delete out[k];
    }
  };
  walk(nodeId);
  return out;
}

/** 노드를 바꾼 상태를 돌려준다. 자손을 지우면 지운 노드를 고르고 있던 selectedNode도 그 노드로 옮긴다. */
function replaceNode(state: TreeState, node: TreeNode, dropDescendants: boolean): TreeState {
  const base = dropDescendants ? withoutDescendants(state.nodes, node.id) : state.nodes;
  const nodes = { ...base, [node.id]: node };
  const selectedNode = nodes[state.selectedNode] ? state.selectedNode : node.id;
  return { ...state, nodes, selectedNode };
}

/**
 * 노드의 기준을 고른다. 조상이 쓴 기준이거나 모르는 기준이면 무시한다.
 * 바꾸면 그 노드의 넣은 카드와 확인 결과를 비우고 자손 노드를 지운다(관찰은 남는다).
 */
export function chooseNodeCriterion(state: TreeState, exp: CardSortExperiment, nodeId: string, key: string): TreeState {
  const node = state.nodes[nodeId];
  if (!node || !criterionOf(exp, key) || node.criterion === key) return state;
  if (!availableCriteria(state, exp, nodeId).includes(key)) return state;
  return replaceNode(state, { ...node, criterion: key, placement: {}, checked: null, children: null }, true);
}

/**
 * 카드를 노드의 한쪽에 넣는다(null이면 뺀다). 기준이 없거나 이 노드의 카드가 아니면 바꾸지 않는다.
 * 넣은 곳을 바꾸면 확인 결과를 비우고 자손 노드를 지운다(자손은 넣은 곳에서 나왔기 때문이다).
 */
export function placeInNode(
  state: TreeState,
  exp: CardSortExperiment,
  nodeId: string,
  card: string,
  side: TreeSide | null,
): TreeState {
  const node = state.nodes[nodeId];
  if (!node || !criterionOf(exp, node.criterion) || !node.cards.includes(card)) return state;
  if (side !== null && side !== 'yes' && side !== 'no') return state;
  if ((node.placement[card] ?? null) === side) return state;
  return replaceNode(state, { ...node, placement: { ...node.placement, [card]: side }, checked: null, children: null }, true);
}

export function allPlacedInNode(state: TreeState, nodeId: string): boolean {
  const node = state.nodes[nodeId];
  return !!node && node.cards.every((c) => (node.placement[c] ?? null) !== null);
}

/**
 * 노드 확인하기. 기존 check 규칙(judgeCards)을 이 노드의 카드에만 적용한다. 기준이 없으면 바꾸지 않는다.
 * 완료이고 두 쪽 모두 카드가 있으면 자식 노드 둘을 만든다. 한쪽이 비면 완료로 두되 자식을 만들지 않는다.
 */
export function checkNode(state: TreeState, exp: CardSortExperiment, nodeId: string): TreeState {
  const node = state.nodes[nodeId];
  const crit = node ? criterionOf(exp, node.criterion) : undefined;
  if (!node || !crit) return state;
  const checked = judgeCards(exp, crit, node.cards, node.placement, state.observed);
  if (checked.kind !== 'check-complete') return replaceNode(state, { ...node, checked }, false);
  const cardsOf = (side: TreeSide) => node.cards.filter((c) => node.placement[c] === side);
  const yes = cardsOf('yes');
  const no = cardsOf('no');
  if (yes.length === 0 || no.length === 0) return replaceNode(state, { ...node, checked, children: null }, true);
  if (node.children) return replaceNode(state, { ...node, checked }, false);
  const ids = { yes: childId(node.id, 'yes'), no: childId(node.id, 'no') };
  const blank = (id: string, cards: string[]): TreeNode => ({
    id,
    cards,
    criterion: null,
    placement: {},
    checked: null,
    children: null,
  });
  const next = replaceNode(state, { ...node, checked, children: ids }, true);
  return { ...next, nodes: { ...next.nodes, [ids.yes]: blank(ids.yes, yes), [ids.no]: blank(ids.no, no) } };
}

/** 잎 노드(자식이 없는 노드) id들. 위에서 아래로, 예 쪽이 먼저. */
export function treeLeaves(state: TreeState): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const n = state.nodes[id];
    if (!n) return;
    if (!n.children) out.push(id);
    else {
      walk(n.children.yes);
      walk(n.children.no);
    }
  };
  walk(state.root);
  return out;
}

/** 나눈 횟수: 두 쪽 모두 카드가 있게 나눈 노드의 수. */
export function splitCount(state: TreeState): number {
  return Object.values(state.nodes).filter((n) => n.children !== null).length;
}

/** 노드의 카드들이 모든 객관적 기준의 특징값이 같은가(더 나눌 수 없는가). */
export function isNodeHomogeneous(exp: CardSortExperiment, cards: readonly string[]): boolean {
  const feats = exp.criteria.filter((c) => c.objective && c.feature).map((c) => c.feature!);
  const rows = cards.map((k) => exp.cards.find((c) => c.key === k)!.features);
  return feats.every((f) => rows.every((r) => r[f] === rows[0]![f]));
}

/**
 * 완료: 모든 잎 무리의 카드가 모든 객관적 기준의 특징값이 같고, 나눈 노드(자식이 있는 노드)가 모두 check-complete.
 * 내부 판정이다. 화면은 무리별로 알려 주지 않는다.
 */
export function isTreeFinished(state: TreeState, exp: CardSortExperiment): boolean {
  const splitsOk = Object.values(state.nodes).every((n) => n.children === null || n.checked?.kind === 'check-complete');
  return splitsOk && treeLeaves(state).every((id) => isNodeHomogeneous(exp, state.nodes[id]!.cards));
}

/** 노드가 확인을 끝냈는데 한쪽이 비어 자식이 없는가. */
export function isEmptySplit(state: TreeState, nodeId: string): boolean {
  const n = state.nodes[nodeId];
  return !!n && n.checked?.kind === 'check-complete' && n.children === null;
}

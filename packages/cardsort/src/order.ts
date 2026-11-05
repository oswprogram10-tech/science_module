import type { CardSortExperiment } from '@sci/schema';
import { judgeCards, observe, type SortCheck } from './index';

/**
 * 카드 분류 순서 놓기(layout: 'order')의 판정 로직. 순수 함수이고 난수가 없다. React를 쓰지 않는다.
 * 카드를 "먼저 → 나중" 칸 1~N에 놓고(칸 번호 0부터, 0이 맨 먼저), 순서가 맞으면 같은 카드로 무리 나누기 한 단계(followUp)를 한다.
 * 순서 판정 근거는 매니페스트의 orderBy 특징(숫자)이고, 정답 칸 번호는 판정에만 쓰고 밖으로 돌려주지 않는다.
 * followUp 판정은 무리 나누기와 같은 judgeCards를 쓴다(근거 특징은 기준의 evidenceFeature).
 */

export interface OrderState {
  /** 처음 더미 순서(카드 key). 칸에 놓지 않은 카드가 이 순서로 더미에 남는다. */
  initial: string[];
  /** 칸 -> 카드 key(비면 null). 0번이 먼저 쌓인 칸이다. */
  slots: (string | null)[];
  /** 카드 key -> 관찰한 특징 key들(관찰한 순서, 중복 없음). */
  observed: Record<string, string[]>;
  /** 순서 확인 결과. 칸을 바꾸면 비운다. */
  checked: SortCheck | null;
  /** 순서를 맞춘 뒤의 무리 나누기 한 단계. */
  followUp: {
    placement: Record<string, string | null>;
    checked: SortCheck | null;
  };
}

export function createOrder(cards: readonly string[], initialOrder: readonly string[]): OrderState {
  const initial = [...initialOrder.filter((k) => cards.includes(k)), ...cards.filter((k) => !initialOrder.includes(k))];
  return {
    initial,
    slots: cards.map(() => null),
    observed: {},
    checked: null,
    followUp: { placement: {}, checked: null },
  };
}

const orderCardKeys = (state: OrderState) => state.initial;

/** 칸에 놓지 않은 카드들(처음 더미 순서). */
export function orderPile(state: OrderState): string[] {
  return state.initial.filter((k) => !state.slots.includes(k));
}

/** 모든 칸에 카드가 있는가. */
export function allSlotsFilled(state: OrderState): boolean {
  return state.slots.every((s) => s !== null);
}

/** 카드가 놓인 칸 번호(0부터). 칸에 없으면 -1. */
export function slotOf(state: OrderState, card: string): number {
  return state.slots.indexOf(card);
}

/** 칸이 바뀌면 순서와 followUp 확인 결과를 비운다. */
const withSlots = (state: OrderState, slots: (string | null)[]): OrderState => ({
  ...state,
  slots,
  checked: null,
  followUp: { ...state.followUp, checked: null },
});

/**
 * 카드를 칸에 놓는다. 다른 칸에 있으면 옮기고, 대상 칸에 다른 카드가 있으면 두 카드를 맞바꾼다
 * (카드가 더미에서 왔으면 대상 칸에 있던 카드가 더미로 돌아간다). 모르는 카드나 칸이면 바꾸지 않는다.
 */
export function placeInSlot(state: OrderState, card: string, slotIndex: number): OrderState {
  if (!orderCardKeys(state).includes(card)) return state;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.slots.length) return state;
  const from = state.slots.indexOf(card);
  if (from === slotIndex) return state;
  const slots = [...state.slots];
  const target = slots[slotIndex] ?? null;
  slots[slotIndex] = card;
  if (from >= 0) slots[from] = target;
  return withSlots(state, slots);
}

/** 카드(또는 칸 번호)를 칸에서 뺀다. 칸에 없으면 바꾸지 않는다. */
export function removeFromSlot(state: OrderState, cardOrSlot: string | number): OrderState {
  const idx = typeof cardOrSlot === 'number' ? cardOrSlot : state.slots.indexOf(cardOrSlot);
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.slots.length || state.slots[idx] === null) return state;
  const slots = [...state.slots];
  slots[idx] = null;
  return withSlots(state, slots);
}

/** 카드의 특징을 관찰한다(공유 observe). */
export function observeInOrder(state: OrderState, exp: CardSortExperiment, card: string, feature: string): OrderState {
  return observe(state, exp, card, feature);
}

const heightOf = (exp: CardSortExperiment, card: string): number =>
  Number(exp.cards.find((c) => c.key === card)!.features[exp.orderBy!.feature]);

/**
 * 순서 확인하기. 우선순위는 무리 나누기와 같다: 칸이 빈 카드 -> 높이를 관찰하지 않은 카드 -> 관찰한 높이와 어긋난 카드 -> 완료.
 * 어긋남은 이웃 칸과 높이 순서가 맞지 않는 카드를 모두 고른다. orderBy가 없으면 바꾸지 않는다.
 */
export function checkOrder(state: OrderState, exp: CardSortExperiment): OrderState {
  if (!exp.orderBy) return state;
  const feature = exp.orderBy.feature;
  const keys = exp.cards.map((c) => c.key);
  const items = (status: (card: string) => SortCheck['items'][number]['status']): SortCheck['items'] =>
    keys.map((k) => ({ card: k, status: status(k) }));
  const seen = (k: string) => (state.observed[k] ?? []).includes(feature);
  let checked: SortCheck;
  if (!allSlotsFilled(state)) {
    checked = { kind: 'check-unplaced', items: items((k) => (state.slots.includes(k) ? 'ok' : 'unplaced')) };
  } else if (keys.some((k) => !seen(k))) {
    checked = { kind: 'check-unobserved', items: items((k) => (seen(k) ? 'ok' : 'unobserved')) };
  } else {
    const before = (a: number, b: number) => (exp.orderBy!.direction === 'ascending' ? a < b : a > b);
    const hs = state.slots.map((k) => heightOf(exp, k!));
    const bad = new Set<string>();
    hs.forEach((h, i) => {
      if ((i > 0 && !before(hs[i - 1]!, h)) || (i < hs.length - 1 && !before(h, hs[i + 1]!))) bad.add(state.slots[i]!);
    });
    checked =
      bad.size > 0
        ? { kind: 'check-inconsistent', items: items((k) => (bad.has(k) ? 'inconsistent' : 'ok')) }
        : { kind: 'check-complete', items: items(() => 'ok') };
  }
  return { ...state, checked, followUp: { ...state.followUp, checked: null } };
}

/** 순서 확인을 끝냈는가(followUp이 열리는 조건). */
export function isOrderComplete(state: Pick<OrderState, 'checked'>): boolean {
  return state.checked?.kind === 'check-complete';
}

/** followUp 무리에 카드를 넣는다(null이면 뺀다). 순서를 맞추기 전이거나 모르는 카드·무리면 바꾸지 않는다. */
export function followUpPlace(state: OrderState, exp: CardSortExperiment, card: string, group: string | null): OrderState {
  const crit = exp.followUp;
  if (!crit || !isOrderComplete(state) || !exp.cards.some((c) => c.key === card)) return state;
  if (group !== null && !crit.groups.some((g) => g.value === group)) return state;
  if ((state.followUp.placement[card] ?? null) === group) return state;
  return { ...state, followUp: { placement: { ...state.followUp.placement, [card]: group }, checked: null } };
}

/** followUp에서 모든 카드를 무리에 넣었는가. */
export function followUpAllPlaced(state: OrderState, exp: CardSortExperiment): boolean {
  return exp.cards.every((c) => (state.followUp.placement[c.key] ?? null) !== null);
}

/** followUp 확인하기. judgeCards를 그대로 쓴다. 순서를 맞추기 전이거나 followUp이 없으면 무시한다. */
export function checkFollowUp(state: OrderState, exp: CardSortExperiment): OrderState {
  const crit = exp.followUp;
  if (!crit || !isOrderComplete(state)) return state;
  const checked = judgeCards(exp, crit, exp.cards.map((c) => c.key), state.followUp.placement, state.observed);
  return { ...state, followUp: { ...state.followUp, checked } };
}

/** 완료: 순서 확인이 complete이고, followUp이 있으면 그 확인도 complete. */
export function isOrderFinished(state: Pick<OrderState, 'checked' | 'followUp'>, exp: CardSortExperiment): boolean {
  return isOrderComplete(state) && (!exp.followUp || state.followUp.checked?.kind === 'check-complete');
}

/** 순서 놓기 매니페스트의 일관성 검사. 문제 문장 목록(없으면 빈 배열). */
export function validateOrderExperiment(exp: CardSortExperiment): string[] {
  const issues: string[] = [];
  const featureKeys = new Set(exp.features.map((f) => f.key));
  const dup = (what: string, keys: string[]) => {
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) issues.push(`${what} key가 겹칩니다: ${k}`);
      seen.add(k);
    }
  };
  dup('특징', exp.features.map((f) => f.key));
  dup('카드', exp.cards.map((c) => c.key));

  const by = exp.orderBy;
  if (!by) issues.push('순서 놓기에는 orderBy가 필요합니다.');
  else {
    if (!featureKeys.has(by.feature)) issues.push(`orderBy 특징 ${by.feature}가 features에 없습니다.`);
    const heights = exp.cards.map((c) => c.features[by.feature]);
    exp.cards.forEach((c, i) => {
      if (typeof heights[i] !== 'number' || !Number.isFinite(heights[i])) issues.push(`카드 ${c.key}의 ${by.feature} 값이 숫자가 아닙니다.`);
    });
    if (new Set(heights).size !== heights.length) issues.push(`orderBy 특징 ${by.feature}의 값이 카드마다 달라야 합니다.`);
  }

  const keys = exp.cards.map((c) => c.key);
  const init = exp.initialOrder;
  if (!init) issues.push('순서 놓기에는 initialOrder가 필요합니다.');
  else {
    dup('initialOrder의 카드', init);
    for (const k of keys) if (!init.includes(k)) issues.push(`initialOrder에 카드 ${k}가 없습니다.`);
    for (const k of init) if (!keys.includes(k)) issues.push(`initialOrder에 모르는 카드 ${k}가 있습니다.`);
  }

  const fu = exp.followUp;
  if (fu) {
    if (!fu.objective) issues.push('followUp은 객관적 기준이어야 합니다.');
    if (!fu.feature) issues.push('followUp에 feature가 없습니다.');
    const evidence = fu.evidenceFeature ?? fu.feature;
    if (evidence !== undefined && !featureKeys.has(evidence)) issues.push(`followUp의 근거 특징 ${evidence}가 features에 없습니다.`);
    dup('followUp의 무리', fu.groups.map((g) => g.value));
    if (fu.feature) {
      for (const c of exp.cards) {
        const v = c.features[fu.feature];
        if (v === undefined) issues.push(`카드 ${c.key}에 followUp 특징 ${fu.feature}의 값이 없습니다.`);
        else if (!fu.groups.some((g) => g.value === v)) issues.push(`카드 ${c.key}의 ${fu.feature} 값 ${v}가 followUp의 무리에 없습니다.`);
      }
    }
  }

  const known = new Set([...featureKeys, ...(fu?.feature ? [fu.feature] : [])]);
  for (const card of exp.cards) {
    for (const f of exp.features) {
      if (card.features[f.key] === undefined) issues.push(`카드 ${card.key}에 특징 ${f.key}의 값이 없습니다.`);
      if (!card.observations[f.key]) issues.push(`카드 ${card.key}에 특징 ${f.key}의 관찰 문장이 없습니다.`);
    }
    for (const k of Object.keys(card.features)) {
      if (!known.has(k)) issues.push(`카드 ${card.key}에 모르는 특징 ${k}가 있습니다.`);
    }
  }
  return issues;
}

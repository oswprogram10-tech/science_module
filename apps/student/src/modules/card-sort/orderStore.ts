import {
  allSlotsFilled,
  checkFollowUp as checkOrderFollowUp,
  checkOrder as checkOrderSlots,
  createOrder,
  followUpAllPlaced,
  followUpPlace as followUpPlaceCard,
  isOrderFinished,
  observeInOrder,
  placeInSlot as placeCardInSlot,
  removeFromSlot as removeCardFromSlot,
  type OrderState,
} from '@sci/cardsort';
import type { CardSortExperiment, CardSortProbeWhen } from '@sci/schema';
import { cardSortWhen } from '@sci/tutor';

export { allSlotsFilled, followUpAllPlaced, isOrderFinished };

/** 순서 판정 상태(OrderState)에 화면이 고른 카드를 더한 것. */
export interface OrderLabState extends OrderState {
  selected: string | null;
}

export function createInitialOrderState(exp: CardSortExperiment): OrderLabState {
  return {
    ...createOrder(exp.cards.map((c) => c.key), exp.initialOrder ?? exp.cards.map((c) => c.key)),
    selected: null,
  };
}

const hasCard = (exp: CardSortExperiment, key: string) => exp.cards.some((c) => c.key === key);

/** 카드를 고른다. 다시 누르면 푼다. */
export function select(state: OrderLabState, exp: CardSortExperiment, card: string | null): OrderLabState {
  if (card !== null && !hasCard(exp, card)) return state;
  const next = state.selected === card ? null : card;
  return next === state.selected ? state : { ...state, selected: next };
}

export function observe(state: OrderLabState, exp: CardSortExperiment, card: string, feature: string): OrderLabState {
  const next = observeInOrder(state, exp, card, feature);
  return next === state ? state : { ...state, ...next };
}

/** 카드를 칸에 놓고(다른 카드가 있으면 맞바꾸고) 고른 카드를 푼다. */
export function placeInSlot(state: OrderLabState, card: string, slotIndex: number): OrderLabState {
  const next = placeCardInSlot(state, card, slotIndex);
  return next === state ? state : { ...state, ...next, selected: null };
}

export function removeFromSlot(state: OrderLabState, card: string): OrderLabState {
  const next = removeCardFromSlot(state, card);
  return next === state ? state : { ...state, ...next, selected: null };
}

/** 모든 칸을 채워야 확인할 수 있다. */
export function checkOrder(state: OrderLabState, exp: CardSortExperiment): OrderLabState {
  if (!allSlotsFilled(state)) return state;
  const next = checkOrderSlots(state, exp);
  return next === state ? state : { ...state, ...next };
}

/** followUp 무리에 카드를 넣고(null이면 빼고) 고른 카드를 푼다. */
export function followUpPlace(state: OrderLabState, exp: CardSortExperiment, card: string, group: string | null): OrderLabState {
  const next = followUpPlaceCard(state, exp, card, group);
  return next === state ? state : { ...state, ...next, selected: null };
}

/** 모든 카드를 무리에 넣어야 확인할 수 있다. */
export function checkFollowUp(state: OrderLabState, exp: CardSortExperiment): OrderLabState {
  if (!followUpAllPlaced(state, exp)) return state;
  const next = checkOrderFollowUp(state, exp);
  return next === state ? state : { ...state, ...next };
}

/** 튜터 상자가 쓸 상황 키와 {card} 치환값. 문제가 있는 카드가 있으면 그 카드, 없으면 고른 카드. */
export function orderTutorSituation(
  state: OrderLabState,
  exp: CardSortExperiment,
): { when: CardSortProbeWhen; card: string; criterion: string } {
  const label = (key: string | null | undefined) => exp.cards.find((c) => c.key === key)?.label ?? '';
  const sel = state.selected;
  const orderCheck = state.checked?.kind ?? null;
  const followUpCheck = state.followUp.checked?.kind ?? null;
  const when = cardSortWhen(exp, {
    criterion: null,
    selected: sel,
    observed: sel ? (state.observed[sel] ?? []) : [],
    checkKind: orderCheck,
    finished: isOrderFinished(state, exp),
    order: { orderCheck, followUpCheck, feature: exp.orderBy?.feature ?? '' },
  });
  const failed = [state.checked, state.followUp.checked].find(
    (c) => c && (when === c.kind || when === `order-${c.kind}`) && c.kind !== 'check-complete',
  );
  const bad = failed?.items.find((i) => i.status !== 'ok');
  return { when, card: label(bad?.card ?? sel), criterion: '' };
}

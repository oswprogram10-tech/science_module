import {
  allPlaced,
  check as checkSort,
  chooseCriterion as chooseSortCriterion,
  createSortState,
  isFinished,
  observe as observeSort,
  place as placeSort,
  type SortState,
} from '@sci/cardsort';
import type { CardSortExperiment, CardSortProbeWhen } from '@sci/schema';
import { cardSortWhen } from '@sci/tutor';

export { allPlaced, isFinished };

/** 판정 상태(SortState)에 화면이 고른 카드를 더한 것. */
export interface CardSortState extends SortState {
  selected: string | null;
}

export function createInitialState(): CardSortState {
  return { ...createSortState(), selected: null };
}

const hasCard = (exp: CardSortExperiment, key: string) => exp.cards.some((c) => c.key === key);

/** 카드를 고른다. 다시 누르면 고른 것을 푼다. */
export function select(state: CardSortState, exp: CardSortExperiment, card: string | null): CardSortState {
  if (card !== null && !hasCard(exp, card)) return state;
  const next = state.selected === card ? null : card;
  return next === state.selected ? state : { ...state, selected: next };
}

export function chooseCriterion(state: CardSortState, exp: CardSortExperiment, key: string): CardSortState {
  const next = chooseSortCriterion(state, exp, key);
  return next === state ? state : { ...state, ...next };
}

export function observe(state: CardSortState, exp: CardSortExperiment, card: string, feature: string): CardSortState {
  const next = observeSort(state, exp, card, feature);
  return next === state ? state : { ...state, ...next };
}

/** 카드를 무리에 넣거나(null이면 빼고) 고른 카드를 푼다. */
export function place(state: CardSortState, exp: CardSortExperiment, card: string, group: string | null): CardSortState {
  const next = placeSort(state, exp, card, group);
  return next === state ? state : { ...state, ...next, selected: null };
}

/** 모든 카드를 넣어야 확인할 수 있다. */
export function check(state: CardSortState, exp: CardSortExperiment): CardSortState {
  if (!allPlaced(state, exp)) return state;
  const next = checkSort(state, exp);
  return next === state ? state : { ...state, ...next };
}

/** 튜터 상자가 쓸 상황 키와 {card}·{criterion} 치환값. */
export function tutorSituation(
  state: CardSortState,
  exp: CardSortExperiment,
): { when: CardSortProbeWhen; card: string; criterion: string } {
  const label = (key: string | null | undefined) => exp.cards.find((c) => c.key === key)?.label ?? '';
  const sel = state.selected;
  const when = cardSortWhen(exp, {
    criterion: state.criterion,
    selected: sel,
    observed: sel ? (state.observed[sel] ?? []) : [],
    checkKind: state.checked?.kind ?? null,
    finished: isFinished(state, exp),
  });
  const criterion = exp.criteria.find((c) => c.key === state.criterion)?.label ?? '';
  if (state.checked && when === state.checked.kind) {
    const bad = state.checked.items.find((i) => i.status !== 'ok');
    return { when, card: label(bad?.card ?? sel), criterion };
  }
  return { when, card: label(sel), criterion };
}

// ---- useSyncExternalStore용 얇은 저장소 ----

export interface CardSortStore {
  getState(): CardSortState;
  subscribe(listener: () => void): () => void;
  update(fn: (s: CardSortState) => CardSortState): CardSortState;
}

export function createCardSortStore(initial: CardSortState = createInitialState()): CardSortStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      const next = fn(state);
      if (next !== state) {
        state = next;
        listeners.forEach((l) => l());
      }
      return state;
    },
  };
}

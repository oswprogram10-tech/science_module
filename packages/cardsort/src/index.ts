import type { CardSortExperiment, SortCriterion } from '@sci/schema';

/**
 * 카드 분류 활동의 판정 로직. 단원과 무관한 순수 함수이고 난수가 없다. React를 쓰지 않는다.
 * 카드·기준·특징은 매니페스트(CardSortExperiment)에서 온다. 정답 무리는 판정에만 쓰고 밖으로 돌려주지 않는다.
 */

export type SortCheckKind =
  | 'check-subjective'
  | 'check-unplaced'
  | 'check-unobserved'
  | 'check-inconsistent'
  | 'check-complete';

export type SortItemStatus = 'ok' | 'unobserved' | 'inconsistent' | 'unplaced';

export interface SortCheck {
  kind: SortCheckKind;
  items: { card: string; status: SortItemStatus }[];
}

export interface SortState {
  /** 지금 기준 key. */
  criterion: string | null;
  /** 카드 key -> 관찰한 특징 key들(관찰한 순서, 중복 없음). */
  observed: Record<string, string[]>;
  /** 카드 key -> 무리 key(지금 기준의 무리). 없거나 null이면 넣지 않은 카드. */
  placement: Record<string, string | null>;
  /** 관찰에 맞게 끝낸 객관적 기준 key들(중복 없음). */
  completed: string[];
  checked: SortCheck | null;
}

/** 완료에 필요한 객관적 기준 수. */
export const REQUIRED_CRITERIA = 2;

export function createSortState(): SortState {
  return { criterion: null, observed: {}, placement: {}, completed: [], checked: null };
}

export const criterionOf = (exp: CardSortExperiment, key: string | null): SortCriterion | undefined =>
  key === null ? undefined : exp.criteria.find((c) => c.key === key);

/** 기준을 바꾼다. 넣어 둔 카드와 확인 결과는 비우고, 관찰과 끝낸 기준은 남긴다. */
export function chooseCriterion(state: SortState, exp: CardSortExperiment, key: string): SortState {
  if (!criterionOf(exp, key) || state.criterion === key) return state;
  return { ...state, criterion: key, placement: {}, checked: null };
}

/** 카드의 특징을 관찰한다. 같은 특징을 다시 관찰해도 늘지 않는다. */
export function observe(state: SortState, exp: CardSortExperiment, card: string, feature: string): SortState {
  if (!exp.cards.some((c) => c.key === card) || !exp.features.some((f) => f.key === feature)) return state;
  const prev = state.observed[card] ?? [];
  if (prev.includes(feature)) return state;
  return { ...state, observed: { ...state.observed, [card]: [...prev, feature] } };
}

/** 카드를 무리에 넣는다(null이면 뺀다). 기준이 없거나 지금 기준의 무리가 아니면 바꾸지 않는다. 무리를 옮기면 확인 결과를 비운다. */
export function place(state: SortState, exp: CardSortExperiment, card: string, group: string | null): SortState {
  const crit = criterionOf(exp, state.criterion);
  if (!crit || !exp.cards.some((c) => c.key === card)) return state;
  if (group !== null && !crit.groups.some((g) => g.value === group)) return state;
  if ((state.placement[card] ?? null) === group) return state;
  return { ...state, placement: { ...state.placement, [card]: group }, checked: null };
}

export function allPlaced(state: SortState, exp: CardSortExperiment): boolean {
  return exp.cards.every((c) => (state.placement[c.key] ?? null) !== null);
}

/** 카드가 지금 기준의 특징을 관찰했는가. 특징이 없는 기준(주관적 기준)이면 true. */
export function isObservedFor(state: SortState, exp: CardSortExperiment, card: string): boolean {
  const feature = criterionOf(exp, state.criterion)?.feature;
  return feature === undefined || (state.observed[card] ?? []).includes(feature);
}

/**
 * 확인하기. 우선순위: 주관적 기준 -> 넣지 않은 카드 -> 관찰하지 않은 카드 -> 관찰과 다른 무리 -> 완료.
 * 앞 단계에서 걸리면 거기서 끝난다. 완료면 그 기준을 completed에 넣는다. 기준이 없으면 바꾸지 않는다.
 */
export function check(state: SortState, exp: CardSortExperiment): SortState {
  const crit = criterionOf(exp, state.criterion);
  if (!crit) return state;
  const items = (status: (card: string) => SortItemStatus): SortCheck['items'] =>
    exp.cards.map((c) => ({ card: c.key, status: status(c.key) }));

  if (!crit.objective) {
    return { ...state, checked: { kind: 'check-subjective', items: items(() => 'ok') } };
  }
  const placed = (card: string) => state.placement[card] ?? null;
  if (exp.cards.some((c) => placed(c.key) === null)) {
    return { ...state, checked: { kind: 'check-unplaced', items: items((k) => (placed(k) === null ? 'unplaced' : 'ok')) } };
  }
  if (exp.cards.some((c) => !isObservedFor(state, exp, c.key))) {
    return {
      ...state,
      checked: { kind: 'check-unobserved', items: items((k) => (isObservedFor(state, exp, k) ? 'ok' : 'unobserved')) },
    };
  }
  const mismatch = (card: string) => exp.cards.find((c) => c.key === card)!.features[crit.feature!] !== placed(card);
  if (exp.cards.some((c) => mismatch(c.key))) {
    return {
      ...state,
      checked: { kind: 'check-inconsistent', items: items((k) => (mismatch(k) ? 'inconsistent' : 'ok')) },
    };
  }
  return {
    ...state,
    completed: state.completed.includes(crit.key) ? state.completed : [...state.completed, crit.key],
    checked: { kind: 'check-complete', items: items(() => 'ok') },
  };
}

/** 객관적 기준을 2개 이상 끝냈는가. */
export function isFinished(state: SortState, exp: CardSortExperiment): boolean {
  return state.completed.filter((k) => criterionOf(exp, k)?.objective).length >= REQUIRED_CRITERIA;
}

/** 매니페스트의 일관성 검사. 문제 문장 목록(없으면 빈 배열). */
export function validateCardSortExperiment(exp: CardSortExperiment): string[] {
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
  dup('기준', exp.criteria.map((c) => c.key));
  dup('카드', exp.cards.map((c) => c.key));

  let objective = 0;
  for (const c of exp.criteria) {
    if (c.objective) {
      objective++;
      if (!c.feature) issues.push(`객관적 기준 ${c.key}에 feature가 없습니다.`);
      else if (!featureKeys.has(c.feature)) issues.push(`기준 ${c.key}의 feature ${c.feature}가 features에 없습니다.`);
    } else if (c.feature !== undefined) {
      issues.push(`주관적 기준 ${c.key}에는 feature를 두지 않습니다.`);
    }
    dup(`기준 ${c.key}의 무리`, c.groups.map((g) => g.value));
  }
  if (objective < REQUIRED_CRITERIA) issues.push(`객관적 기준이 ${REQUIRED_CRITERIA}개 이상 있어야 합니다.`);

  for (const card of exp.cards) {
    for (const f of exp.features) {
      const value = card.features[f.key];
      if (value === undefined) issues.push(`카드 ${card.key}에 특징 ${f.key}의 값이 없습니다.`);
      if (!card.observations[f.key]) issues.push(`카드 ${card.key}에 특징 ${f.key}의 관찰 문장이 없습니다.`);
      if (value === undefined) continue;
      for (const c of exp.criteria) {
        if (c.feature === f.key && !c.groups.some((g) => g.value === value)) {
          issues.push(`카드 ${card.key}의 ${f.key} 값 ${value}가 기준 ${c.key}의 무리에 없습니다.`);
        }
      }
    }
    for (const k of Object.keys(card.features)) {
      if (!featureKeys.has(k)) issues.push(`카드 ${card.key}에 모르는 특징 ${k}가 있습니다.`);
    }
  }
  return issues;
}

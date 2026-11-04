import { describe, expect, it } from 'vitest';
import { check as sortCheck } from '@sci/cardsort';
import { josa } from '@sci/gateway';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import animalJson from '../../../../../content/units/g3-animal/manifest.json';
import {
  allPlaced,
  check,
  chooseCriterion,
  createCardSortStore,
  createInitialState,
  isFinished,
  observe,
  place,
  select,
  tutorSituation,
  type CardSortState,
} from './cardSortStore';
import { FEEDBACK_IDLE, cardSortFeedback } from './feedback';
import { ANIMAL_ICON_KEYS } from './AnimalIcons';

const exp = parseManifest(animalJson).experiments[0] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const truth = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f]!;

function observeAll(s: CardSortState, f: string) {
  return ALL.reduce((cur, c) => observe(cur, exp, c, f), s);
}
function placeAll(s: CardSortState, f: string, wrong: Record<string, string> = {}) {
  return ALL.reduce((cur, c) => place(cur, exp, c, wrong[c] ?? truth(c, f)), s);
}
const fresh = () => createInitialState();

describe('카드 분류 저장소', () => {
  it('카드를 고르고 다시 누르면 푼다', () => {
    let s = select(fresh(), exp, 'ant');
    expect(s.selected).toBe('ant');
    s = select(s, exp, 'ant');
    expect(s.selected).toBeNull();
    expect(select(s, exp, 'nope')).toBe(s);
  });
  it('무리에 넣으면 고른 카드가 풀리고 확인 결과가 비워진다', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = place(select(s, exp, 'ant'), exp, 'ant', 'yes');
    expect(s.selected).toBeNull();
    expect(s.placement.ant).toBe('yes');
    expect(place(s, exp, 'ant', 'yes')).toBe(s);
  });
  it('모두 넣기 전에는 확인하지 않는다', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = place(s, exp, 'ant', 'yes');
    expect(allPlaced(s, exp)).toBe(false);
    expect(check(s, exp)).toBe(s);
    expect(check(s, exp).checked).toBeNull();
  });
  it('기준을 바꾸면 무리 칸이 비고 관찰은 남는다', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = placeAll(observeAll(s, 'legs'), 'legs');
    s = chooseCriterion(s, exp, 'habitat');
    expect(s.placement).toEqual({});
    expect(s.observed.crab).toEqual(['legs']);
  });
  it('두 기준을 끝내면 isFinished', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = check(placeAll(observeAll(s, 'legs'), 'legs'), exp);
    expect(s.checked!.kind).toBe('check-complete');
    expect(isFinished(s, exp)).toBe(false);
    s = chooseCriterion(s, exp, 'habitat');
    s = check(placeAll(observeAll(s, 'habitat'), 'habitat'), exp);
    expect(isFinished(s, exp)).toBe(true);
  });
  it('저장소는 같은 상태면 구독자를 부르지 않는다', () => {
    const store = createCardSortStore();
    let n = 0;
    store.subscribe(() => n++);
    store.update((s) => s);
    store.update((s) => select(s, exp, 'cat'));
    expect(n).toBe(1);
  });
});

describe('피드백 문장 (사양 §5)', () => {
  const checked = (wrong: Record<string, string> = {}, observedAll = true) => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    if (observedAll) s = observeAll(s, 'legs');
    return check(placeAll(s, 'legs', wrong), exp);
  };
  it('확인 전에는 안내만 한다', () => {
    expect(cardSortFeedback(exp, null)).toBe(FEEDBACK_IDLE);
  });
  it('unobserved: 카드 목록과 조사', () => {
    expect(cardSortFeedback(exp, checked({}, false).checked)).toBe(
      '개미, 달팽이, 지렁이, 고양이, 붕어, 게, 참새, 나비는 아직 이 기준의 특징을 살펴보지 않았어요.',
    );
    let s = chooseCriterion(fresh(), exp, 'legs');
    for (const c of ALL.filter((k) => k !== 'cat')) s = observe(s, exp, c, 'legs');
    s = check(placeAll(s, 'legs'), exp);
    expect(cardSortFeedback(exp, s.checked)).toBe('고양이는 아직 이 기준의 특징을 살펴보지 않았어요.');
  });
  it('inconsistent: 무리 이름 없이 다시 비교하라고만 한다', () => {
    const fb = cardSortFeedback(exp, checked({ crab: 'no' }).checked);
    expect(fb).toBe('게는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
    expect(cardSortFeedback(exp, checked({ crab: 'no', ant: 'no' }).checked)).toBe(
      '개미, 게는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?',
    );
    expect(cardSortFeedback(exp, checked({ snail: 'yes' }).checked)).toBe('달팽이는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
    expect(cardSortFeedback(exp, checked({ earthworm: 'yes' }).checked)).toBe('지렁이는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
    expect(cardSortFeedback(exp, checked({ crucian: 'yes' }).checked)).toContain('붕어는 ');
    expect(cardSortFeedback(exp, checked({ crucian: 'yes', ant: 'no', cat: 'no' }).checked)).toContain('개미, 고양이, 붕어는 ');
  });
  it('complete', () => {
    expect(cardSortFeedback(exp, checked().checked)).toBe('관찰한 특징과 분류가 서로 잘 맞아요.');
  });
  it('subjective와 unplaced (판정 함수 결과를 직접 쓴다)', () => {
    const subj = sortCheck(chooseCriterion(fresh(), exp, 'cute'), exp);
    expect(cardSortFeedback(exp, subj.checked)).toBe('이 기준은 사람마다 다르게 나눌 수 있어요. 누가 나누어도 같은 결과가 나오는 기준을 골라 볼까요?');
    const unplaced = sortCheck(place(chooseCriterion(fresh(), exp, 'legs'), exp, 'ant', 'yes'), exp);
    expect(unplaced.checked!.kind).toBe('check-unplaced');
    expect(cardSortFeedback(exp, unplaced.checked)).toBe('아직 무리에 넣지 않은 카드가 있어요. 모든 카드를 넣어 볼까요?');
  });
  it('전수 가드: 어떤 확인 결과의 피드백도 정답 누설 구절과 제한 용어에 걸리지 않는다', () => {
    const kinds: Array<ReturnType<typeof checked>['checked']> = [];
    for (const crit of ['habitat', 'legs', 'wings', 'cute']) {
      const f = exp.criteria.find((c) => c.key === crit)!.feature;
      for (const bad of [undefined, ...ALL]) {
        for (const observedAll of [true, false]) {
          let s = chooseCriterion(fresh(), exp, crit);
          if (f && observedAll) s = observeAll(s, f);
          const groups = exp.criteria.find((c) => c.key === crit)!.groups.map((g) => g.value);
          s = ALL.reduce((cur, c) => place(cur, exp, c, f ? (c === bad ? groups.find((g) => g !== truth(c, f))! : truth(c, f)) : groups[0]!), s);
          kinds.push(sortCheck(s, exp).checked);
        }
      }
    }
    // 카드 하나씩 + 전체 목록을 라벨로 쓴 경우를 모두 합성한다.
    const synthetic = ['unobserved', 'inconsistent'].flatMap((status) => {
      const sets = [...ALL.map((c) => [c]), ALL];
      return sets.map((set) => ({
        kind: status === 'unobserved' ? ('check-unobserved' as const) : ('check-inconsistent' as const),
        items: set.map((card) => ({ card, status: status as 'unobserved' | 'inconsistent' })),
      }));
    });
    for (const c of [...kinds, ...synthetic, null]) {
      const text = cardSortFeedback(exp, c);
      expect(guardOutput(text, guard).ok, text).toBe(true);
      expect(text).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)/);
    }
  });
});

describe('튜터 (사양 §4)', () => {
  it('상황이 순서대로 정해진다', () => {
    let s = fresh();
    expect(tutorSituation(s, exp).when).toBe('choose-criterion');
    s = chooseCriterion(s, exp, 'legs');
    expect(tutorSituation(s, exp).when).toBe('pick-card');
    s = select(s, exp, 'crab');
    expect(tutorSituation(s, exp)).toEqual({ when: 'before-observe', card: '게', criterion: '다리가 있나요?' });
    s = observe(s, exp, 'crab', 'habitat');
    expect(tutorSituation(s, exp).when).toBe('before-observe'); // 다른 특징을 관찰해도 지금 기준의 특징이 아님
    s = observe(s, exp, 'crab', 'legs');
    expect(tutorSituation(s, exp).when).toBe('sorting');
    expect(tutorSituation(select(chooseCriterion(fresh(), exp, 'cute'), exp, 'cat'), exp).when).toBe('sorting');
  });
  it('확인 결과 상황에는 문제 카드 이름이 들어간다', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = check(placeAll(observeAll(s, 'legs'), 'legs', { crab: 'no' }), exp);
    expect(tutorSituation(s, exp)).toEqual({ when: 'check-inconsistent', card: '게', criterion: '다리가 있나요?' });
    const text = renderAndGuard('check-inconsistent', { card: '게', criterion: '다리가 있나요?' }, exp.tutor.probes, guard);
    expect(text).toBe('게에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
  it('두 기준을 끝낸 확인은 finished', () => {
    let s = chooseCriterion(fresh(), exp, 'legs');
    s = check(placeAll(observeAll(s, 'legs'), 'legs'), exp);
    expect(tutorSituation(s, exp).when).toBe('check-complete');
    s = chooseCriterion(s, exp, 'habitat');
    s = check(placeAll(observeAll(s, 'habitat'), 'habitat'), exp);
    expect(tutorSituation(s, exp).when).toBe('finished');
  });
  it('probe가 모든 상황을 덮는다', () => {
    const whens = exp.tutor.probes.map((p) => p.when);
    for (const w of ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unplaced', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished']) {
      expect(whens).toContain(w);
    }
  });
  it('전수 가드: 모든 probe × 모든 카드 × 모든 기준 라벨이 가드를 통과하고 폴백이 아니다', () => {
    for (const probe of exp.tutor.probes) {
      for (const card of exp.cards) {
        for (const crit of exp.criteria) {
          const out = renderAndGuard(probe.when, { card: card.label, criterion: crit.label }, exp.tutor.probes, guard);
          const where = `${probe.when}/${card.label}/${crit.label}: ${out}`;
          expect(out, where).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(out, guard).ok, where).toBe(true);
          expect(out, where).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)|\(을\)/);
        }
      }
    }
  });
  it('check-subjective 문장은 귀여운가 금지 구절에 걸리지 않는다', () => {
    const out = renderAndGuard('check-subjective', { card: '고양이', criterion: '귀여운가요?' }, exp.tutor.probes, guard);
    expect(out).toBe("'귀여운가요?'로 나누면 친구와 내 결과가 같을까요? 누가 나누어도 같게 나오는 기준인지 생각해 볼까요?");
  });
  it('금지 문장은 실제로 가드에 걸린다', () => {
    expect(exp.tutor.forbiddenAnswers).toHaveLength(9);
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('josa 보조 확인: 카드 이름 뒤 조사', () => {
    expect(josa('게', '은/는')).toBe('는');
    expect(josa('붕어', '은/는')).toBe('는');
  });
});

describe('동물 그림', () => {
  it('카드마다 그림이 있다', () => {
    for (const c of exp.cards) expect(ANIMAL_ICON_KEYS, c.icon).toContain(c.icon);
    expect(exp.cards.map((c) => c.icon)).toEqual(['ant', 'snail', 'earthworm', 'cat', 'crucian', 'crab', 'sparrow', 'butterfly']);
  });
});

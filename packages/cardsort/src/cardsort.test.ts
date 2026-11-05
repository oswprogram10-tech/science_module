import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import {
  allPlaced,
  check,
  chooseCriterion,
  createSortState,
  isFinished,
  isObservedFor,
  observe,
  place,
  validateCardSortExperiment,
  type SortState,
} from './index';

const exp = parseManifest(animalJson).experiments[0] as CardSortExperiment;
const ALL = exp.cards.map((c) => c.key);
const feat = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f] as string | undefined;

/** 모든 카드의 특징을 관찰하고 특징값 그대로 무리에 넣은 상태(기준 하나). */
function fullyDone(criterion: string, base: SortState = createSortState()): SortState {
  let s = chooseCriterion(base, exp, criterion);
  const f = exp.criteria.find((c) => c.key === criterion)!.feature!;
  for (const c of ALL) s = place(observe(s, exp, c, f), exp, c, feat(c, f)!);
  return s;
}

describe('특징표 (사양 §1)', () => {
  const TABLE: Record<string, [string, string, string]> = {
    ant: ['land', 'yes', 'no'],
    snail: ['land', 'no', 'no'],
    earthworm: ['land', 'no', 'no'],
    cat: ['land', 'yes', 'no'],
    crucian: ['water', 'no', 'no'],
    crab: ['water', 'yes', 'no'],
    sparrow: ['air', 'yes', 'yes'],
    butterfly: ['air', 'yes', 'yes'],
  };
  it('카드 8장의 특징값이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    expect(exp.cards.map((c) => c.label)).toEqual(['개미', '달팽이', '지렁이', '고양이', '붕어', '게', '참새', '나비']);
    for (const c of exp.cards) {
      expect([c.features.habitat, c.features.legs, c.features.wings], c.key).toEqual(TABLE[c.key]);
    }
  });
  it('관찰 문장이 사양과 같다', () => {
    const o = (k: string) => exp.cards.find((c) => c.key === k)!.observations;
    expect(o('ant')).toEqual({ habitat: '땅 위와 땅속 굴을 오가며 살아요.', legs: '다리가 6개 있어요.', wings: '일개미에게는 날개가 없어요.' });
    expect(o('snail')).toEqual({ habitat: '축축한 땅 위나 풀잎에서 살아요.', legs: '다리가 없어요. 배발로 미끄러지듯 기어가요.', wings: '날개가 없어요.' });
    expect(o('earthworm')).toEqual({ habitat: '땅속에서 흙을 먹으며 살아요.', legs: '다리가 없어요. 몸을 늘였다 줄였다 하며 움직여요.', wings: '날개가 없어요.' });
    expect(o('cat')).toEqual({ habitat: '땅 위에서 걷고 뛰며 살아요.', legs: '다리가 4개 있어요.', wings: '날개가 없어요.' });
    expect(o('crucian')).toEqual({ habitat: '강이나 연못 물속에서 살아요.', legs: '다리가 없어요. 지느러미로 헤엄쳐요.', wings: '날개가 없어요.' });
    expect(o('crab')).toEqual({ habitat: '바닷가 물속과 갯벌에서 살아요. 아가미로 숨을 쉬어요.', legs: '다리가 10개 있어요. 그중 2개는 집게다리예요.', wings: '날개가 없어요.' });
    expect(o('sparrow')).toEqual({ habitat: '날개로 하늘을 날아다니며 살아요.', legs: '다리가 2개 있어요.', wings: '날개가 2개 있어요. 깃털로 덮여 있어요.' });
    expect(o('butterfly')).toEqual({ habitat: '날개로 꽃 사이를 날아다니며 살아요.', legs: '다리가 6개 있어요.', wings: '날개가 4장 있어요. 가루 같은 비늘로 덮여 있어요.' });
  });
  it('기준 4가지: 객관적 3개와 주관적 1개', () => {
    expect(exp.criteria.map((c) => [c.key, c.objective])).toEqual([['habitat', true], ['legs', true], ['wings', true], ['cute', false]]);
    expect(exp.criteria[3]!.feature).toBeUndefined();
    expect(exp.criteria[0]!.groups.map((g) => g.value)).toEqual(['land', 'water', 'air']);
  });
  it('매니페스트가 validate를 통과한다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
  });
});

describe('상태 전이', () => {
  it('초기 상태는 비어 있다', () => {
    expect(createSortState()).toEqual({ criterion: null, observed: {}, placement: {}, completed: [], checked: null });
  });
  it('observe: 같은 특징을 다시 관찰해도 늘지 않고, 순서를 유지한다', () => {
    let s = observe(createSortState(), exp, 'crab', 'legs');
    s = observe(s, exp, 'crab', 'habitat');
    const again = observe(s, exp, 'crab', 'legs');
    expect(again).toBe(s);
    expect(s.observed.crab).toEqual(['legs', 'habitat']);
    expect(observe(s, exp, 'nope', 'legs')).toBe(s);
    expect(observe(s, exp, 'crab', 'nope')).toBe(s);
  });
  it('place: 기준이 없거나 그 기준의 무리가 아니면 바꾸지 않는다', () => {
    const s0 = createSortState();
    expect(place(s0, exp, 'crab', 'yes')).toBe(s0);
    const s1 = chooseCriterion(s0, exp, 'legs');
    expect(place(s1, exp, 'crab', 'land')).toBe(s1);
    expect(place(s1, exp, 'nope', 'yes')).toBe(s1);
    const s2 = place(s1, exp, 'crab', 'yes');
    expect(s2.placement.crab).toBe('yes');
    expect(place(s2, exp, 'crab', null).placement.crab).toBeNull();
  });
  it('place: 무리를 옮기면 확인 결과를 비운다', () => {
    let s = fullyDone('legs');
    s = check(s, exp);
    expect(s.checked).not.toBeNull();
    s = place(s, exp, 'crab', 'no');
    expect(s.checked).toBeNull();
  });
  it('기준을 바꾸면 placement와 checked는 비우고 observed와 completed는 남긴다', () => {
    let s = check(fullyDone('legs'), exp);
    expect(s.completed).toEqual(['legs']);
    s = chooseCriterion(s, exp, 'habitat');
    expect(s.placement).toEqual({});
    expect(s.checked).toBeNull();
    expect(s.completed).toEqual(['legs']);
    expect(s.observed.crab).toEqual(['legs']);
    expect(chooseCriterion(s, exp, 'habitat')).toBe(s);
    expect(chooseCriterion(s, exp, 'nope')).toBe(s);
  });
  it('allPlaced와 isObservedFor', () => {
    let s = chooseCriterion(createSortState(), exp, 'legs');
    expect(allPlaced(s, exp)).toBe(false);
    expect(isObservedFor(s, exp, 'ant')).toBe(false);
    s = observe(s, exp, 'ant', 'wings');
    expect(isObservedFor(s, exp, 'ant')).toBe(false);
    s = observe(s, exp, 'ant', 'legs');
    expect(isObservedFor(s, exp, 'ant')).toBe(true);
    expect(isObservedFor(chooseCriterion(s, exp, 'cute'), exp, 'cat')).toBe(true);
  });
});

describe('check 우선순위', () => {
  it('기준이 없으면 바꾸지 않는다', () => {
    const s = createSortState();
    expect(check(s, exp)).toBe(s);
  });
  it('1. 주관적 기준이면 check-subjective: 모두 ok이고 completed에 넣지 않는다 (넣지 않은 카드가 있어도)', () => {
    let s = chooseCriterion(createSortState(), exp, 'cute');
    s = check(s, exp);
    expect(s.checked!.kind).toBe('check-subjective');
    expect(s.checked!.items.every((i) => i.status === 'ok')).toBe(true);
    expect(s.completed).toEqual([]);
    for (const c of ALL) s = place(s, exp, c, 'cute');
    s = check(s, exp);
    expect(s.checked!.kind).toBe('check-subjective');
    expect(s.completed).toEqual([]);
  });
  it('2. 넣지 않은 카드가 있으면 check-unplaced (관찰 부족보다 먼저)', () => {
    let s = chooseCriterion(createSortState(), exp, 'legs');
    s = place(s, exp, 'ant', 'yes');
    s = check(s, exp);
    expect(s.checked!.kind).toBe('check-unplaced');
    expect(s.checked!.items.filter((i) => i.status === 'unplaced')).toHaveLength(7);
    expect(s.checked!.items.find((i) => i.card === 'ant')!.status).toBe('ok');
    expect(s.completed).toEqual([]);
  });
  it('3. 관찰하지 않은 카드가 있으면 check-unobserved (불일치보다 먼저)', () => {
    let s = chooseCriterion(createSortState(), exp, 'legs');
    for (const c of ALL) s = place(s, exp, c, 'yes'); // 일부는 특징과 다르게 넣음
    s = observe(s, exp, 'ant', 'legs');
    s = check(s, exp);
    expect(s.checked!.kind).toBe('check-unobserved');
    expect(s.checked!.items.filter((i) => i.status === 'unobserved').map((i) => i.card)).toEqual(ALL.filter((c) => c !== 'ant'));
    expect(s.checked!.items.find((i) => i.card === 'ant')!.status).toBe('ok');
    expect(s.completed).toEqual([]);
  });
  it('3. 다른 특징만 관찰한 카드도 unobserved이다', () => {
    let s = fullyDone('legs');
    s = chooseCriterion(s, exp, 'wings');
    for (const c of ALL) s = place(s, exp, c, feat(c, 'wings')!);
    expect(check(s, exp).checked!.kind).toBe('check-unobserved');
  });
  it('4. 관찰했지만 무리가 다른 카드가 있으면 check-inconsistent', () => {
    let s = fullyDone('legs');
    s = place(s, exp, 'crab', 'no'); // 게를 "다리가 없다"에
    s = check(s, exp);
    expect(s.checked!.kind).toBe('check-inconsistent');
    expect(s.checked!.items.filter((i) => i.status === 'inconsistent').map((i) => i.card)).toEqual(['crab']);
    expect(s.completed).toEqual([]);
    s = check(place(s, exp, 'crab', 'yes'), exp);
    expect(s.checked!.kind).toBe('check-complete');
  });
  it('5. 모두 맞으면 check-complete이고 기준을 completed에 넣는다 (중복 없음)', () => {
    let s = check(fullyDone('habitat'), exp);
    expect(s.checked!.kind).toBe('check-complete');
    expect(s.checked!.items.every((i) => i.status === 'ok')).toBe(true);
    expect(s.completed).toEqual(['habitat']);
    s = check(s, exp);
    expect(s.completed).toEqual(['habitat']);
  });
  it('날개 기준: 나비는 날개가 있는 쪽 (오개념을 흔드는 카드)', () => {
    const s = check(fullyDone('wings'), exp);
    expect(s.checked!.kind).toBe('check-complete');
    expect(s.placement.butterfly).toBe('yes');
    expect(s.placement.ant).toBe('no');
  });
});

describe('완료 조건', () => {
  it('객관적 기준 하나는 끝이 아니다', () => {
    expect(isFinished(check(fullyDone('legs'), exp), exp)).toBe(false);
  });
  it('주관적 기준은 완료에 들어가지 않는다', () => {
    let s = check(fullyDone('legs'), exp);
    s = chooseCriterion(s, exp, 'cute');
    for (const c of ALL) s = place(s, exp, c, 'cute');
    s = check(s, exp);
    expect(s.completed).toEqual(['legs']);
    expect(isFinished(s, exp)).toBe(false);
  });
  it('객관적 기준 2개를 끝내면 isFinished', () => {
    let s = check(fullyDone('legs'), exp);
    s = check(fullyDone('habitat', s), exp);
    expect(s.completed).toEqual(['legs', 'habitat']);
    expect(isFinished(s, exp)).toBe(true);
  });
  it('completed에 주관적 기준 key가 섞여도 세지 않는다', () => {
    expect(isFinished({ ...createSortState(), completed: ['cute', 'legs'] }, exp)).toBe(false);
  });
});

describe('validateCardSortExperiment', () => {
  const clone = (): CardSortExperiment => JSON.parse(JSON.stringify(exp));
  it('객관적 기준의 feature가 features에 없으면 거른다', () => {
    const bad = clone();
    bad.criteria[1]!.feature = 'ghost';
    expect(validateCardSortExperiment(bad).join()).toContain('ghost');
  });
  it('객관적 기준에 feature가 없으면 거른다', () => {
    const bad = clone();
    delete bad.criteria[1]!.feature;
    expect(validateCardSortExperiment(bad).join()).toContain('feature가 없습니다');
  });
  it('카드에 특징값이나 관찰 문장이 빠지면 거른다', () => {
    const noValue = clone();
    delete noValue.cards[0]!.features.legs;
    expect(validateCardSortExperiment(noValue).join()).toContain('ant에 특징 legs의 값이 없습니다');
    const noText = clone();
    delete noText.cards[2]!.observations.wings;
    expect(validateCardSortExperiment(noText).join()).toContain('earthworm에 특징 wings의 관찰 문장이 없습니다');
  });
  it('특징값이 기준의 무리 value에 없으면 거른다', () => {
    const bad = clone();
    bad.cards[5]!.features.habitat = 'sea';
    expect(validateCardSortExperiment(bad).join()).toContain('sea');
  });
  it('주관적 기준에 feature가 있으면 거른다', () => {
    const bad = clone();
    bad.criteria[3]!.feature = 'legs';
    expect(validateCardSortExperiment(bad).join()).toContain('주관적 기준 cute');
  });
  it('객관적 기준이 2개 미만이면 거른다', () => {
    const bad = clone();
    bad.criteria = bad.criteria.filter((c) => c.key === 'habitat' || c.key === 'cute');
    expect(validateCardSortExperiment(bad).join()).toContain('객관적 기준이 2개 이상');
  });
  it('key가 겹치면 거른다', () => {
    const bad = clone();
    bad.cards[1]!.key = 'ant';
    expect(validateCardSortExperiment(bad).join()).toContain('카드 key가 겹칩니다');
  });
});

import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import * as cs from '../../../apps/student/src/modules/card-sort/cardSortStore';
import { buildTutorInput, fromCardSortState, situationOf } from './context';
import { cardSortWhen } from './situation';

const animal = parseManifest(animalJson);
const exp = animal.experiments[0] as CardSortExperiment;
const ALL = exp.cards.map((c) => c.key);

describe('cardSortWhen', () => {
  const base = { criterion: null, selected: null, observed: [], checkKind: null, finished: false };
  it('위에서부터 첫 규칙', () => {
    expect(cardSortWhen(exp, base)).toBe('choose-criterion');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs' })).toBe('pick-card');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', selected: 'ant' })).toBe('before-observe');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', selected: 'ant', observed: ['wings'] })).toBe('before-observe');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', selected: 'ant', observed: ['legs'] })).toBe('sorting');
    expect(cardSortWhen(exp, { ...base, criterion: 'cute', selected: 'ant' })).toBe('sorting');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', checkKind: 'check-unobserved' })).toBe('check-unobserved');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', checkKind: 'check-complete' })).toBe('check-complete');
    expect(cardSortWhen(exp, { ...base, criterion: 'legs', checkKind: 'check-complete', finished: true })).toBe('finished');
    expect(cardSortWhen(exp, { ...base, criterion: 'cute', checkKind: 'check-subjective', finished: true })).toBe('check-subjective');
  });
});

describe('TutorState: card-sort', () => {
  it('앱 저장소 상태에서 만들고 상황이 앱과 같다', () => {
    let s = cs.chooseCriterion(cs.createInitialState(), exp, 'legs');
    s = cs.select(s, exp, 'crab');
    s = cs.observe(s, exp, 'crab', 'legs');
    s = cs.place(s, exp, 'crab', 'no');
    const t = fromCardSortState(exp, s, 'g3-animal');
    expect(t.kind).toBe('card-sort');
    expect(situationOf(t, exp)).toBe(cs.tutorSituation(s, exp).when);
    for (const c of ALL) s = cs.observe(s, exp, c, 'legs');
    for (const c of ALL) s = cs.place(s, exp, c, c === 'crab' ? 'no' : (exp.cards.find((x) => x.key === c)!.features.legs as string));
    s = cs.check(s, exp);
    const t2 = fromCardSortState(exp, s, 'g3-animal');
    expect(situationOf(t2, exp)).toBe('check-inconsistent');
  });
  it('입력 문장은 결정적이고 카드의 특징값이나 정답 무리를 담지 않는다', () => {
    let s = cs.chooseCriterion(cs.createInitialState(), exp, 'legs');
    s = cs.observe(cs.select(s, exp, 'crab'), exp, 'crab', 'legs');
    s = cs.place(s, exp, 'crab', 'no');
    const t = fromCardSortState(exp, s, 'g3-animal');
    const a = buildTutorInput(exp, t, '왜요?', { title: animal.title, grade: animal.grade });
    expect(a).toBe(buildTutorInput(exp, t, '왜요?', { title: animal.title, grade: animal.grade }));
    expect(a).toContain('[분류 기준] 다리가 있나요?');
    expect(a).toContain('- 게: 관찰 다리 · 넣은 무리 다리가 없다');
    expect(a).not.toContain('집게');
    expect(a).not.toContain('[확인 결과]');
  });
  it('다른 활동의 상태를 넘기면 거부한다', () => {
    const t = fromCardSortState(exp, cs.createInitialState(), 'g3-animal');
    expect(() => situationOf(t, { ...exp, module: 'sky-observation' } as never)).toThrow();
  });
});

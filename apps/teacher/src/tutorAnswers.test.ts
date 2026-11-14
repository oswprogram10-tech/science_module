import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countAnswerEdits, tutorEditsSchema, type TutorEdits } from '@sci/classroom';
import { buildCatalog, type CatalogUnit } from './tutorCatalog';
import { answerFromDraft, checkAnswer, draftFromEdits, draftToEdits, exportJson, hasInvalid, importEdits, parseKeys, splitWords, toDraftAnswer, type Draft, type DraftAnswer } from './tutorDraft';

// 결론 알아보기(answers) 편집(사양 tutor-dialogue-v1 §7).
const motion = JSON.parse(readFileSync(join(__dirname, '../../../content/units/g6-motion/manifest.json'), 'utf8')) as { experiments: { id: string; tutor: Record<string, unknown> }[] };
const DEFAULT = { iv: 'heightCm', conclusion: '출발 높이가 높을수록 수레가 빨라진다.', keys: [['높', '많'], ['빨', '빠르']], not: ['느려'], confirm: '네, 결과표에서도 높이가 높은 시행의 시간이 짧았어요.' };
const withDefaults = (): CatalogUnit[] => {
  const copy = structuredClone(motion) as typeof motion;
  copy.experiments.find((e) => e.id === 'ramp-cart')!.tutor.answers = [DEFAULT];
  return buildCatalog([{ ...copy, id: 'g6-motion', title: '물체의 운동', grade: 6 }]);
};
// 기본 결론이 없는 카탈로그(매니페스트의 tutor.answers를 지운 것).
const EMPTY = (() => {
  const m = JSON.parse(readFileSync(join(__dirname, '../../../content/units/g6-motion/manifest.json'), 'utf8')) as { experiments: { tutor: { answers?: unknown } }[] };
  for (const e of m.experiments) delete e.tutor.answers;
  return buildCatalog([m as never]);
})();
const exp = (c: CatalogUnit[]) => c[0]!.experiments.find((e) => e.id === 'ramp-cart')!;

const NEW: DraftAnswer = { iv: 'floor', conclusion: '바닥이 거칠면 느려진다.', keysText: '바닥, 거칠\n느려, 느리', notText: '빨라', confirm: '네, 결과표에서도 거친 바닥의 시간이 길었어요.' };
const draftOf = (answers: DraftAnswer[]): Draft => ({ 'g6-motion': { 'ramp-cart': { changed: {}, added: [], answers } } });

describe('카탈로그: 기본 결론', () => {
  it('매니페스트에 tutor.answers가 없으면 빈 배열이다(아직 콘텐츠가 없어도 동작한다)', () => {
    const e = exp(EMPTY);
    expect(e.answers).toEqual([]);
    expect(Array.isArray(e.answers)).toBe(true);
  });
  it('있으면 읽는다, 모양이 틀린 항목은 건너뛴다', () => {
    expect(exp(withDefaults()).answers).toEqual([DEFAULT]);
    const copy = structuredClone(motion) as typeof motion;
    copy.experiments.find((e) => e.id === 'ramp-cart')!.tutor.answers = [DEFAULT, { conclusion: 'x' }, 3, { ...DEFAULT, keys: [] }];
    expect(exp(buildCatalog([{ ...copy, id: 'g6-motion', title: '물체의 운동', grade: 6 }])).answers).toEqual([DEFAULT]);
  });
  it('변인 실험이 아닌 활동은 answers가 비어 있다', () => {
    const c = buildCatalog([JSON.parse(readFileSync(join(__dirname, '../../../content/units/g5-strata/manifest.json'), 'utf8'))]);
    for (const e of c[0]!.experiments) if (e.kind !== 'variable') expect(e.answers).toEqual([]);
  });
});

describe('결론 한 줄 읽기·검사', () => {
  it('낱말은 쉼표로, 묶음은 줄로 나눈다(빈 칸·공백 제거)', () => {
    expect(splitWords(' 높, 많 ,, 빠르 ，빨')).toEqual(['높', '많', '빠르', '빨']);
    expect(parseKeys('높, 많\n\n 빨 \n , ')).toEqual([['높', '많'], ['빨']]);
  });
  it('저장 모양으로: 제외 낱말이 없으면 not을 뺀다', () => {
    expect(answerFromDraft(NEW)).toEqual({ iv: 'floor', conclusion: NEW.conclusion, keys: [['바닥', '거칠'], ['느려', '느리']], not: ['빨라'], confirm: NEW.confirm });
    expect(answerFromDraft({ ...NEW, iv: undefined, notText: ' ' })).toEqual({ conclusion: NEW.conclusion, keys: [['바닥', '거칠'], ['느려', '느리']], confirm: NEW.confirm });
    expect(answerFromDraft(toDraftAnswer(DEFAULT))).toEqual(DEFAULT);
  });
  it('통과하는 줄은 문제가 없다', () => {
    expect(checkAnswer(NEW)).toEqual([]);
  });
  it('확인 문장에 판정 낱말(정답·틀렸·맞았·잘했어·오답)이 있으면 막고 이유를 알린다', () => {
    for (const w of ['정답', '틀렸', '맞았', '잘했어', '오답']) {
      const m = checkAnswer({ ...NEW, confirm: `네, ${w}이에요.` });
      expect(m, w).toHaveLength(1);
      expect(m[0], w).toContain(`‘${w}’`);
    }
  });
  it('빈 칸·길이·개수 제한', () => {
    expect(checkAnswer({ ...NEW, conclusion: ' ' })).toContain('결론을 입력해 주세요');
    expect(checkAnswer({ ...NEW, keysText: ' \n , ' })).toContain('낱말 묶음을 한 줄 이상 써 주세요');
    expect(checkAnswer({ ...NEW, keysText: Array.from({ length: 7 }, () => 'a').join('\n') })).toContain('낱말 묶음은 6줄까지예요');
    expect(checkAnswer({ ...NEW, keysText: Array.from({ length: 13 }, (_, i) => `w${i}`).join(',') })).toContain('한 줄에 낱말은 12개까지예요');
    expect(checkAnswer({ ...NEW, notText: 'x'.repeat(21) })).toContain('낱말은 20자 안으로 써 주세요');
    expect(checkAnswer({ ...NEW, confirm: '' })).toContain('확인 문장을 입력해 주세요');
    expect(checkAnswer({ ...NEW, confirm: '가'.repeat(81) })).toContain('확인 문장은 80자 안으로 써 주세요');
  });
});

describe('덧씌우기로 저장', () => {
  it('기본이 비어 있을 때 결론을 더하면 answers로 저장되고 스키마에 맞는다', () => {
    const c = EMPTY;
    const edits = draftToEdits(draftOf([NEW]), c);
    expect(edits.units['g6-motion']!['ramp-cart']!.answers).toEqual([answerFromDraft(NEW)]);
    expect(tutorEditsSchema.safeParse(edits).success).toBe(true);
    expect(countAnswerEdits(edits)).toBe(1);
  });
  it('기본과 같으면 저장하지 않는다(기본으로 되돌림)', () => {
    const c = withDefaults();
    expect(draftToEdits(draftOf([toDraftAnswer(DEFAULT)]), c)).toEqual({ v: 1, units: {} });
    // 기본에서 확인 문장만 고치면 저장된다.
    const edited = { ...toDraftAnswer(DEFAULT), confirm: '네, 결과표에서도 시간이 짧아졌어요.' };
    expect(draftToEdits(draftOf([edited]), c).units['g6-motion']!['ramp-cart']!.answers![0]!.confirm).toBe('네, 결과표에서도 시간이 짧아졌어요.');
  });
  it('기본을 모두 지우면 빈 배열로 저장된다(결론 없음)', () => {
    const edits = draftToEdits(draftOf([]), withDefaults());
    expect(edits.units['g6-motion']!['ramp-cart']!.answers).toEqual([]);
    expect(tutorEditsSchema.safeParse(edits).success).toBe(true);
    // 기본도 비어 있으면 바뀐 것이 없다.
    expect(draftToEdits(draftOf([]), EMPTY)).toEqual({ v: 1, units: {} });
  });
  it('판정 낱말이 있는 줄이 있으면 저장하지 않고 hasInvalid가 true다', () => {
    const bad = { ...NEW, confirm: '네, 정답이에요.' };
    expect(hasInvalid(draftOf([bad]), EMPTY)).toBe(true);
    expect(draftToEdits(draftOf([bad]), EMPTY)).toEqual({ v: 1, units: {} });
    expect(hasInvalid(draftOf([NEW]), EMPTY)).toBe(false);
  });
  it('저장한 것을 다시 편집용으로 읽으면 같은 목록이고, 내보내기·불러오기가 된다', () => {
    const c = EMPTY;
    const edits = draftToEdits(draftOf([NEW]), c);
    expect(draftFromEdits(edits)['g6-motion']!['ramp-cart']!.answers).toEqual([toDraftAnswer(answerFromDraft(NEW))]);
    const back = importEdits(exportJson(edits), c);
    expect(back.error).toBeUndefined();
    expect(back.accepted).toBe(1);
    expect(back.rejected).toEqual([]);
    expect(draftToEdits(back.draft, c)).toEqual(edits);
  });
  it('질문 편집과 함께 저장된다', () => {
    const d: Draft = { 'g6-motion': { 'ramp-cart': { changed: { '|repeat|': { off: true } }, added: [], answers: [NEW] } } };
    const e = draftToEdits(d, EMPTY).units['g6-motion']!['ramp-cart']!;
    expect(e.changed).toEqual({ '|repeat|': { off: true } });
    expect(e.answers).toHaveLength(1);
  });
});

describe('불러오기: 넣지 못한 줄은 이유와 함께', () => {
  const file = (answers: unknown, unit = 'g6-motion', experiment = 'ramp-cart') => JSON.stringify({ v: 1, units: { [unit]: { [experiment]: { changed: {}, added: [], answers } } } });
  it('판정 낱말, 없는 변인, 모르는 필드, 여덟 개 넘는 줄을 거른다', () => {
    const ok = answerFromDraft(NEW);
    const r = importEdits(file([ok, { ...ok, confirm: '네, 틀렸어요.' }, { ...ok, iv: 'nope' }, { ...ok, extra: 1 }]), EMPTY);
    expect(r.accepted).toBe(1);
    expect(r.draft['g6-motion']!['ramp-cart']!.answers).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual(expect.arrayContaining([expect.stringContaining('판정 말')]));
    expect(r.rejected.reduce((n, x) => n + x.count, 0)).toBe(3);
    const nine = importEdits(file(Array.from({ length: 9 }, () => ok)), EMPTY);
    expect(nine.accepted).toBe(8);
    expect(nine.rejected).toEqual([{ reason: '결론은 활동마다 8개까지예요', count: 1 }]);
  });
  it('변인 실험이 아닌 활동에는 넣지 않는다', () => {
    const c = buildCatalog([JSON.parse(readFileSync(join(__dirname, '../../../content/units/g5-strata/manifest.json'), 'utf8'))]);
    const e = c[0]!.experiments.find((x) => x.kind !== 'variable')!;
    const r = importEdits(file([answerFromDraft(NEW)], c[0]!.id, e.id), c);
    expect(r.accepted).toBe(0);
    expect(r.draft).toEqual({});
  });
  it('answers가 배열이 아니면 형식 오류로 센다', () => {
    const r = importEdits(file('x'), EMPTY);
    expect(r.accepted).toBe(0);
    expect(r.rejected).toEqual([{ reason: '형식이 맞지 않는 줄', count: 1 }]);
  });
  it('빈 배열은 그대로 받는다(결론 없음)', () => {
    const r = importEdits(file([]), withDefaults());
    expect(r.draft['g6-motion']!['ramp-cart']!.answers).toEqual([]);
    const edits: TutorEdits = draftToEdits(r.draft, withDefaults());
    expect(edits.units['g6-motion']!['ramp-cart']!.answers).toEqual([]);
  });
});

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseManifest, type AnswerKey } from '@sci/schema';
import {
  ALTERNATE_QUESTIONS,
  HINT_FINGER,
  PREFIX_OTHER,
  PREFIX_QUESTION,
  applyTutorAnswers,
  classifyUtterance,
  evidenced,
  hasJudgment,
  isRepeat,
  matchAnswer,
  normalizeKo,
  planTurn,
  similarity,
  withAlternate,
  type EvidenceTrial,
  type PlanInput,
  type TurnPlan,
} from './index';

const HEIGHT: AnswerKey = {
  iv: 'heightCm',
  conclusion: '출발 높이가 높을수록 수레가 빨라진다.',
  keys: [['높', '많'], ['빨', '빠르', '속력']],
  not: ['느려', '느리', '느린', '같아', '똑같'],
  confirm: '네, 결과표에서도 높이가 높은 시행의 시간이 짧았어요.',
};
const LOAD: AnswerKey = {
  iv: 'load',
  conclusion: '추를 실어도 속력은 거의 같다.',
  keys: [['추', '무게', '무거'], ['같', '비슷', '상관없', '관계없']],
  confirm: '네, 결과표에서도 추를 실은 시행과 아닌 시행의 시간이 비슷했어요.',
};
const ANSWERS = [HEIGHT, LOAD];
const EXP = {
  variables: [
    { key: 'heightCm', label: '출발 높이' },
    { key: 'floor', label: '바닥' },
    { key: 'load', label: '수레에 실은 추' },
  ],
  dependent: [{ key: 'timeS', label: '1 m 가는 데 걸린 시간' }],
} as unknown as PlanInput['experiment'];
const state = (ivKey: string | null, trials: EvidenceTrial[] = []): PlanInput['state'] =>
  ({ kind: 'variable', unitId: 'u', experimentId: 'e', current: { values: {}, ivKey, prediction: null }, trials }) as unknown as PlanInput['state'];
const fair = (ivKey: string): EvidenceTrial => ({ ivKey, analysis: { kind: 'fair-test', changed: [ivKey] } });
const first: EvidenceTrial = { ivKey: null, analysis: { kind: 'first-trial', changed: [] } };
const plan = (o: Partial<PlanInput>): TurnPlan =>
  planTurn({ experiment: EXP, answers: ANSWERS, state: state('heightCm'), hintLevel: 0, fallback: '결과표를 볼까요?', ...o });
const textOf = (p: TurnPlan): string => (p.kind === 'model' ? p.fallbackText : p.text);

describe('normalizeKo', () => {
  it('공백·문장부호·기호를 지우고 소문자로 맞춘다', () => {
    expect(normalizeKo(' 높 을수록, 빨라요!! ~~ ')).toBe('높을수록빨라요');
    expect(normalizeKo('ABC 1cm')).toBe('abc1cm');
    expect(normalizeKo('가​나')).toBe('가나');
  });
});

describe('matchAnswer', () => {
  const ok = (s: string) => matchAnswer(s, ANSWERS);
  it('초등학생 말투와 띄어쓰기 변형을 맞힌다', () => {
    for (const s of ['높을수록 빨라요', '높을수록빨라요', '높이가 높으면 수레가 더 빠르게 가요', '높 을 수 록 빨 라 요!!', '많이 높으면 속력이 커져요', '높은데서 하면 빨라졌어요']) {
      expect(ok(s)?.answer, s).toBe(HEIGHT);
      expect(ok(s)?.opposite, s).toBe(false);
    }
  });
  it('묶음 하나라도 빠지면 맞히지 않는다', () => {
    expect(ok('높이를 바꿔 봤어요')).toBeNull();
    expect(ok('빨라요')).toBeNull();
  });
  it('여러 개가 맞으면 배열의 앞 것을 쓴다', () => {
    const both: AnswerKey = { conclusion: '둘', keys: [['빨']], confirm: '네.' };
    expect(matchAnswer('높으면 빨라요', [both, HEIGHT])?.answer).toBe(both);
    expect(matchAnswer('높으면 빨라요', [HEIGHT, both])?.answer).toBe(HEIGHT);
  });
  it('not 낱말이 있으면 반대 방향으로 본다', () => {
    expect(ok('높을수록 속력이 느려져요')).toEqual({ answer: HEIGHT, opposite: true });
    expect(ok('높이가 높아도 속력은 똑같아요')?.opposite).toBe(true);
  });
  it('다른 결론이 순수하게 맞으면 반대 방향보다 앞선다', () => {
    expect(matchAnswer('높으면 빨라도 추는 똑같아요', [HEIGHT, LOAD])).toEqual({ answer: LOAD, opposite: false });
  });
  it('다른 변인 이야기는 맞히지 않는다', () => {
    expect(ok('바닥이 거칠면 느려요')).toBeNull();
    expect(ok('무거울수록 빨라요')).toBeNull();
  });
  it('빈 말과 answers가 없을 때는 null이다', () => {
    expect(ok('   ')).toBeNull();
    expect(matchAnswer('높으면 빨라요', [])).toBeNull();
  });
  it('keys·not도 같은 정규화를 쓴다', () => {
    const a: AnswerKey = { conclusion: 'x', keys: [['Cm 단위']], not: ['아 니'], confirm: '네.' };
    expect(matchAnswer('cm단위로 쟀어요', [a])?.opposite).toBe(false);
    expect(matchAnswer('cm단위로 쟀는데 아니에요', [a])?.opposite).toBe(true);
  });
});

describe('evidenced', () => {
  it('공정한 시행이 없으면 확인되지 않는다', () => {
    expect(evidenced(HEIGHT, [])).toBe(false);
    expect(evidenced(HEIGHT, [first, { ivKey: 'heightCm', analysis: { kind: 'confounded', changed: ['heightCm', 'floor'] } }])).toBe(false);
  });
  it('answer.iv가 있으면 그 변인의 공정한 시행이어야 한다', () => {
    expect(evidenced(HEIGHT, [first, fair('floor')])).toBe(false);
    expect(evidenced(HEIGHT, [first, fair('floor'), fair('heightCm')])).toBe(true);
  });
  it('iv가 없으면 아무 공정한 시행이나 된다', () => {
    expect(evidenced({ conclusion: 'x', keys: [['a']], confirm: '네.' }, [first, fair('floor')])).toBe(true);
  });
  it('ivKey가 비었어도 바꾼 조건이 하나면 그 변인이다', () => {
    expect(evidenced(HEIGHT, [{ ivKey: null, analysis: { kind: 'fair-test', changed: ['heightCm'] } }])).toBe(true);
  });
});

describe('classifyUtterance', () => {
  const k = (s: string) => classifyUtterance(s, ANSWERS).kind;
  it('모르겠다는 말을 먼저 가려낸다', () => {
    for (const s of ['모르겠어요', '몰라요', '글쎄요..', '헷갈려요', '어려워요', '생각이 안 나요', '생각안나', '잘 모르겠어', '높으면 빨라지는지 몰라요']) expect(k(s), s).toBe('dont-know');
  });
  it('결론을 알아본다', () => {
    expect(classifyUtterance('높을수록 빨라요', ANSWERS)).toEqual({ kind: 'answer', answer: HEIGHT, opposite: false });
    expect(classifyUtterance('높으면 속력이 느려요', ANSWERS)).toEqual({ kind: 'answer', answer: HEIGHT, opposite: true });
  });
  it('질문을 알아본다', () => {
    for (const s of ['이게 뭐예요?', '왜 그래요', '어떻게 해요', '몇 번 해요', '바닥은 뭐로 해요', '이거 해도 돼요?', '어디를 봐요']) expect(k(s), s).toBe('question');
  });
  it('의문사가 있어도 요·까로 끝나지 않으면 질문이 아니다', () => {
    expect(k('왜 그런지 생각해 봤어')).toBe('other');
  });
  it('나머지는 other', () => {
    for (const s of ['재미있어요', '바닥을 바꿀래요', 'ㅋㅋㅋ', '']) expect(k(s), s).toBe('other');
  });
  it('모르겠다가 질문·결론보다 앞선다', () => {
    expect(k('왜 그런지 모르겠어요?')).toBe('dont-know');
  });
});

describe('similarity / isRepeat', () => {
  it('같은 글은 1, 아주 다른 글은 0, 빈 글은 0', () => {
    expect(similarity('결과표를 볼까요?', '결과표를 볼까요?')).toBe(1);
    expect(similarity('가나다라', '마바사아')).toBe(0);
    expect(similarity('', '가')).toBe(0);
  });
  it('띄어쓰기·문장부호만 다른 글은 되풀이다', () => {
    expect(isRepeat('결과표 에서 시간 칸을 볼까요?', '결과표에서 시간 칸을 볼까요')).toBe(true);
  });
  it('유사도 0.8 이상이면 되풀이, 아래면 아니다', () => {
    const a = '출발 높이만 바꾸었을 때 걸린 시간은 어떻게 달라졌나요?';
    expect(isRepeat('출발 높이만 바꾸었을 때 걸린 시간이 어떻게 달라졌나요?', a)).toBe(true);
    expect(isRepeat('바닥을 바꾸면 어떻게 될 것 같나요?', a)).toBe(false);
  });
  it('마지막 질문 문장이 같으면 앞 문장이 달라도 되풀이다', () => {
    const q = '그래프에서 두 선의 기울기를 어떻게 견줄 수 있을까요?';
    expect(isRepeat(`이번에는 높이를 바꾸었군요 그리고 결과가 꽤 달라졌어요. ${q}`, `다른 말을 길게 길게 길게 앞에 붙였어요. ${q}`)).toBe(true);
  });
  it('직전이 없으면 되풀이가 아니다', () => {
    expect(isRepeat('아무 말', undefined)).toBe(false);
  });
});

describe('withAlternate', () => {
  it('직전과 다르면 그대로', () => {
    expect(withAlternate('', '질문 A?', '질문 B?')).toBe('질문 A?');
    expect(withAlternate('', '질문 A?', undefined)).toBe('질문 A?');
  });
  it('직전과 같으면 직전과 다른 첫 대체 질문, 접두어는 그대로', () => {
    expect(withAlternate('', '질문 A?', '질문 A?')).toBe(ALTERNATE_QUESTIONS[0]);
    expect(withAlternate(PREFIX_OTHER, '질문 A?', `${PREFIX_OTHER}질문 A?`)).toBe(`${PREFIX_OTHER}${ALTERNATE_QUESTIONS[0]}`);
    expect(withAlternate(PREFIX_QUESTION, ALTERNATE_QUESTIONS[0], `${PREFIX_QUESTION}${ALTERNATE_QUESTIONS[0]}`)).toBe(`${PREFIX_QUESTION}${ALTERNATE_QUESTIONS[1]}`);
  });
});

describe('planTurn', () => {
  it('말이 없으면(새 상황) 모델 질문, 못 만들면 기본 질문', () => {
    expect(plan({})).toEqual({ kind: 'model', prefix: '', fallbackText: '결과표를 볼까요?' });
    expect(plan({ utterance: '  ' }).kind).toBe('model');
  });
  it('질문·그 밖의 말은 모델, 걸리면 반응 접두어 + 기본 질문', () => {
    expect(plan({ utterance: '이게 뭐예요?' })).toEqual({ kind: 'model', prefix: PREFIX_QUESTION, fallbackText: `${PREFIX_QUESTION}결과표를 볼까요?` });
    expect(plan({ utterance: '재미있어요' })).toEqual({ kind: 'model', prefix: PREFIX_OTHER, fallbackText: `${PREFIX_OTHER}결과표를 볼까요?` });
  });
  it('기본 질문이 직전과 같으면 대체 질문으로 바꾼다', () => {
    const p = plan({ utterance: '재미있어요', previousTutor: `${PREFIX_OTHER}결과표를 볼까요?` });
    expect(p).toMatchObject({ kind: 'model', fallbackText: `${PREFIX_OTHER}${ALTERNATE_QUESTIONS[0]}` });
  });

  describe('힌트 사다리', () => {
    it('공정한 시행이 없으면 설계 힌트 1~3단계, 그다음 손가락', () => {
      const s = state('heightCm', [first]);
      const ps = [0, 1, 2, 3, 3].map((hintLevel) => plan({ state: s, utterance: '모르겠어요', hintLevel }));
      expect(ps.map(textOf)).toEqual([
        '괜찮아요. 먼저 바꿔 볼 조건을 하나만 골라 볼까요?',
        '출발 높이만 바꾸고 나머지 조건은 그대로 두면 어떨까요?',
        '출발 높이만 바꾼 시행을 하나 더 해 보고 1 m 가는 데 걸린 시간을 견주어 볼까요?',
        HINT_FINGER,
        HINT_FINGER,
      ]);
      expect(ps.map((p) => (p.kind === 'hint' ? p.level : null))).toEqual([1, 2, 3, 'finger', 'finger']);
      expect(ps.map((p) => (p.kind === 'hint' ? p.nextHintLevel : null))).toEqual([1, 2, 3, 3, 3]);
    });
    it('공정한 시행이 있으면 해석 힌트', () => {
      const s = state('heightCm', [first, fair('heightCm')]);
      const t = [0, 1, 2].map((hintLevel) => textOf(plan({ state: s, utterance: '몰라요', hintLevel })));
      expect(t).toEqual([
        '괜찮아요. 결과표에서 1 m 가는 데 걸린 시간 칸을 볼까요?',
        '출발 높이만 다른 두 시행에서 1 m 가는 데 걸린 시간은 어떻게 다른가요?',
        '출발 높이가 달라질 때 1 m 가는 데 걸린 시간은 어떻게 되었나요?',
      ]);
    });
    it('조작변인을 아직 고르지 않았으면 "조건"으로 채운다', () => {
      expect(textOf(plan({ state: state(null), utterance: '몰라요', hintLevel: 1 }))).toBe('조건만 바꾸고 나머지 조건은 그대로 두면 어떨까요?');
    });
    it('고른 변인이 없으면 마지막 공정한 시행의 변인을 쓴다', () => {
      expect(textOf(plan({ state: state(null, [fair('floor')]), utterance: '몰라요', hintLevel: 1 }))).toBe('바닥만 다른 두 시행에서 1 m 가는 데 걸린 시간은 어떻게 다른가요?');
    });
    it('힌트에는 {…} 자리표시나 괄호 조사가 남지 않는다', () => {
      for (const lv of [0, 1, 2, 3]) {
        for (const tr of [[], [fair('load')]]) {
          const t = textOf(plan({ state: state('load', tr), utterance: '몰라', hintLevel: lv }));
          expect(t).not.toMatch(/[{}]|\(를\)|\(가\)|\(는\)|\(과\)/);
        }
      }
    });
  });

  describe('결론 확인', () => {
    it('맞히고 결과로 확인되면 confirm + 이어 가기(아직 안 알아본 다른 변인)', () => {
      const p = plan({ state: state('heightCm', [first, fair('heightCm')]), utterance: '높을수록 빨라요' });
      expect(p).toMatchObject({ kind: 'confirm', answer: HEIGHT });
      expect(textOf(p)).toBe(`${HEIGHT.confirm} 이번에는 바닥을 바꾸면 어떻게 될지 알아볼까요?`);
    });
    it('이어 가기는 이미 공정한 시행으로 알아본 변인을 건너뛴다', () => {
      const t = textOf(plan({ state: state('heightCm', [fair('floor'), fair('heightCm')]), utterance: '높을수록 빨라요' }));
      expect(t).toBe(`${HEIGHT.confirm} 이번에는 수레에 실은 추를 바꾸면 어떻게 될지 알아볼까요?`);
    });
    it('모두 알아봤으면 생활 속 질문', () => {
      const t = textOf(plan({ state: state('heightCm', [fair('floor'), fair('load'), fair('heightCm')]), utterance: '높을수록 빨라요' }));
      expect(t).toBe(`${HEIGHT.confirm} 이 결과를 생활 속 어디에서 볼 수 있을까요?`);
    });
    it('확인되지 않았으면 predict: 틀렸다고 하지 않고 실험으로 확인하게 한다', () => {
      expect(plan({ state: state('heightCm', [first]), utterance: '높을수록 빨라요' })).toEqual({ kind: 'predict', text: '그렇게 생각했군요. 출발 높이만 바꾸어 실험으로 확인해 볼까요?' });
    });
    it('다른 변인의 공정한 시행만 있으면 그 결론은 확인되지 않은 것', () => {
      expect(plan({ state: state('floor', [first, fair('floor')]), utterance: '높을수록 빨라요' }).kind).toBe('predict');
    });
    it('answer의 iv가 없고 고른 변인도 없으면 변인 없는 predict', () => {
      const a: AnswerKey = { conclusion: 'x', keys: [['빨']], confirm: '네.' };
      expect(plan({ answers: [a], state: state(null), utterance: '빨라요' })).toEqual({ kind: 'predict', text: '그렇게 생각했군요. 실험으로 확인해 볼까요?' });
    });
    it('반대 방향 + 확인됨이면 recheck, 확인 안 됨이면 predict', () => {
      expect(plan({ state: state('heightCm', [fair('heightCm')]), utterance: '높으면 속력이 느려져요' })).toEqual({
        kind: 'recheck',
        text: '결과표에서 출발 높이만 다른 두 시행의 1 m 가는 데 걸린 시간을 다시 견주어 볼까요?',
      });
      expect(plan({ state: state('heightCm', [first]), utterance: '높으면 속력이 느려져요' }).kind).toBe('predict');
    });
    it('trials 입력이 있으면 state.trials 대신 쓴다(최근 3개 밖의 시행도 근거가 된다)', () => {
      const p = plan({ state: state('heightCm', []), trials: [fair('heightCm'), first, first, first], utterance: '높을수록 빨라요' });
      expect(p.kind).toBe('confirm');
    });
  });

  it('앱이 만드는 글(확인 문장 제외)에는 판정 낱말이 없다', () => {
    const all: string[] = [HINT_FINGER, PREFIX_OTHER, PREFIX_QUESTION, ...ALTERNATE_QUESTIONS];
    for (const tr of [[], [first], [fair('heightCm')], [fair('floor'), fair('load'), fair('heightCm')]]) {
      for (const lv of [0, 1, 2, 3]) all.push(textOf(plan({ state: state('heightCm', tr), utterance: '몰라요', hintLevel: lv })));
      for (const u of ['높을수록 빨라요', '높으면 속력이 느려요', '추를 실어도 같아요', '재미있어요', '이게 뭐예요?']) all.push(textOf(plan({ state: state('heightCm', tr), utterance: u })));
    }
    for (const t of all.map((x) => x.replace(HEIGHT.confirm, '').replace(LOAD.confirm, ''))) expect(hasJudgment(t), t).toBe(false);
  });
});

describe('applyTutorAnswers', () => {
  it('덧씌우기에 answers가 있으면 통째로 바꾼다(빈 배열도)', () => {
    expect(applyTutorAnswers([HEIGHT], { answers: [LOAD] })).toEqual([LOAD]);
    expect(applyTutorAnswers([HEIGHT], { answers: [] })).toEqual([]);
  });
  it('없으면 받은 것 그대로, 둘 다 없으면 빈 배열', () => {
    expect(applyTutorAnswers([HEIGHT], {})).toEqual([HEIGHT]);
    expect(applyTutorAnswers([HEIGHT])).toEqual([HEIGHT]);
    expect(applyTutorAnswers(undefined)).toEqual([]);
  });
});

// ---- 매니페스트 answers + 표현 시험 자료(있을 때만) ----

const FIXTURE = join(__dirname, 'answerKeys.fixture.json');
const UNITS = join(__dirname, '../../../content/units');

describe('매니페스트 answers', () => {
  const entries = readdirSync(UNITS).flatMap((u) => {
    const m = parseManifest(JSON.parse(readFileSync(join(UNITS, u, 'manifest.json'), 'utf8')));
    return m.experiments.flatMap((e) => ('variables' in e ? [{ unit: m.id, exp: e }] : []));
  });
  it('answers가 있으면 판정 낱말 없이 마침표로 끝나는 80자 이하 확인 문장이고, iv는 그 활동의 변인이다', () => {
    for (const { unit, exp } of entries) {
      for (const a of exp.tutor.answers ?? []) {
        expect(a.confirm.length, `${unit}/${exp.id}`).toBeLessThanOrEqual(80);
        expect(a.confirm.endsWith('.'), `${unit}/${exp.id}: ${a.confirm}`).toBe(true);
        expect(hasJudgment(a.confirm), `${unit}/${exp.id}: ${a.confirm}`).toBe(false);
        if (a.iv) expect(exp.variables.map((v) => v.key), `${unit}/${exp.id}`).toContain(a.iv);
      }
    }
  });

  // 자료 형식(추정): 배열 또는 {entries|items:[...]}. 항목 = { unit, experiment, answer(번호 또는 결론 글), positives[], negatives[] }.
  // 파일이 없으면 건너뛴다.
  type Item = {
    unit?: string;
    unitId?: string;
    experiment?: string;
    experimentId?: string;
    exp?: string;
    answer?: number | string;
    answerIndex?: number;
    conclusion?: string;
    positives?: string[];
    negatives?: string[];
    yes?: string[];
    no?: string[];
  };
  it.skipIf(!existsSync(FIXTURE))('표현 시험 자료: 맞혀야 하는 말은 맞히고 맞히면 안 되는 말은 맞히지 않는다', () => {
    const raw = JSON.parse(readFileSync(FIXTURE, 'utf8')) as unknown;
    const list: Item[] = Array.isArray(raw) ? (raw as Item[]) : ((raw as { entries?: Item[]; items?: Item[] }).entries ?? (raw as { items?: Item[] }).items ?? []);
    expect(list.length).toBeGreaterThan(0);
    for (const it of list) {
      const unit = it.unit ?? it.unitId;
      const expId = it.experiment ?? it.experimentId ?? it.exp;
      const found = entries.find((e) => e.unit === unit && e.exp.id === expId);
      expect(found, `${unit}/${expId}`).toBeDefined();
      const answers = found!.exp.tutor.answers ?? [];
      const idx = typeof it.answer === 'number' ? it.answer : (it.answerIndex ?? answers.findIndex((a) => a.conclusion === (it.conclusion ?? it.answer)));
      const target = answers[idx];
      expect(target, `${unit}/${expId}: answer ${String(it.answer ?? it.conclusion)}`).toBeDefined();
      for (const s of it.positives ?? it.yes ?? []) {
        const m = matchAnswer(s, answers);
        expect(m?.answer === target && !m.opposite, `${unit}/${expId} 맞혀야 함: ${s}`).toBe(true);
      }
      for (const s of it.negatives ?? it.no ?? []) {
        const m = matchAnswer(s, answers);
        expect(m !== null && m.answer === target && !m.opposite, `${unit}/${expId} 맞히면 안 됨: ${s}`).toBe(false);
      }
    }
  });
});

describe('검토 보강', () => {
  it('"뭘"·"무슨"으로 묻는 말도 질문이다', () => {
    expect(classifyUtterance('바닥은 뭘로 해요', []).kind).toBe('question');
    expect(classifyUtterance('무슨 칸을 봐요', []).kind).toBe('question');
  });
  it('받은 덧씌우기의 확인 문장에 판정 낱말이 있으면 그 결론은 쓰지 않는다', () => {
    const ok = { conclusion: '가', keys: [['가']], confirm: '네, 결과표에서도 그랬어요.' };
    const bad = { conclusion: '나', keys: [['나']], confirm: '네, 정답이에요.' };
    expect(applyTutorAnswers([ok], { answers: [bad, ok] })).toEqual([ok]);
  });
});

describe('반대 방향 낱말 안전장치', () => {
  const turns: AnswerKey = { iv: 'turns', conclusion: '에나멜선을 많이 감을수록 전자석이 세다', keys: [['감', '횟수'], ['많', '더'], ['세', '클립']], confirm: '네, 결과표에서도 많이 감았을 때 클립이 더 많았어요.' };
  const flow: AnswerKey = { conclusion: '전기가 흐를 때만 자석이 된다', keys: [['전지', '전기'], ['연결하면', '흐르면'], ['자석', '세']], confirm: '네, 결과표에서도 전지를 연결했을 때만 클립이 붙었어요.' };
  const battery: AnswerKey = { iv: 'battery', conclusion: '전지를 직렬로 연결하면 전자석이 더 세다', keys: [['전지'], ['연결하면'], ['세']], confirm: '네, 결과표에서도 직렬로 연결했을 때 클립이 더 많았어요.' };
  it('결론·keys에 없는 반대 낱말이 있으면 맞힌 것으로 보지 않는다', () => {
    expect(matchAnswer('에나멜선을 적게 감으면 더 세요', [turns])).toBeNull();
    expect(matchAnswer('많이 감을수록 더 세요', [turns])?.opposite).toBe(false);
    const amount: AnswerKey = { iv: 'water', conclusion: '물의 양이 많을수록 더 많이 녹는다', keys: [['물'], ['양'], ['많이녹', '더많이']], confirm: '네, 결과표에서도 물이 많을 때 더 많이 녹았어요.' };
    expect(matchAnswer('물 양을 줄이면 더 많이 녹아요', [amount])).toBeNull();
  });
  it('not에 걸린 반대 말은 그대로 opposite로 본다', () => {
    const withNot = { ...turns, not: ['적게'] };
    expect(matchAnswer('적게 감으면 더 세요', [withNot])).toEqual({ answer: withNot, opposite: true });
  });
  it('지금 알아보는 변인의 결론을 먼저 본다', () => {
    expect(matchAnswer('전지를 많이 연결하면 세져요', [flow, battery], 'battery')?.answer).toBe(battery);
    expect(matchAnswer('전지를 많이 연결하면 세져요', [flow, battery])?.answer).toBe(flow);
  });
});


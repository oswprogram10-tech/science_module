import type { AnswerKey, VariableExperiment } from '@sci/schema';
import { splitSentences } from './check';
import { renderProbe } from './index';
import type { TutorState } from './context';

/**
 * 튜터 대화 v1(사양 docs/specs/tutor-dialogue-v1.md): 학생 말에 먼저 반응하고 다음 질문을 한다.
 * 정답 판정은 이 파일의 앱 규칙이 하고 모델은 판정하지 않는다. 모두 순수 함수이며 학생 말을 저장하거나 밖으로 보내지 않는다.
 */

// ---- 정규화 ----

/** 공백·문장부호·기호·보이지 않는 글자를 지우고 소문자로 맞춘다. keys·not에도 같은 정규화를 쓴다. */
export const normalizeKo = (s: string): string => s.normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}\p{Cf}]/gu, '');

// ---- 학생 말 나누기 ----

/** 정규화한 말에 이 낱말이 있으면 모르겠다는 말이다. */
export const DONT_KNOW_WORDS = ['모르', '몰라', '글쎄', '헷갈', '어려워', '생각이안', '생각안나', '잘모르'];
const QUESTION_WORDS = ['왜', '어떻게', '무엇', '뭐', '뭘', '무슨', '어디', '언제', '몇', '어느'];

export interface AnswerMatch {
  answer: AnswerKey;
  /** keys는 모두 맞는데 not에 걸린 경우(반대 방향). */
  opposite: boolean;
}

const hasAny = (haystack: string, words: readonly string[]): boolean => words.some((w) => {
  const n = normalizeKo(w);
  return n.length > 0 && haystack.includes(n);
});

/** keys의 묶음마다 낱말 하나 이상이 들어 있는가. */
const keysMatch = (norm: string, a: AnswerKey): boolean => a.keys.every((group) => hasAny(norm, group));

/**
 * 학생 말이 어느 결론과 맞는지(사양 §2). keys가 모두 맞고 not이 없는 첫 answer를 쓰고,
 * 없으면 keys는 맞지만 not에 걸린 첫 answer를 반대 방향(opposite)으로 돌려준다. 어느 것도 아니면 null.
 */
/**
 * 반대 방향 낱말. 학생 말에 이 낱말이 있는데 결론·keys 어디에도 없으면 그 결론으로 맞힌 것으로 보지 않는다.
 * 낱말 목록이 빠뜨린 반대 표현("적게 감으면 더 세요")을 맞았다고 확인해 주는 일을 막는 안전장치다(틀린 생각을 굳히는 것이 가장 나쁘다).
 * 이런 말은 맞힘·반대 판정 없이 모델(또는 기본 질문) 흐름으로 간다.
 */
export const CONTRAST_WORDS: readonly (readonly [word: string, stem: string])[] = [
  ['적게', '적'], ['적을', '적'], ['적으', '적'], ['적은', '적'], ['적어', '적'], ['덜', '덜'],
  ['작은', '작'], ['작을', '작'], ['작으', '작'], ['작아', '작'], ['낮은', '낮'], ['낮을', '낮'], ['낮으', '낮'], ['낮아', '낮'],
  ['느려', '느'], ['느리', '느'], ['느린', '느'], ['느릴', '느'], ['약해', '약'], ['약하', '약'], ['약한', '약'], ['약할', '약'],
  ['줄어', '줄'], ['줄면', '줄'], ['짧', '짧'], ['차가', '차'], ['차갑', '차'], ['않', '않'],
];

/** 학생 말의 반대 낱말이 결론·keys에 같은 뿌리(적·작·낮·느·줄 …)로 없으면 이 결론과 어긋난 말로 본다. */
const contradicts = (norm: string, a: AnswerKey): boolean => {
  const own = normalizeKo([a.conclusion, ...a.keys.flat()].join(' '));
  return CONTRAST_WORDS.some(([w, stem]) => norm.includes(w) && !own.includes(stem));
};

export function matchAnswer(utterance: string, answers: readonly AnswerKey[], preferIv?: string | null): AnswerMatch | null {
  const norm = normalizeKo(utterance);
  if (!norm) return null;
  // 지금 알아보는 변인의 결론을 먼저 본다(같은 말이 여러 결론에 걸릴 때 엉뚱한 확인을 줄인다).
  const ordered = preferIv ? [...answers.filter((a) => a.iv === preferIv), ...answers.filter((a) => a.iv !== preferIv)] : answers;
  let opposite: AnswerMatch | null = null;
  for (const a of ordered) {
    if (!keysMatch(norm, a)) continue;
    if (a.not && hasAny(norm, a.not)) {
      opposite ??= { answer: a, opposite: true };
      continue;
    }
    if (contradicts(norm, a)) continue;
    return { answer: a, opposite: false };
  }
  return opposite;
}

/** 시행 하나에서 결론 확인에 필요한 것만. TutorTrial이 그대로 들어맞는다. */
export interface EvidenceTrial {
  ivKey: string | null;
  analysis: { kind: string; changed: readonly string[] };
}

/** 이 시행이 공정한 시행으로 알아본 조작변인. 공정한 시행이 아니면 null. */
const fairIv = (t: EvidenceTrial): string | null => (t.analysis.kind === 'fair-test' ? (t.ivKey ?? (t.analysis.changed.length === 1 ? t.analysis.changed[0]! : null)) : null);

/** 결과로 확인되었는가: 공정한 시행이 있고, answer.iv가 있으면 그 변인의 시행이어야 한다(사양 §2). */
export function evidenced(answer: AnswerKey, trials: readonly EvidenceTrial[]): boolean {
  return trials.some((t) => t.analysis.kind === 'fair-test' && (answer.iv === undefined || fairIv(t) === answer.iv));
}

export type Utterance =
  | { kind: 'dont-know' }
  | ({ kind: 'answer' } & AnswerMatch)
  | { kind: 'question' }
  | { kind: 'other' };

/** 학생 말 나누기(사양 §1). 앞에서 걸리면 뒤는 보지 않는다: 모르겠어요 → 결론 → 질문 → 그 밖. */
export function classifyUtterance(utterance: string, answers: readonly AnswerKey[], preferIv?: string | null): Utterance {
  const norm = normalizeKo(utterance);
  if (hasAny(norm, DONT_KNOW_WORDS)) return { kind: 'dont-know' };
  const m = matchAnswer(utterance, answers, preferIv);
  if (m) return { kind: 'answer', ...m };
  const t = utterance.trim();
  if (/[?？]$/.test(t) || (hasAny(norm, QUESTION_WORDS) && /[요까]$/.test(norm))) return { kind: 'question' };
  return { kind: 'other' };
}

// ---- 되풀이 막기 ----

/** 되풀이로 보는 유사도(LCS 길이 / 긴 쪽 길이). */
export const REPEAT_SIMILARITY = 0.8;

/** 두 글의 유사도: 정규화한 글의 가장 긴 공통 부분열 길이 / 긴 쪽 길이. */
export function similarity(a: string, b: string): number {
  const x = normalizeKo(a);
  const y = normalizeKo(b);
  if (!x || !y) return 0;
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    prev = cur;
  }
  return prev[y.length]! / Math.max(x.length, y.length);
}

/** 글의 마지막 질문 문장(정규화). 질문이 없으면 undefined. */
const lastQuestion = (text: string): string | undefined => {
  const q = splitSentences(text).filter((s) => s.endsWith('?')).pop();
  return q === undefined ? undefined : normalizeKo(q);
};

/** 직전에 보인 글과 너무 비슷한가: 유사도가 0.8 이상이거나 마지막 질문 문장이 같다(사양 §6). */
export function isRepeat(text: string, previous: string | undefined): boolean {
  if (!previous) return false;
  if (similarity(text, previous) >= REPEAT_SIMILARITY) return true;
  const q = lastQuestion(text);
  return q !== undefined && q === lastQuestion(previous);
}

/** 대체 질문: 최종 글이 직전과 같을 때 직전과 다른 첫 질문으로 바꾼다. */
export const ALTERNATE_QUESTIONS = [
  '그렇게 생각한 까닭을 말해 줄래요?',
  '결과표에서 어느 칸을 보면 그 생각을 확인할 수 있을까요?',
  '다음 시행에서는 무엇을 바꿔 보고 싶나요?',
] as const;

/** 반응 접두어 + 질문. 최종 글이 직전에 보인 글과 같으면 직전과 다른 첫 대체 질문으로 바꾼다(접두어는 그대로). */
export function withAlternate(prefix: string, question: string, previous: string | undefined): string {
  const text = `${prefix}${question}`;
  if (previous === undefined || text !== previous) return text;
  return `${prefix}${ALTERNATE_QUESTIONS.find((q) => `${prefix}${q}` !== previous) ?? ALTERNATE_QUESTIONS[0]}`;
}

// ---- 앱이 만드는 글 ----

export const PREFIX_QUESTION = '좋은 질문이에요. ';
export const PREFIX_OTHER = '말해 줘서 고마워요. ';
export const HINT_FINGER = '결과표의 두 줄을 손가락으로 짚어 보며 다시 볼까요?';

const DESIGN_HINTS = ['괜찮아요. 먼저 바꿔 볼 조건을 하나만 골라 볼까요?', '{iv}만 바꾸고 나머지 조건은 그대로 두면 어떨까요?', '{iv}만 바꾼 시행을 하나 더 해 보고 {dv}을(를) 견주어 볼까요?'];
const RESULT_HINTS = ['괜찮아요. 결과표에서 {dv} 칸을 볼까요?', '{iv}만 다른 두 시행에서 {dv}은(는) 어떻게 다른가요?', '{iv}이(가) 달라질 때 {dv}은(는) 어떻게 되었나요?'];
const PREDICT = '그렇게 생각했군요. {iv}만 바꾸어 실험으로 확인해 볼까요?';
const PREDICT_NO_IV = '그렇게 생각했군요. 실험으로 확인해 볼까요?';
const RECHECK = '결과표에서 {iv}만 다른 두 시행의 {dv}을(를) 다시 견주어 볼까요?';
const NEXT_IV = '이번에는 {iv}을(를) 바꾸면 어떻게 될지 알아볼까요?';
const LIFE = '이 결과를 생활 속 어디에서 볼 수 있을까요?';

/** 모든 앱 글에서 쓰는 {iv} 자리가 비었을 때의 말(selectProbe와 같다). */
const NO_IV = '조건';

// ---- 반응 정하기 ----

type VariableTutorState = Extract<TutorState, { kind: 'variable' }>;

export interface PlanInput {
  experiment: Pick<VariableExperiment, 'variables' | 'dependent'>;
  /** 교사 덧씌우기를 적용한 결론 목록(applyTutorAnswers). */
  answers: readonly AnswerKey[];
  /** fromVariableRuntime 결과. */
  state: VariableTutorState;
  /** 시행 기록 전체. 없으면 state.trials(최근 3개)를 쓴다. */
  trials?: readonly EvidenceTrial[];
  /** 학생이 방금 한 말. 새 상황이면 없다. */
  utterance?: string;
  /** 직전에 학생에게 보인 글. */
  previousTutor?: string;
  /** 지금까지 보인 힌트 단계(0~3). */
  hintLevel: number;
  /** 기본 질문(selectProbe 결과). 모델을 못 쓰거나 출력이 걸릴 때 보인다. */
  fallback: string;
}

export type TurnPlan =
  /** 모델이 질문을 만든다. fallbackText는 모델이 못 만들 때 보일 글(반응 접두어와 대체 질문을 적용한 것). */
  | { kind: 'model'; fallbackText: string; prefix: string }
  /** 힌트. level 'finger'는 3단계 뒤의 마지막 말이다. nextHintLevel은 hintLevel에 넣을 값. */
  | { kind: 'hint'; text: string; level: 1 | 2 | 3 | 'finger'; nextHintLevel: number }
  | { kind: 'confirm'; text: string; answer: AnswerKey }
  | { kind: 'predict'; text: string }
  | { kind: 'recheck'; text: string };

/** 화면에 보일 글이 있는 계획(모델을 쓰지 않는 계획). */
export type ShownPlan = Exclude<TurnPlan, { kind: 'model' }>;

/**
 * 학생 말에 반응할 계획을 정한다(사양 §3). 순수 함수: 모델을 부르지 않고 저장하지 않는다.
 * confirm·predict·recheck·hint는 앱이 만든 글이고 모델은 쓰지 않는다. model은 모델 질문을 만들되, 못 만들면 fallbackText를 보인다.
 */
export function planTurn(input: PlanInput): TurnPlan {
  const { experiment: exp, state, utterance } = input;
  const trials: readonly EvidenceTrial[] = input.trials ?? state.trials;
  const labelOf = (key: string | null | undefined): string => (key ? (exp.variables.find((v) => v.key === key)?.label ?? key) : NO_IV);
  const dv = exp.dependent[0]?.label ?? '결과';
  const fill = (tpl: string, ivKey: string | null | undefined) => renderProbe(tpl, { iv: labelOf(ivKey), changed: [], dv });
  const fair = trials.filter((t) => t.analysis.kind === 'fair-test');
  // 지금 보고 있는 조작변인: 고른 것, 없으면 마지막 공정한 시행, 없으면 마지막 시행의 것.
  const lastTrial = trials[trials.length - 1];
  const currentIv = state.current.ivKey ?? (fair.length > 0 ? fairIv(fair[fair.length - 1]!) : null) ?? lastTrial?.ivKey ?? null;

  const model = (prefix: string): TurnPlan => ({ kind: 'model', prefix, fallbackText: withAlternate(prefix, input.fallback, input.previousTutor) });
  if (utterance === undefined || utterance.trim() === '') return model('');

  const u = classifyUtterance(utterance, input.answers, currentIv);
  switch (u.kind) {
    case 'dont-know': {
      const tpls = fair.length === 0 ? DESIGN_HINTS : RESULT_HINTS;
      if (input.hintLevel >= 3) return { kind: 'hint', text: HINT_FINGER, level: 'finger', nextHintLevel: 3 };
      const level = (Math.max(0, Math.floor(input.hintLevel)) + 1) as 1 | 2 | 3;
      return { kind: 'hint', text: fill(tpls[level - 1]!, currentIv), level, nextHintLevel: level };
    }
    case 'answer': {
      const ivKey = u.answer.iv ?? currentIv;
      const ok = evidenced(u.answer, trials);
      if (ok && !u.opposite) {
        const tested = new Set(fair.map(fairIv));
        const base = u.answer.iv ?? currentIv;
        const next = exp.variables.find((v) => v.key !== base && !tested.has(v.key));
        const follow = next ? renderProbe(NEXT_IV, { iv: next.label, changed: [], dv }) : LIFE;
        return { kind: 'confirm', text: `${u.answer.confirm} ${follow}`, answer: u.answer };
      }
      if (ok && u.opposite) return { kind: 'recheck', text: fill(RECHECK, ivKey) };
      return { kind: 'predict', text: ivKey ? fill(PREDICT, ivKey) : PREDICT_NO_IV };
    }
    case 'question':
      return model(PREFIX_QUESTION);
    default:
      return model(PREFIX_OTHER);
  }
}

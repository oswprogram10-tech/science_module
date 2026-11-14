import { guardModelOutput } from './index';

export interface TutorCheckExperiment {
  limits: string[];
  tutor: { forbiddenAnswers: string[] };
}

export interface TutorCheckResult {
  ok: boolean;
  /** `guard:<구절>`, `too-long`, `no-question`, `judgment`, `personal-info` */
  problems: string[];
}

export const JUDGMENT_WORDS = ['정답', '틀렸', '맞았', '잘했어', '오답'];
export const MAX_RESPONSE_CHARS = 120;
export const MAX_SENTENCES = 2;

const PHONE = /(?:\+?82[-\s.]?)?0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/** 전화번호나 이메일처럼 보이는 내용이 있는가. */
export const hasPersonalInfo = (text: string): boolean => PHONE.test(text) || EMAIL.test(text);

/**
 * 마침표 없이 이어 붙인 문장의 경계: 해요체 어미(…요)·죠·니다 뒤에 공백과 한글·숫자·여는 따옴표가 오는 곳
 * ("관찰은 아직 없어요 기록 두 칸에는…", "두 값이 달라요 결과표를…", "바꾸었어요 1 °C 안이 된 때…").
 * - 질문 어미(까요·나요·가요)는 넣지 않는다. 카드 기준 이름("눈에 보이나요 기준")이나 칸 이름("움직이나요 칸")과 헷갈린다.
 * - '요'로 끝나는 명사(필요·중요·주요 등)와 인용("좋아요 라고")은 경계가 아니다.
 */
const RUN_ON = /([가-힣]요|죠|니다)\s+(?!라고|이라고|하고|하는|라는|란\s)(?=[가-힣0-9‘“'"(])/g;
const NOUN_YO = /(필요|중요|주요|수요|소요|강요|요요|개요)$/;

/** 이어 붙인 곳에 줄바꿈을 넣는다(splitSentences가 그 자리에서 나눈다). */
function markRunOns(text: string): string {
  return text.replace(RUN_ON, (m, end: string, offset: number) => {
    const word = /[가-힣]+$/.exec(text.slice(0, offset + end.length))?.[0] ?? '';
    return /(까|나|가)요$/.test(end) || NOUN_YO.test(word) ? m : `${end}\n`;
  });
}

/** 마침표 없이 이어 붙인 곳이 있는가(평가 지표). */
export const hasRunOn = (text: string): boolean => markRunOns(text.trim()) !== text.trim();

/**
 * 문장으로 나눈다. 종결 부호(. ? !) 뒤에 공백이 오는 곳과, 마침표 없이 이어 붙인 곳(RUN_ON)에서 나눈다.
 * "5.7 g"의 점은 문장 끝이 아니다. 마침표를 빼서 문장 수 규칙을 피하는 답도 문장 수대로 센다.
 */
export function splitSentences(text: string): string[] {
  return markRunOns(text.trim())
    .split(/(?<=[.?!])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 문장 수·길이만 보는 검사(too-long). */
export const isTooLong = (text: string): boolean => {
  const t = text.trim();
  return t.length > MAX_RESPONSE_CHARS || splitSentences(t).length > MAX_SENTENCES || t.length === 0;
};

export const hasQuestion = (text: string): boolean => splitSentences(text).some((s) => s.endsWith('?'));
export const hasJudgment = (text: string): boolean => JUDGMENT_WORDS.some((w) => text.includes(w));

/** 튜터 응답이 출력 규칙(사양 1.3)을 지키는지 검사한다. */
export function checkTutorResponse(text: string, experiment: TutorCheckExperiment): TutorCheckResult {
  const problems: string[] = [];
  const guard = guardModelOutput(text, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits });
  for (const hit of guard.hits) problems.push(`guard:${hit}`);
  if (isTooLong(text)) problems.push('too-long');
  if (!hasQuestion(text)) problems.push('no-question');
  if (hasJudgment(text)) problems.push('judgment');
  if (hasPersonalInfo(text)) problems.push('personal-info');
  return { ok: problems.length === 0, problems };
}

/** 질문 문장 수. */
export const countQuestions = (text: string): number => splitSentences(text).filter((s) => s.endsWith('?')).length;

/**
 * 모델 답의 질문은 하나만(학생이 한 번에 하나씩 답하게. 모델은 직전에 한 질문을 기억하지 못한다).
 * 교사가 고치는 앱 기본 질문에는 이 규칙을 쓰지 않는다(checkTutorResponse는 그대로).
 */
export const MAX_MODEL_QUESTIONS = 1;
const INTERROGATIVE = /(어떤|어떻게|무엇|무슨|뭐|어느|어디|언제|왜|몇|누가|누구|얼마)/;

/**
 * 질문 두 개("Q1? Q2?")를 하나로: 첫 질문이 의문사 없는 권유("…살펴볼까요?")면 "…살펴봐요."로 바꿔 두 번째 질문 앞에 두고,
 * 아니면 첫 질문만 남긴다. 질문이 하나 이하이거나 모양이 다르면 그대로 둔다.
 */
export function oneQuestion(text: string): string {
  const s = splitSentences(text);
  if (s.length !== 2 || !s[0]!.endsWith('?') || !s[1]!.endsWith('?')) return text.trim();
  const [q1, q2] = s as [string, string];
  return !INTERROGATIVE.test(q1) && /볼까요\?$/.test(q1) ? `${q1.replace(/볼까요\?$/, '봐요.')} ${q2}` : q1;
}

/** 모델 답(학습 견본·모델 출력) 검사: checkTutorResponse에 질문 하나 규칙(`two-questions`)을 더한다. */
export function checkModelResponse(text: string, experiment: TutorCheckExperiment): TutorCheckResult {
  const r = checkTutorResponse(text, experiment);
  if (countQuestions(text) <= MAX_MODEL_QUESTIONS) return r;
  return { ok: false, problems: [...r.problems, 'two-questions'] };
}

/**
 * 모델 출력 다듬기: 세 문장 이상이면 첫 문장과 그 뒤의 첫 질문 문장만 남긴다(규칙: 1~2문장, 질문으로 끝남).
 * 첫 문장이 질문이면 그 문장만 남긴다. 마침표 없이 이어 붙인 문장에는 마침표를 찍고, 질문이 둘이면 하나로 줄인다(oneQuestion).
 * 질문이 없으면 그대로 둔다(그 뒤의 검사가 판단한다).
 */
export function tidyTutorOutput(text: string): string {
  return oneQuestion(tidySentences(text));
}

function tidySentences(text: string): string {
  const s = splitSentences(text);
  // 마침표 없이 이어 붙인 문장은 끝에 마침표를 찍어 준다.
  const end = (x: string) => (/[.?!]$/.test(x) ? x : `${x}.`);
  if (s.length === 2 && !/[.?!]$/.test(s[0]!) && s[1]!.endsWith('?')) return `${end(s[0]!)} ${s[1]}`;
  if (s.length <= MAX_SENTENCES) return text.trim();
  if (s[0]!.endsWith('?')) return s[0]!;
  const q = s.slice(1).find((x) => x.endsWith('?'));
  return q ? `${end(s[0]!)} ${q}` : text.trim();
}

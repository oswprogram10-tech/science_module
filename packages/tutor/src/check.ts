import { guardOutput } from './index';

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

/** 종결 부호(. ? !) 뒤에 공백이 오는 곳에서 나눈다. "5.7 g"의 점은 문장 끝이 아니다. */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.?!])\s+/)
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
  const guard = guardOutput(text, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits });
  for (const hit of guard.hits) problems.push(`guard:${hit}`);
  if (isTooLong(text)) problems.push('too-long');
  if (!hasQuestion(text)) problems.push('no-question');
  if (hasJudgment(text)) problems.push('judgment');
  if (hasPersonalInfo(text)) problems.push('personal-info');
  return { ok: problems.length === 0, problems };
}

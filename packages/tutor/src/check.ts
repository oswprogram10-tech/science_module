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
 * 마침표 없이 이어 붙인 문장의 경계: 평서·감탄 종결 어미 뒤에 공백과 한글·숫자·여는 따옴표가 오는 곳("관찰은 아직 없어요 기록 두 칸에는…", "바꾸었어요 1 °C 안이 된 때…").
 * 질문 어미(까요·나요·가요)는 넣지 않는다. 카드 기준 이름("눈에 보이나요 기준")이나 칸 이름("움직이나요 칸")과 헷갈린다.
 */
const RUN_ON = /(어요|아요|해요|예요|에요|네요|군요|래요|대요|세요|데요|죠|니다)\s+(?=[가-힣0-9‘“'"(])/g;

/**
 * 문장으로 나눈다. 종결 부호(. ? !) 뒤에 공백이 오는 곳과, 마침표 없이 이어 붙인 곳(RUN_ON)에서 나눈다.
 * "5.7 g"의 점은 문장 끝이 아니다. 마침표를 빼서 문장 수 규칙을 피하는 답도 문장 수대로 센다.
 */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .replace(RUN_ON, '$1\n')
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

/**
 * 모델 출력 다듬기: 세 문장 이상이면 첫 문장과 그 뒤의 첫 질문 문장만 남긴다(규칙: 1~2문장, 질문으로 끝남).
 * 첫 문장이 질문이면 그 문장만 남긴다. 질문이 없거나 두 문장 이하이면 그대로 둔다(그 뒤의 검사가 판단한다).
 */
export function tidyTutorOutput(text: string): string {
  const s = splitSentences(text);
  // 마침표 없이 이어 붙인 문장은 끝에 마침표를 찍어 준다.
  const end = (x: string) => (/[.?!]$/.test(x) ? x : `${x}.`);
  if (s.length === 2 && s[1]!.endsWith('?')) return `${end(s[0]!)} ${s[1]}`;
  if (s.length <= MAX_SENTENCES) return text.trim();
  if (s[0]!.endsWith('?')) return s[0]!;
  const q = s.slice(1).find((x) => x.endsWith('?'));
  return q ? `${end(s[0]!)} ${q}` : text.trim();
}

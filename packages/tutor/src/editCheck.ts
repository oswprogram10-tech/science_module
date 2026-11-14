import { checkTutorResponse, type TutorCheckExperiment } from './check';
import { PLACEHOLDER_DISPLAY, PLACEHOLDER_SAMPLE } from './situationLabels';
import { FOREIGN_SCRIPT_HIT, LATIN_WORD_HIT, MASK_ECHO_HIT } from './index';

/** `checkTutorResponse`의 문제 하나를 교사에게 보여 줄 한국어 문장으로. */
export function problemMessage(problem: string): string {
  if (problem === `guard:${LATIN_WORD_HIT}`) return '영어 낱말이나 깨진 글자가 들어 있어요. 한국어로 고쳐 주세요(cm, mL 같은 단위는 괜찮아요).';
  if (problem === `guard:${FOREIGN_SCRIPT_HIT}`) return '한자나 일본 글자가 들어 있어요. 한글로 고쳐 주세요.';
  if (problem === `guard:${MASK_ECHO_HIT}`) return '[이름] 같은 개인정보 자리표시는 쓸 수 없어요.';
  if (problem.startsWith('guard:')) return `정답이나 학년에 맞지 않는 말이 들어 있어요: ‘${problem.slice('guard:'.length)}’`;
  switch (problem) {
    case 'too-long':
      return '120자, 두 문장 안으로 줄여 주세요';
    case 'no-question':
      return '물음표로 끝나는 질문이 있어야 해요';
    case 'judgment':
      return '맞다·틀리다는 판정 말은 쓰지 않아요';
    case 'personal-info':
      return '전화번호·이메일은 넣을 수 없어요';
    default:
      return problem;
  }
}

export interface EditCheckContext extends TutorCheckExperiment {
  /** 이 활동에서 쓸 수 있는 자리표시 이름(그 활동의 기본 질문에 나오는 것): iv, changed, card, criterion, solution. */
  placeholders: readonly string[];
}

export interface EditCheckResult {
  ok: boolean;
  /** 교사에게 보여 줄 한국어 문제 목록(통과하면 비어 있다). */
  messages: string[];
}

/** 교사 화면 글(자리표시는 〔…〕)에서 쓸 수 없는 칸을 찾는다. 〔…〕로 쓴 모르는 칸이나 이 활동에 없는 칸, 직접 쓴 `{…}`. */
export function unknownPlaceholders(display: string, allowed: readonly string[]): string[] {
  const ok = new Set(allowed.map((k) => PLACEHOLDER_DISPLAY[k]).filter((v): v is string => !!v));
  const bad: string[] = [];
  for (const m of display.match(/〔[^〕]*〕|\{[^{}]*\}/g) ?? []) if (!ok.has(m) && !bad.includes(m)) bad.push(m);
  return bad;
}

/**
 * 교사가 고친 질문(교사 화면 글)을 검사한다. 자리표시는 예시 말("조건", "카드" 등)로 바꿔 `checkTutorResponse`에 넘긴다.
 * 가드는 그 활동의 forbiddenAnswers와 limits이다.
 */
export function checkEditedText(display: string, ctx: EditCheckContext): EditCheckResult {
  const messages: string[] = [];
  if (display.trim().length === 0) return { ok: false, messages: ['질문을 입력해 주세요'] };
  for (const bad of unknownPlaceholders(display, ctx.placeholders)) messages.push(`쓸 수 없는 칸이에요: ${bad}`);
  let sample = display;
  for (const [k, v] of Object.entries(PLACEHOLDER_DISPLAY)) sample = sample.replaceAll(v, PLACEHOLDER_SAMPLE[k] ?? '');
  for (const p of checkTutorResponse(sample, ctx).problems) messages.push(problemMessage(p));
  return { ok: messages.length === 0, messages };
}

import { z } from 'zod';

/** 튜터 질문 덧씌우기(edits)를 직렬화했을 때의 최대 크기(바이트). */
export const MAX_TUTOR_EDITS_BYTES = 48 * 1024;

export const UNIT_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
export const EXPERIMENT_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
/** `${task ?? ''}|${when}|${iv ?? ''}` */
export const PROBE_KEY_PATTERN = /^[a-z0-9-]{0,40}\|[a-z0-9-]{1,40}\|[A-Za-z0-9-]{0,40}$/;

const unitId = z.string().regex(UNIT_ID_PATTERN);
const experimentId = z.string().regex(EXPERIMENT_ID_PATTERN);
const probeKey = z.string().regex(PROBE_KEY_PATTERN);
const shortText = z.string().min(1).max(64);
const probeText = z.string().min(1).max(200);

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** `@sci/schema`의 answerKeySchema와 같은 모양(이 패키지는 콘텐츠 스키마에 기대지 않는다). 결론 알아보기 한 줄. */
export const answerKeyEditSchema = z.strictObject({
  iv: shortText.optional(),
  conclusion: z.string().min(1).max(80),
  keys: z.array(z.array(z.string().min(1).max(20)).min(1).max(12)).min(1).max(6),
  not: z.array(z.string().min(1).max(20)).max(12).optional(),
  confirm: z.string().min(1).max(80),
});
export const MAX_ANSWERS = 8;

export const experimentEditsSchema = z.strictObject({
  changed: z.record(probeKey, z.strictObject({ text: probeText.optional(), off: z.literal(true).optional() })),
  added: z.array(z.strictObject({ task: shortText.optional(), when: shortText, iv: shortText.optional(), text: probeText })).max(20),
  /** 변인 실험의 결론 알아보기(answers)를 통째로 바꾼다(튜터 대화 v1). 없으면 기본. */
  answers: z.array(answerKeyEditSchema).max(MAX_ANSWERS).optional(),
});

export const tutorEditsSchema = z
  .strictObject({
    v: z.literal(1),
    units: z.record(unitId, z.record(experimentId, experimentEditsSchema)),
  })
  .refine((v) => byteLength(JSON.stringify(v)) <= MAX_TUTOR_EDITS_BYTES, { message: '튜터 질문 덧씌우기가 너무 커요(48 KB 이하).' });

export type TutorEdits = z.infer<typeof tutorEditsSchema>;
export type ExperimentEdits = z.infer<typeof experimentEditsSchema>;
export type AnswerKeyEdit = z.infer<typeof answerKeyEditSchema>;

export const EMPTY_TUTOR_EDITS: TutorEdits = { v: 1, units: {} };

/** 질문 하나를 구별하는 키. task는 관찰 활동의 과제 id, iv는 변인 실험의 조작변인 key. */
export const editKey = (task: string | undefined, when: string, iv: string | undefined): string => `${task ?? ''}|${when}|${iv ?? ''}`;

/** 고친 질문·끈 질문·더한 질문의 개수. */
export function countTutorEdits(edits: TutorEdits | null | undefined): { changed: number; off: number; added: number } {
  let changed = 0;
  let off = 0;
  let added = 0;
  for (const unit of Object.values(edits?.units ?? {})) {
    for (const exp of Object.values(unit)) {
      for (const e of Object.values(exp.changed)) {
        if (e.off) off++;
        else if (e.text !== undefined) changed++;
      }
      added += exp.added.length;
    }
  }
  return { changed, off, added };
}

/** 결론 알아보기(answers)를 고친 활동의 수(countTutorEdits와 따로 센다). */
export function countAnswerEdits(edits: TutorEdits | null | undefined): number {
  let n = 0;
  for (const unit of Object.values(edits?.units ?? {})) for (const exp of Object.values(unit)) if (exp.answers !== undefined) n++;
  return n;
}

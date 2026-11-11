import { z } from 'zod';
import { MAX_TUTOR_EDITS_BYTES, tutorEditsSchema } from './tutorEdits';

/** 수업 코드: 6자. 헷갈리는 0·O·1·I·L은 쓰지 않는다. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const MIN_GROUP = 1;
export const MAX_GROUPS = 12;
/** 메시지 하나의 최대 크기(바이트). */
export const MAX_MESSAGE_BYTES = 8 * 1024;
/** `t:'tutor'` 메시지만 이 크기까지 받는다(덧씌우기 본문 48 KB + 봉투). */
export const MAX_TUTOR_MESSAGE_BYTES = MAX_TUTOR_EDITS_BYTES + 64;
export const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

const codeSchema = z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
const tokenSchema = z.string().regex(TOKEN_PATTERN);
const groupSchema = z.number().int().min(MIN_GROUP).max(MAX_GROUPS);
const shortText = z.string().min(1).max(64);

export const SAFETY_TYPES = ['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD'] as const;
export const safetyTypeSchema = z.enum(SAFETY_TYPES);
export type SafetyType = z.infer<typeof safetyTypeSchema>;

export const activitySchema = z.enum(['variable', 'classify', 'observe', 'card-sort', 'portfolio']);
export type Activity = z.infer<typeof activitySchema>;
export const phaseSchema = z.enum(['designing', 'running', 'reviewing', 'idle']);
export type Phase = z.infer<typeof phaseSchema>;
export const tierSchema = z.enum(['A', 'B', 'C']);
export type DeviceTier = z.infer<typeof tierSchema>;

export const ERROR_CODES = ['bad_message', 'no_class', 'bad_token', 'group_taken', 'class_full', 'rate_limited', 'bad_secret', 'not_local'] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// ---- 학생 -> 서버 ----
export const joinSchema = z.strictObject({
  t: z.literal('join'),
  code: codeSchema,
  group: groupSchema,
  deviceTier: tierSchema.optional(),
  appVersion: z.string().min(1).max(32),
});
export const statusSchema = z.strictObject({
  t: z.literal('status'),
  // 단원 목록에 있을 때(idle)는 단원과 활동이 없다.
  unitId: shortText.optional(),
  activity: activitySchema.optional(),
  // 한 단원에 활동이 여럿일 때 어느 활동인지(없으면 첫 활동). 오래된 학생 앱은 보내지 않는다.
  experimentId: shortText.optional(),
  phase: phaseSchema,
  trials: z.number().int().min(0).max(9999),
  lastKind: shortText.optional(),
  mismatch: z.boolean().optional(),
  safetyLocked: z.boolean(),
});
export const safetySchema = z.strictObject({
  t: z.literal('safety'),
  type: safetyTypeSchema,
  at: z.number().int().nonnegative(),
});
export const safetyClearSchema = z.strictObject({ t: z.literal('safetyClear'), type: safetyTypeSchema });

// ---- 교사 -> 서버 ----
/** secret: 서버에 CREATE_SECRET이 설정돼 있을 때만 필요하다. */
export const createSchema = z.strictObject({ t: z.literal('create'), secret: z.string().max(64).optional() });
export const watchSchema = z.strictObject({ t: z.literal('watch'), code: codeSchema, token: tokenSchema });
export const pauseSchema = z.strictObject({ t: z.literal('pause'), on: z.boolean() });
export const ackSchema = z.strictObject({ t: z.literal('ack'), group: groupSchema, type: safetyTypeSchema });
export const endSchema = z.strictObject({ t: z.literal('end') });
/** 교사가 학생 기기에 보낼 튜터 질문 덧씌우기. 서버는 마지막 것을 메모리에 두었다가 학생에게 보낸다. */
export const tutorSchema = z.strictObject({ t: z.literal('tutor'), edits: tutorEditsSchema });

export const clientMessageSchema = z.discriminatedUnion('t', [
  joinSchema,
  statusSchema,
  safetySchema,
  safetyClearSchema,
  createSchema,
  watchSchema,
  pauseSchema,
  ackSchema,
  endSchema,
  tutorSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type JoinMessage = z.infer<typeof joinSchema>;
export type StatusMessage = z.infer<typeof statusSchema>;

// ---- 서버 -> 학생·교사 ----
export const groupViewSchema = z.strictObject({
  group: groupSchema,
  online: z.boolean(),
  lastSeen: z.number(),
  deviceTier: tierSchema.optional(),
  unitId: shortText.optional(),
  activity: activitySchema.optional(),
  experimentId: shortText.optional(),
  phase: phaseSchema.optional(),
  trials: z.number().int().min(0),
  lastKind: shortText.optional(),
  mismatch: z.boolean(),
  safety: z.array(z.strictObject({ type: safetyTypeSchema, at: z.number(), acked: z.boolean() })),
  safetyLocked: z.boolean(),
});
export type GroupView = z.infer<typeof groupViewSchema>;

export const snapshotSchema = z.strictObject({
  t: z.literal('snapshot'),
  code: codeSchema,
  paused: z.boolean(),
  groups: z.array(groupViewSchema).max(MAX_GROUPS),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const serverMessageSchema = z.discriminatedUnion('t', [
  z.strictObject({ t: z.literal('joined'), code: codeSchema, group: groupSchema }),
  z.strictObject({ t: z.literal('pause'), on: z.boolean() }),
  z.strictObject({ t: z.literal('ended') }),
  z.strictObject({ t: z.literal('error'), code: errorCodeSchema }),
  z.strictObject({ t: z.literal('created'), code: codeSchema, token: tokenSchema }),
  z.strictObject({ t: z.literal('tutor'), edits: tutorEditsSchema }),
  snapshotSchema,
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/**
 * 크기 규칙: 일반 메시지는 8 KB까지. 8 KB를 넘으면 `"t":"tutor"`로 시작하는 메시지만 48 KB(+여유)까지 파싱한다.
 * (파싱한 결과가 tutor가 아니면 거부한다.)
 */
function withinLimit(raw: string): 'small' | 'tutor' | null {
  const bytes = byteLength(raw);
  if (bytes <= MAX_MESSAGE_BYTES) return 'small';
  if (bytes <= MAX_TUTOR_MESSAGE_BYTES && raw.slice(0, 64).replace(/\s+/g, '').startsWith('{"t":"tutor"')) return 'tutor';
  return null;
}

/** 받은 글자를 클라이언트 메시지로 바꾼다. 8 KB 초과(tutor 제외), JSON 오류, 규격 위반이면 null. */
export function parseClientMessage(raw: string): ClientMessage | null {
  const size = withinLimit(raw);
  if (!size) return null;
  try {
    const r = clientMessageSchema.safeParse(JSON.parse(raw));
    if (!r.success) return null;
    return size === 'tutor' && r.data.t !== 'tutor' ? null : r.data;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const size = withinLimit(raw);
  if (!size) return null;
  try {
    const r = serverMessageSchema.safeParse(JSON.parse(raw));
    if (!r.success) return null;
    return size === 'tutor' && r.data.t !== 'tutor' ? null : r.data;
  } catch {
    return null;
  }
}

/** 수업 코드로 쓸 수 있게 다듬는다(공백 제거, 대문자). 규격에 맞지 않으면 null. */
export function normalizeCode(input: string): string | null {
  const c = input.replace(/\s+/g, '').toUpperCase();
  return codeSchema.safeParse(c).success ? c : null;
}

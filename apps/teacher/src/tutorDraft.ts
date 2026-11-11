import { tutorEditsSchema, type TutorEdits } from '@sci/classroom';
import { SITUATIONS_BY_KIND, checkEditedText, fromDisplayText, toDisplayText, type EditCheckResult } from '@sci/tutor';
import { keyOf, type CatalogExperiment, type CatalogUnit } from './tutorCatalog';

/** 편집 중인 질문 한 줄: text는 교사 화면 글(자리표시가 〔…〕). 저장하기 전까지는 검사를 통과하지 못한 글도 들어 있을 수 있다. */
export interface DraftEntry {
  text?: string;
  off?: boolean;
}
export interface DraftAdded {
  task?: string;
  when: string;
  iv?: string;
  text: string;
}
export interface DraftExp {
  changed: Record<string, DraftEntry>;
  added: DraftAdded[];
}
/** unitId -> experimentId -> 편집 중인 내용 */
export type Draft = Record<string, Record<string, DraftExp>>;

export const MAX_ADDED = 20;

export const emptyDraftExp = (): DraftExp => ({ changed: {}, added: [] });

export function checkLine(exp: CatalogExperiment, display: string): EditCheckResult {
  return checkEditedText(display, { limits: exp.limits, tutor: { forbiddenAnswers: exp.forbiddenAnswers }, placeholders: exp.placeholders });
}

/** 저장된 덧씌우기를 편집용(교사 화면 글)으로. */
export function draftFromEdits(edits: TutorEdits): Draft {
  const out: Draft = {};
  for (const [u, exps] of Object.entries(edits.units)) {
    out[u] = {};
    for (const [e, exp] of Object.entries(exps)) {
      out[u]![e] = {
        changed: Object.fromEntries(Object.entries(exp.changed).map(([k, v]) => [k, { ...(v.text !== undefined ? { text: toDisplayText(v.text) } : {}), ...(v.off ? { off: true } : {}) }])),
        added: exp.added.map((a) => ({ ...(a.task !== undefined ? { task: a.task } : {}), when: a.when, ...(a.iv !== undefined ? { iv: a.iv } : {}), text: toDisplayText(a.text) })),
      };
    }
  }
  return out;
}

const findExp = (catalog: CatalogUnit[], u: string, e: string): CatalogExperiment | undefined => catalog.find((x) => x.id === u)?.experiments.find((x) => x.id === e);

/** 이 줄(기본 질문)의 글이 기본과 다른가. 다르면 검사 대상이다. */
export const isTextChanged = (exp: CatalogExperiment, key: string, display: string | undefined): boolean => {
  if (display === undefined) return false;
  const base = exp.probes.find((p) => p.key === key);
  return !base || fromDisplayText(display) !== base.text;
};

/** 줄 하나의 검사 결과. 검사할 필요가 없는 줄(기본 그대로, 꺼진 줄)이면 null. */
export function lineCheck(exp: CatalogExperiment, key: string, entry: DraftEntry): EditCheckResult | null {
  if (entry.off || !isTextChanged(exp, key, entry.text)) return null;
  return checkLine(exp, entry.text!);
}

/** 저장할 수 없는 줄이 있는가(검사를 통과하지 못한 고친 줄이나 더한 줄). */
export function hasInvalid(draft: Draft, catalog: CatalogUnit[]): boolean {
  for (const [u, exps] of Object.entries(draft)) {
    for (const [e, d] of Object.entries(exps)) {
      const exp = findExp(catalog, u, e);
      if (!exp) continue;
      for (const [key, entry] of Object.entries(d.changed)) if (lineCheck(exp, key, entry)?.ok === false) return true;
      for (const a of d.added) if (!checkLine(exp, a.text).ok) return true;
    }
  }
  return false;
}

/**
 * 편집 내용을 저장 형태로 바꾼다. 기본과 같아진 줄, 아무것도 남지 않은 줄·활동·단원은 뺀다.
 * 검사를 통과하지 못한 글은 저장하지 않는다(끈 줄의 글은 통과했을 때만 함께 둔다). 없는 활동·질문은 뺀다.
 */
export function draftToEdits(draft: Draft, catalog: CatalogUnit[]): TutorEdits {
  const units: TutorEdits['units'] = {};
  for (const [u, exps] of Object.entries(draft)) {
    for (const [e, d] of Object.entries(exps)) {
      const exp = findExp(catalog, u, e);
      if (!exp) continue;
      const changed: TutorEdits['units'][string][string]['changed'] = {};
      for (const [key, entry] of Object.entries(d.changed)) {
        if (!exp.probes.some((p) => p.key === key)) continue;
        const textOk = entry.text !== undefined && isTextChanged(exp, key, entry.text) && checkLine(exp, entry.text).ok;
        if (!entry.off && !textOk) continue;
        changed[key] = { ...(textOk ? { text: fromDisplayText(entry.text!) } : {}), ...(entry.off ? { off: true as const } : {}) };
      }
      const added = d.added.filter((a) => checkLine(exp, a.text).ok).map((a) => ({ ...(a.task !== undefined ? { task: a.task } : {}), when: a.when, ...(a.iv !== undefined ? { iv: a.iv } : {}), text: fromDisplayText(a.text) }));
      if (Object.keys(changed).length === 0 && added.length === 0) continue;
      (units[u] ??= {})[e] = { changed, added };
    }
  }
  return { v: 1, units };
}

/** 저장해도 되는가: 규격(크기 48 KB 포함)에 맞는지. 맞지 않으면 한국어 이유. */
export function validateEdits(edits: TutorEdits): { ok: true } | { ok: false; message: string } {
  const r = tutorEditsSchema.safeParse(edits);
  if (r.success) return { ok: true };
  const tooBig = r.error.issues.some((i) => i.code === 'custom');
  return { ok: false, message: tooBig ? '고친 내용이 너무 많아서 저장할 수 없어요. 일부를 기본으로 되돌려 주세요.' : '저장할 수 없는 내용이 있어요.' };
}

export const sameEdits = (a: TutorEdits, b: TutorEdits): boolean => JSON.stringify(a) === JSON.stringify(b);

// ---- 파일로 내보내기·불러오기 ----

export const exportFileName = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `튜터질문-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
};

export const exportJson = (edits: TutorEdits): string => JSON.stringify(edits, null, 2);

export interface ImportResult {
  /** 파일 형식 자체가 맞지 않을 때의 한국어 이유(이때는 draft가 없다). */
  error?: string;
  draft: Draft;
  accepted: number;
  rejected: { reason: string; count: number }[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const validText = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= 200;
const validShort = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= 64;

/**
 * 내보낸 파일(JSON 글자)을 읽는다. 스키마와 검사를 통과한 줄만 넣고, 넣지 못한 줄의 수와 이유를 돌려준다.
 * 이 앱에 없는 단원·활동·질문, 상황 목록에 없는 더하기, 검사를 통과하지 못한 글은 넣지 않는다.
 */
export function importEdits(raw: string, catalog: CatalogUnit[]): ImportResult {
  const empty: ImportResult = { draft: {}, accepted: 0, rejected: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...empty, error: '파일을 읽을 수 없어요. 내보낸 튜터 질문 파일(.json)인지 확인해 주세요.' };
  }
  if (!isObj(data) || data.v !== 1 || !isObj(data.units)) return { ...empty, error: '튜터 질문 파일이 아니에요. 이 앱에서 내보낸 파일을 골라 주세요.' };

  const draft: Draft = {};
  const rejects = new Map<string, number>();
  let accepted = 0;
  const reject = (reason: string, n = 1) => rejects.set(reason, (rejects.get(reason) ?? 0) + n);
  const lineCount = (v: unknown): number => (isObj(v) ? (isObj(v.changed) ? Object.keys(v.changed).length : 0) + (Array.isArray(v.added) ? v.added.length : 0) : 1) || 1;

  for (const [u, exps] of Object.entries(data.units)) {
    if (!isObj(exps)) {
      reject('형식이 맞지 않는 줄');
      continue;
    }
    for (const [e, body] of Object.entries(exps)) {
      const exp = findExp(catalog, u, e);
      if (!exp) {
        reject('이 앱에 없는 단원이나 활동이에요', lineCount(body));
        continue;
      }
      if (!isObj(body)) {
        reject('형식이 맞지 않는 줄');
        continue;
      }
      const out = emptyDraftExp();
      const changed = isObj(body.changed) ? body.changed : {};
      for (const [key, entry] of Object.entries(changed)) {
        if (!exp.probes.some((p) => p.key === key)) {
          reject('이 앱에 없는 질문이에요');
          continue;
        }
        if (!isObj(entry) || Object.keys(entry).some((k) => k !== 'text' && k !== 'off') || (entry.text !== undefined && !validText(entry.text)) || (entry.off !== undefined && entry.off !== true)) {
          reject('형식이 맞지 않는 줄');
          continue;
        }
        const display = typeof entry.text === 'string' ? toDisplayText(entry.text) : undefined;
        let text = display;
        if (display !== undefined && isTextChanged(exp, key, display)) {
          const r = checkLine(exp, display);
          if (!r.ok) {
            reject(`검사를 통과하지 못했어요: ${r.messages[0]}`);
            text = undefined;
          }
        } else if (display !== undefined) {
          text = undefined; // 기본과 같은 글은 고친 것이 아니다.
        }
        if (text === undefined && entry.off !== true) {
          if (display === undefined) reject('고친 내용이 없는 줄');
          continue;
        }
        out.changed[key] = { ...(text !== undefined ? { text } : {}), ...(entry.off === true ? { off: true } : {}) };
        accepted++;
      }
      const added = Array.isArray(body.added) ? body.added : [];
      for (const a of added) {
        if (out.added.length >= MAX_ADDED) {
          reject(`더한 질문은 활동마다 ${MAX_ADDED}개까지예요`);
          continue;
        }
        if (!isObj(a) || !validShort(a.when) || !validText(a.text) || (a.task !== undefined && !validShort(a.task)) || (a.iv !== undefined && !validShort(a.iv)) || Object.keys(a).some((k) => !['task', 'when', 'iv', 'text'].includes(k))) {
          reject('형식이 맞지 않는 줄');
          continue;
        }
        const task = a.task as string | undefined;
        const iv = a.iv as string | undefined;
        const taskOk = exp.kind === 'observation' ? task !== undefined && exp.tasks.some((t) => t.id === task) : task === undefined;
        const ivOk = iv === undefined || (exp.kind === 'variable' && a.when === 'fair-test' && exp.ivs.some((v) => v.key === iv));
        if (!taskOk || !ivOk || !SITUATIONS_BY_KIND[exp.kind].includes(a.when as string)) {
          reject('이 활동에서 더할 수 없는 상황이에요');
          continue;
        }
        const key = keyOf(task, a.when as string, iv);
        if (exp.probes.some((p) => p.key === key) || out.added.some((x) => keyOf(x.task, x.when, x.iv) === key)) {
          reject('그 상황에는 이미 질문이 있어요');
          continue;
        }
        const display = toDisplayText(a.text as string);
        const r = checkLine(exp, display);
        if (!r.ok) {
          reject(`검사를 통과하지 못했어요: ${r.messages[0]}`);
          continue;
        }
        out.added.push({ ...(task !== undefined ? { task } : {}), when: a.when as string, ...(iv !== undefined ? { iv } : {}), text: display });
        accepted++;
      }
      if (Object.keys(out.changed).length > 0 || out.added.length > 0) (draft[u] ??= {})[e] = out;
    }
  }
  return { draft, accepted, rejected: [...rejects].map(([reason, count]) => ({ reason, count })) };
}

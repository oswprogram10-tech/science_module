import type { Experiment, Manifest } from '@sci/schema';
import {
  buildTutorInput,
  templateProbeFor,
  situationOf,
  PROMPT_VERSION,
  TUTOR_SYSTEM,
  type TutorState,
  type UnitInfo,
} from './context';
import {
  checkModelResponse,
  countQuestions,
  MAX_MODEL_QUESTIONS,
  hasJudgment,
  hasPersonalInfo,
  hasQuestion,
  isTooLong,
} from './check';
import { guardOutput } from './index';

// ---- 레코드 형식 (사양 2.1) ----

export const SOURCES = ['teacher', 'pilot-log', 'example'] as const;
export type Source = (typeof SOURCES)[number];

export const RECORD_KINDS = ['sft', 'pairs', 'redteam'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const REJECTED_REASONS = [
  'answer-leak',
  'judgment',
  'grade-term',
  'too-long',
  'off-topic',
  'not-a-question',
  'two-questions',
] as const;
export type RejectedReason = (typeof REJECTED_REASONS)[number];

export const REDTEAM_CATEGORIES = [
  'ask-answer',
  'ask-report',
  'jailbreak',
  'off-topic',
  'rude',
  'personal-info',
] as const;
export type RedteamCategory = (typeof REDTEAM_CATEGORIES)[number];

export interface BaseRecord {
  id: string;
  unitId: string;
  scenarioId: string;
  /** 빈 문자열은 "말하지 않음". */
  utterance: string;
  source: Source;
  reviewed: boolean;
  /** 교사 가명 코드(예: T03). 실명 금지. */
  author: string;
  notes?: string;
}
export interface SftRecord extends BaseRecord {
  response: string;
}
export interface PairRecord extends BaseRecord {
  chosen: string;
  rejected: string;
  rejectedReason: RejectedReason;
}
export interface RedteamRecord extends BaseRecord {
  category: RedteamCategory;
  mustNotContain: string[];
  reference?: string;
}
export type AnyRecord = SftRecord | PairRecord | RedteamRecord;

export interface Scenario {
  scenarioId: string;
  unitId: string;
  /** 교사용 한 줄 설명. */
  title: string;
  state: TutorState;
}

/** 내보내기와 검증이 읽는 데이터 묶음. */
export interface UnitData {
  manifest: Manifest;
}
export interface Dataset {
  units: Record<string, UnitData>;
  scenarios: Scenario[];
  sft: SftRecord[];
  pairs: PairRecord[];
  redteam: RedteamRecord[];
}

export const emptyDataset = (units: Record<string, UnitData>): Dataset => ({
  units,
  scenarios: [],
  sft: [],
  pairs: [],
  redteam: [],
});

// ---- 단원·실험 찾기 ----

export function experimentOf(units: Record<string, UnitData>, scenario: Pick<Scenario, 'unitId' | 'state'>): Experiment | undefined {
  return units[scenario.unitId]?.manifest.experiments.find((e) => e.id === scenario.state.experimentId);
}

export function unitInfo(units: Record<string, UnitData>, unitId: string): UnitInfo | undefined {
  const m = units[unitId]?.manifest;
  return m ? { title: m.title, grade: m.grade } : undefined;
}

/** 시나리오의 모델 입력. 단원 정보까지 넣은 최종 문자열. */
export function inputFor(ds: Pick<Dataset, 'units'>, scenario: Scenario, utterance: string, previousTutor?: string): string {
  const exp = experimentOf(ds.units, scenario);
  if (!exp) throw new Error(`실험을 찾을 수 없습니다: ${scenario.unitId}/${scenario.state.experimentId}`);
  return buildTutorInput(exp, scenario.state, utterance, unitInfo(ds.units, scenario.unitId), previousTutor);
}

/** 레코드 id의 안정된 해시(내보낼 때 직전 튜터 질문을 넣을지, 무엇을 넣을지 정한다). */
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const sameText = (a: string, b: string) => a.replace(/\s/g, '') === b.replace(/\s/g, '');

/**
 * 직전 튜터 질문(프롬프트 v3). 학생 말이 있는 레코드의 절반에, 같은 시나리오에서 학생이 말하지 않았을 때의 견본 답
 * (= 튜터가 먼저 한 질문)을 넣는다. 나머지는 첫 차례처럼 넣지 않는다. 답과 같은 문장은 고르지 않는다.
 */
export function previousTutorFor(
  rec: BaseRecord,
  target: string | undefined,
  openers: ReadonlyMap<string, readonly string[]>,
  template?: string,
): string | undefined {
  if (!rec.utterance.trim()) return undefined;
  const h = idHash(rec.id);
  if (h % 2 === 1) return undefined;
  // 같은 시나리오에서 학생이 말하지 않았을 때의 견본 답이 없으면, 학생 앱이 그 상태에 보여 주는 기본 질문을 쓴다.
  const cands = [...(openers.get(rec.scenarioId) ?? []), ...(template ? [template] : [])].filter((t) => !target || !sameText(t, target));
  return cands.length > 0 ? cands[(h >>> 1) % cands.length] : undefined;
}

// ---- 라벨 <-> enum (교사 CSV) ----

export const REJECTED_REASON_LABEL: Record<RejectedReason, string> = {
  'answer-leak': '정답을 알려 줌',
  judgment: '맞다·틀리다고 판정함',
  'grade-term': '학년 밖 어려운 용어',
  'too-long': '너무 김',
  'off-topic': '실험과 상관없음',
  'not-a-question': '질문이 아님',
  'two-questions': '질문이 두 개',
};

export const REDTEAM_CATEGORY_LABEL: Record<RedteamCategory, string> = {
  'ask-answer': '정답을 알려 달라고 함',
  'ask-report': '보고서를 대신 써 달라고 함',
  jailbreak: '규칙을 무시하게 하려 함',
  'off-topic': '실험과 상관없는 말',
  rude: '욕설·무례한 말',
  'personal-info': '개인정보를 말함',
};

function fromLabel<T extends string>(map: Record<T, string>, text: string): T | undefined {
  const t = text.trim();
  for (const [key, label] of Object.entries(map) as [T, string][]) {
    if (t === label || t === key) return key;
  }
  return undefined;
}
export const rejectedReasonFromLabel = (t: string) => fromLabel(REJECTED_REASON_LABEL, t);
export const redteamCategoryFromLabel = (t: string) => fromLabel(REDTEAM_CATEGORY_LABEL, t);

// ---- 레코드 검사 ----

export interface RecordContext {
  units: Record<string, UnitData>;
  scenarios: Map<string, Scenario>;
}

export const makeContext = (ds: Pick<Dataset, 'units' | 'scenarios'>): RecordContext => ({
  units: ds.units,
  scenarios: new Map(ds.scenarios.map((s) => [s.scenarioId, s])),
});

const isString = (v: unknown): v is string => typeof v === 'string';

/** 원시 JSON 값이 레코드 형식(스키마)을 만족하는지 본다. 문제마다 한국어 메시지. */
export function validateRecordShape(kind: RecordKind, raw: unknown): string[] {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['레코드가 객체가 아닙니다.'];
  const r = raw as Record<string, unknown>;
  const need = (key: string, ok: boolean, what: string) => {
    if (!ok) problems.push(`${key}: ${what}`);
  };
  need('id', isString(r.id) && r.id.length > 0, '비어 있지 않은 문자열이어야 합니다.');
  need('unitId', isString(r.unitId) && r.unitId.length > 0, '비어 있지 않은 문자열이어야 합니다.');
  need('scenarioId', isString(r.scenarioId) && r.scenarioId.length > 0, '비어 있지 않은 문자열이어야 합니다.');
  need('utterance', isString(r.utterance), '문자열이어야 합니다(말하지 않음은 빈 문자열).');
  need('source', isString(r.source) && (SOURCES as readonly string[]).includes(r.source), `${SOURCES.join(' / ')} 중 하나여야 합니다.`);
  need('reviewed', typeof r.reviewed === 'boolean', 'true/false여야 합니다.');
  need('author', isString(r.author) && /^[A-Za-z0-9_-]{1,16}$/.test(r.author), '교사 가명 코드(영문·숫자, 예 T03)여야 합니다.');
  need('notes', r.notes === undefined || isString(r.notes), '문자열이어야 합니다.');
  if (kind === 'sft') {
    need('response', isString(r.response) && r.response.trim().length > 0, '비어 있지 않은 문자열이어야 합니다.');
  } else if (kind === 'pairs') {
    need('chosen', isString(r.chosen) && r.chosen.trim().length > 0, '비어 있지 않은 문자열이어야 합니다.');
    need('rejected', isString(r.rejected) && r.rejected.trim().length > 0, '비어 있지 않은 문자열이어야 합니다.');
    need('rejectedReason', isString(r.rejectedReason) && (REJECTED_REASONS as readonly string[]).includes(r.rejectedReason), `${REJECTED_REASONS.join(' / ')} 중 하나여야 합니다.`);
  } else {
    need('category', isString(r.category) && (REDTEAM_CATEGORIES as readonly string[]).includes(r.category), `${REDTEAM_CATEGORIES.join(' / ')} 중 하나여야 합니다.`);
    need('mustNotContain', Array.isArray(r.mustNotContain) && r.mustNotContain.every((x) => isString(x) && x.length > 0), '비어 있지 않은 문자열의 배열이어야 합니다.');
    need('reference', r.reference === undefined || isString(r.reference), '문자열이어야 합니다.');
    need('utterance', isString(r.utterance) && r.utterance.trim().length > 0, '레드팀 발화는 비어 있으면 안 됩니다.');
  }
  return problems;
}

/** 라벨이 가리키는 자동 검사에서 실제로 걸리는가(사양 3.1). answer-leak와 off-topic은 요구하지 않는다. */
export function rejectedReasonDetected(reason: RejectedReason, text: string, exp: Experiment): boolean | null {
  switch (reason) {
    case 'judgment':
      return hasJudgment(text);
    case 'too-long':
      return isTooLong(text);
    case 'not-a-question':
      return !hasQuestion(text);
    case 'two-questions':
      return countQuestions(text) > MAX_MODEL_QUESTIONS;
    case 'grade-term':
      return guardOutput(text, { forbiddenAnswers: [], limits: exp.limits }).hits.length > 0;
    default:
      return null;
  }
}

/** 모양이 맞는 레코드의 내용 검사. */
export function validateRecordContent(kind: RecordKind, rec: AnyRecord, ctx: RecordContext): string[] {
  const problems: string[] = [];
  const unit = ctx.units[rec.unitId];
  if (!unit) problems.push(`unitId "${rec.unitId}"가 없습니다.`);
  const scenario = ctx.scenarios.get(rec.scenarioId);
  if (!scenario) problems.push(`scenarioId "${rec.scenarioId}"가 없습니다.`);
  else if (scenario.unitId !== rec.unitId) problems.push(`scenarioId "${rec.scenarioId}"는 다른 단원(${scenario.unitId})의 시나리오입니다.`);
  if (hasPersonalInfo(rec.utterance)) problems.push('utterance: 전화번호나 이메일처럼 보이는 내용이 있습니다.');
  const exp = scenario && unit ? experimentOf(ctx.units, scenario) : undefined;
  if (!exp) return problems;
  const must = (label: string, text: string) => {
    const c = checkModelResponse(text, exp);
    if (!c.ok) problems.push(`${label}: ${c.problems.join(', ')}`);
  };
  if (kind === 'sft') must('response', (rec as SftRecord).response);
  else if (kind === 'pairs') {
    const p = rec as PairRecord;
    must('chosen', p.chosen);
    if (p.chosen === p.rejected) problems.push('rejected: chosen과 같습니다.');
    const detected = rejectedReasonDetected(p.rejectedReason, p.rejected, exp);
    if (detected === false) problems.push(`rejectedReason: rejected에서 "${p.rejectedReason}" 문제가 자동 검사에 걸리지 않습니다(라벨 확인).`);
  } else {
    const r = rec as RedteamRecord;
    if (r.reference !== undefined) {
      must('reference', r.reference);
      for (const phrase of r.mustNotContain) {
        if (r.reference.includes(phrase)) problems.push(`reference: mustNotContain 구절 "${phrase}"이(가) 들어 있습니다.`);
      }
    }
  }
  return problems;
}

// ---- 데이터셋 전체 검증 (사양 3.1) ----

export function validateDataset(ds: Dataset): string[] {
  const problems: string[] = [];
  const add = (where: string, msgs: string[]) => msgs.forEach((m) => problems.push(`${where}: ${m}`));
  const ctx = makeContext(ds);

  const seenScenario = new Set<string>();
  for (const s of ds.scenarios) {
    if (seenScenario.has(s.scenarioId)) add(s.scenarioId, ['scenarioId가 중복됩니다.']);
    seenScenario.add(s.scenarioId);
    if (!ds.units[s.unitId]) {
      add(s.scenarioId, [`unitId "${s.unitId}"가 없습니다.`]);
      continue;
    }
    const exp = experimentOf(ds.units, s);
    if (!exp) {
      add(s.scenarioId, [`experimentId "${s.state.experimentId}"가 없습니다.`]);
      continue;
    }
    try {
      const input = inputFor(ds, s, '');
      if (typeof input !== 'string' || input.length === 0) add(s.scenarioId, ['입력이 비어 있습니다.']);
      situationOf(s.state, exp);
    } catch (e) {
      add(s.scenarioId, [`buildTutorInput 실패: ${(e as Error).message}`]);
    }
  }

  const seenId = new Set<string>();
  const each = (kind: RecordKind, records: AnyRecord[]) => {
    for (const [i, rec] of records.entries()) {
      const where = `${kind}[${i}] ${(rec as { id?: string }).id ?? '(id 없음)'}`;
      const shape = validateRecordShape(kind, rec);
      if (shape.length > 0) {
        add(where, shape);
        continue;
      }
      const key = `${rec.unitId}/${rec.id}`;
      if (seenId.has(key)) add(where, ['id가 단원 안에서 중복됩니다.']);
      seenId.add(key);
      add(where, validateRecordContent(kind, rec, ctx));
    }
  };
  each('sft', ds.sft);
  each('pairs', ds.pairs);
  each('redteam', ds.redteam);
  return problems;
}

// ---- CSV ----

/** 따옴표 필드, 줄바꿈, BOM, CRLF를 다루는 작은 CSV 파서. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
export const toCsv = (rows: string[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export const CSV_HEADERS: Record<RecordKind, string[]> = {
  sft: ['시나리오 번호', '학생 말', '좋은 질문', '메모'],
  pairs: ['시나리오 번호', '학생 말', '좋은 질문', '나쁜 질문', '나쁜 이유', '메모'],
  redteam: ['시나리오 번호', '학생 말', '유형', '추가 금지 구절(; 구분)', '괜찮은 응답', '메모'],
};

export interface ImportError {
  /** 파일에서의 줄 번호(헤더가 1). */
  row: number;
  reason: string;
}

export interface ImportOptions {
  unitId: string;
  kind: RecordKind;
  author: string;
  /** 이미 있는 레코드(id 번호 이어 붙이기와 중복 검사에 쓴다). */
  existing: Dataset;
}

export interface ImportResult {
  records: AnyRecord[];
  errors: ImportError[];
}

/** 시나리오 번호는 전체 ID나 숫자(12 -> <unitId>-s012) 둘 다 받는다. */
export function resolveScenarioId(unitId: string, text: string): string {
  const t = text.trim();
  return /^\d+$/.test(t) ? `${unitId}-s${t.padStart(3, '0')}` : t;
}

export const recordId = (unitId: string, kind: RecordKind, n: number) => `${unitId}-${kind}-${String(n).padStart(4, '0')}`;

function nextNumber(existing: Dataset, unitId: string, kind: RecordKind): number {
  const list = existing[kind] as AnyRecord[];
  const re = new RegExp(`^${unitId}-${kind}-(\\d+)$`);
  let max = 0;
  for (const r of list) {
    const m = re.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** 교사 CSV를 레코드로 바꾼다. 검증에 실패한 행은 넣지 않고 errors에 모은다. */
export function importCsv(text: string, opts: ImportOptions): ImportResult {
  const rows = parseCsv(text);
  const errors: ImportError[] = [];
  const records: AnyRecord[] = [];
  const expected = CSV_HEADERS[opts.kind];
  const header = rows[0]?.map((c) => c.trim());
  if (!header || expected.some((h, i) => header[i] !== h)) {
    return { records, errors: [{ row: 1, reason: `헤더가 다릅니다. 필요한 열: ${expected.join(', ')}` }] };
  }
  const ctx = makeContext(opts.existing);
  let n = nextNumber(opts.existing, opts.unitId, opts.kind);
  for (const [i, cells] of rows.slice(1).entries()) {
    const row = i + 2;
    const c = (k: number) => (cells[k] ?? '').trim();
    const base = {
      id: recordId(opts.unitId, opts.kind, n),
      unitId: opts.unitId,
      scenarioId: resolveScenarioId(opts.unitId, c(0)),
      utterance: c(1),
      source: 'teacher' as const,
      reviewed: false,
      author: opts.author,
    };
    let rec: AnyRecord;
    const fail = (reason: string) => errors.push({ row, reason });
    if (opts.kind === 'sft') {
      rec = { ...base, response: c(2), ...(c(3) ? { notes: c(3) } : {}) };
    } else if (opts.kind === 'pairs') {
      const reason = rejectedReasonFromLabel(c(4));
      if (!reason) {
        fail(`나쁜 이유 "${c(4)}"을(를) 알 수 없습니다. 가능한 값: ${Object.values(REJECTED_REASON_LABEL).join(' / ')}`);
        continue;
      }
      rec = { ...base, chosen: c(2), rejected: c(3), rejectedReason: reason, ...(c(5) ? { notes: c(5) } : {}) };
    } else {
      const category = redteamCategoryFromLabel(c(2));
      if (!category) {
        fail(`유형 "${c(2)}"을(를) 알 수 없습니다. 가능한 값: ${Object.values(REDTEAM_CATEGORY_LABEL).join(' / ')}`);
        continue;
      }
      const must = c(3).split(';').map((x) => x.trim()).filter((x) => x.length > 0);
      rec = {
        ...base,
        category,
        mustNotContain: must,
        ...(c(4) ? { reference: c(4) } : {}),
        ...(c(5) ? { notes: c(5) } : {}),
      };
    }
    const problems = [...validateRecordShape(opts.kind, rec), ...(validateRecordShape(opts.kind, rec).length === 0 ? validateRecordContent(opts.kind, rec, ctx) : [])];
    if (problems.length > 0) {
      fail(problems.join(' / '));
      continue;
    }
    records.push(rec);
    n++;
  }
  return { records, errors };
}

/** 교사용 CSV 양식(헤더와 견본 한 줄). 시나리오 번호는 호출하는 쪽이 정한다. */
export function templateCsv(kind: RecordKind, sample: string[]): string {
  return '﻿' + toCsv([CSV_HEADERS[kind], sample]);
}

// ---- 내보내기 (사양 3.2) ----

export interface ExportOptions {
  includeExamples?: boolean;
  reviewedOnly?: boolean;
  /** manifest.json의 generatedAt. */
  now?: Date;
}

export interface ExportOutput {
  'sft.jsonl': string;
  'dpo.jsonl': string;
  'eval-redteam.jsonl': string;
  'manifest.json': string;
}

const jsonl = (items: unknown[]) => items.map((x) => JSON.stringify(x)).join('\n') + (items.length ? '\n' : '');

function count<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function buildExport(ds: Dataset, opts: ExportOptions = {}): ExportOutput {
  const scenarios = new Map(ds.scenarios.map((s) => [s.scenarioId, s]));
  const keep = (r: BaseRecord) => (opts.includeExamples || r.source !== 'example') && (!opts.reviewedOnly || r.reviewed);
  // 시나리오별 첫 질문 후보: 학생이 말하지 않은 SFT 견본 답(내보내는 레코드만)
  const openers = new Map<string, string[]>();
  for (const r of ds.sft.filter(keep)) if (!r.utterance.trim()) openers.set(r.scenarioId, [...(openers.get(r.scenarioId) ?? []), r.response]);
  const templates = new Map<string, string | undefined>();
  const templateOf = (s: Scenario) => {
    if (!templates.has(s.scenarioId)) templates.set(s.scenarioId, templateProbeFor(experimentOf(ds.units, s)!, s.state));
    return templates.get(s.scenarioId);
  };
  const sys = (s: Scenario, r: BaseRecord, target?: string) => [
    { role: 'system', content: TUTOR_SYSTEM },
    { role: 'user', content: inputFor(ds, s, r.utterance, previousTutorFor(r, target, openers, templateOf(s))) },
  ];
  const metaOf = (r: BaseRecord, s: Scenario) => ({
    id: r.id,
    unitId: r.unitId,
    situation: situationOf(s.state, experimentOf(ds.units, s)!),
    promptVersion: PROMPT_VERSION,
  });
  const scenarioOf = (r: BaseRecord) => {
    const s = scenarios.get(r.scenarioId);
    if (!s) throw new Error(`시나리오가 없습니다: ${r.scenarioId} (${r.id})`);
    return s;
  };

  const sftKept = ds.sft.filter(keep);
  const pairsKept = ds.pairs.filter(keep);
  const redteamKept = ds.redteam.filter(keep);

  const sft = sftKept.map((r) => {
    const s = scenarioOf(r);
    return { messages: [...sys(s, r, r.response), { role: 'assistant', content: r.response }], meta: metaOf(r, s) };
  });
  const dpo = pairsKept.map((r) => {
    const s = scenarioOf(r);
    return {
      prompt: sys(s, r, r.chosen),
      chosen: r.chosen,
      rejected: r.rejected,
      meta: { ...metaOf(r, s), rejectedReason: r.rejectedReason },
    };
  });
  const redteam = redteamKept.map((r) => {
    const s = scenarioOf(r);
    const exp = experimentOf(ds.units, s)!;
    const must = [...new Set([...exp.tutor.forbiddenAnswers, ...exp.limits, ...r.mustNotContain])];
    // limits: mustNotContain 가운데 제한 낱말(학년 밖 용어). 평가에서 이 낱말들은 앱의 출력 가드처럼 낱말 단위로 찾고, 나머지는 부분 일치로 찾는다.
    // forbiddenAnswers: 그 활동의 정답 구절. 평가에서 노출을 정답 누출 / 학년 밖 용어 / 학생 말 되풀이(레코드의 구절)로 나눠 센다.
    return { messages: sys(s, r, r.reference), mustNotContain: must, limits: exp.limits, forbiddenAnswers: exp.tutor.forbiddenAnswers, category: r.category, meta: metaOf(r, s) };
  });

  const all = [
    ...sft.map((x, i) => ({ ...x.meta, kind: 'sft', source: sftKept[i]!.source })),
    ...dpo.map((x, i) => ({ ...x.meta, kind: 'dpo', source: pairsKept[i]!.source })),
    ...redteam.map((x, i) => ({ ...x.meta, kind: 'redteam', source: redteamKept[i]!.source })),
  ];
  const manifest = {
    promptVersion: PROMPT_VERSION,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    options: { includeExamples: !!opts.includeExamples, reviewedOnly: !!opts.reviewedOnly },
    counts: { sft: sft.length, dpo: dpo.length, 'eval-redteam': redteam.length },
    byUnit: count(all, (x) => `${x.kind}/${x.unitId}`),
    bySituation: count(all, (x) => `${x.kind}/${x.situation}`),
    bySource: count(all, (x) => `${x.kind}/${x.source}`),
  };
  return {
    'sft.jsonl': jsonl(sft),
    'dpo.jsonl': jsonl(dpo),
    'eval-redteam.jsonl': jsonl(redteam),
    'manifest.json': JSON.stringify(manifest, null, 2) + '\n',
  };
}

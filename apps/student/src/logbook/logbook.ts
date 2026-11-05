/**
 * 탐구 기록장: 학생이 직접 켰을 때만, 이 기기의 localStorage에 최소한의 요약만 남긴다.
 *
 * - 꺼져 있으면 아무것도 쓰지 않는다(빈 키도 만들지 않는다).
 * - 남기는 것: 단원 id, 활동 종류, 날짜(일), 요약 숫자·key 목록, 진로 카드(학생이 쓴 글).
 * - 남기지 않는 것: 이름, 가명 ID, 교실 코드, 시행별 값, 튜터 대화, 심박 실측값.
 * - 서버·교실 연결·xAPI로는 내용을 보내지 않는다(이 파일은 네트워크 코드를 가져오지 않는다).
 * - 저장소 접근은 모두 try/catch. 저장소와 시계는 주입할 수 있다(테스트).
 */

export const LOGBOOK_KEY = 'sci-bridge.logbook.v1';
/** 저장 크기 상한(바이트). 넘치면 오래된 항목부터 버린다. */
export const MAX_BYTES = 200 * 1024;
export const UNAVAILABLE_TEXT = '이 기기에서는 기록장을 쓸 수 없어요';

export const MAX_MORE_CHARS = 200;
const MAX_JOB_TEXT_CHARS = 40;
const MAX_KEYS = 40;
const MAX_KEY_CHARS = 64;

export interface LogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface VariableSummary {
  /** 시행 수 */
  trials: number;
  /** 공정한 비교(한 가지만 바꾼 시행) 수 */
  fair: number;
  /** 공정한 비교로 확인한 변인 key 목록 */
  fairKeys: string[];
  /** 예측을 고르고 실행한 시행 수 */
  predicted: number;
  /** 그중 예측이 관찰과 맞은 횟수 */
  matched: number;
}
export interface ClassifySummary {
  completed: boolean;
}
export interface CardSortSummary {
  criteriaDone: number;
  finished: boolean;
}
export interface ObservationSummary {
  /** 기록한 과제 id */
  recorded: string[];
  /** 그중 기록이 모델과 맞은 과제 id */
  matched: string[];
}
export interface PortfolioSummary {
  /** 카드에서 고른 직업 key(직접 쓴 직업이면 null) */
  jobKey: string | null;
  /** 직접 쓴 직업 이름 */
  jobText: string;
  skills: string[];
  /** 더 알아보고 싶은 것 */
  more: string;
}

export type LogEntry =
  | { unitId: string; kind: 'variable'; day: string; summary: VariableSummary }
  | { unitId: string; kind: 'classify'; day: string; summary: ClassifySummary }
  | { unitId: string; kind: 'card-sort'; day: string; summary: CardSortSummary }
  | { unitId: string; kind: 'observation'; day: string; summary: ObservationSummary }
  | { unitId: string; kind: 'portfolio'; day: string; summary: PortfolioSummary };

export type LogKind = LogEntry['kind'];
interface SummaryMap {
  variable: VariableSummary;
  classify: ClassifySummary;
  'card-sort': CardSortSummary;
  observation: ObservationSummary;
  portfolio: PortfolioSummary;
}

interface Stored {
  v: 1;
  enabled: boolean;
  entries: LogEntry[];
}

export const PORTFOLIO_UNIT_ID = 'g6-career';

// ---- 순수 도우미 ----

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const keyList = (x: unknown): string[] =>
  Array.isArray(x)
    ? [...new Set(x.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= MAX_KEY_CHARS))].slice(0, MAX_KEYS)
    : [];

/** 로컬 날짜 YYYY-MM-DD. */
export function dayOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function cleanEntry(x: unknown): LogEntry | null {
  if (!isObj(x) || typeof x.unitId !== 'string' || typeof x.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.day)) return null;
  const s = isObj(x.summary) ? x.summary : {};
  const base = { unitId: x.unitId.slice(0, MAX_KEY_CHARS), day: x.day };
  switch (x.kind) {
    case 'variable':
      return { ...base, kind: 'variable', summary: { trials: count(s.trials), fair: count(s.fair), fairKeys: keyList(s.fairKeys), predicted: count(s.predicted), matched: count(s.matched) } };
    case 'classify':
      return { ...base, kind: 'classify', summary: { completed: s.completed === true } };
    case 'card-sort':
      return { ...base, kind: 'card-sort', summary: { criteriaDone: count(s.criteriaDone), finished: s.finished === true } };
    case 'observation':
      return { ...base, kind: 'observation', summary: { recorded: keyList(s.recorded), matched: keyList(s.matched) } };
    case 'portfolio':
      return {
        ...base,
        kind: 'portfolio',
        summary: {
          jobKey: typeof s.jobKey === 'string' ? s.jobKey.slice(0, MAX_KEY_CHARS) : null,
          jobText: typeof s.jobText === 'string' ? s.jobText.slice(0, MAX_JOB_TEXT_CHARS) : '',
          skills: keyList(s.skills),
          more: typeof s.more === 'string' ? s.more.slice(0, MAX_MORE_CHARS) : '',
        },
      };
    default:
      return null;
  }
}

function parseStored(raw: string): Stored | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || data.v !== 1 || !Array.isArray(data.entries)) return null;
  const entries = data.entries.map(cleanEntry).filter((e): e is LogEntry => e !== null);
  return { v: 1, enabled: data.enabled === true, entries };
}

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** 상한을 넘으면 오래된(앞쪽) 항목부터 버린다. 항목이 모두 없어져도 넘으면 null. */
export function fitToCap(state: Stored, maxBytes = MAX_BYTES): { json: string; entries: LogEntry[] } | null {
  let entries = [...state.entries];
  const json0 = JSON.stringify({ ...state, entries });
  if (byteLength(json0) <= maxBytes) return { json: json0, entries };
  // 항목마다 길이를 한 번만 재서 앞쪽(오래된 것)부터 덜어 낸다.
  let size = byteLength(json0);
  let drop = 0;
  while (size > maxBytes && drop < entries.length) {
    size -= byteLength(JSON.stringify(entries[drop])) + 1; // 항목 + 쉼표
    drop += 1;
  }
  entries = entries.slice(drop);
  for (;;) {
    const json = JSON.stringify({ ...state, entries });
    if (byteLength(json) <= maxBytes) return { json, entries };
    if (entries.length === 0) return null;
    entries.shift();
  }
}

/** 기본 저장소: window.localStorage. 접근 자체가 막혀 있으면 null. */
export function browserStorage(): LogStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ---- 기록장 ----

export interface LogbookOptions {
  /** 저장소(또는 저장소를 돌려주는 함수). 없거나 null이면 쓸 수 없는 기기로 본다. */
  storage?: LogStorage | null | (() => LogStorage | null);
  /** 날짜를 정하는 시계. */
  now?: () => Date;
}

export function createLogbook(opts: LogbookOptions = {}) {
  const getStorage = (): LogStorage | null => {
    try {
      const s = opts.storage === undefined ? browserStorage : opts.storage;
      return typeof s === 'function' ? s() : s;
    } catch {
      return null;
    }
  };
  const now = opts.now ?? (() => new Date());

  let version = 0;
  /** 마지막 읽기가 막혔는가 / 마지막 쓰기가 막혔는가. */
  let broken = false;
  let writeFailed = false;
  const listeners = new Set<() => void>();
  const bump = () => {
    version += 1;
    listeners.forEach((l) => l());
  };

  /** 저장된 상태. 키가 없거나(꺼짐) 읽을 수 없으면 null. */
  const load = (): Stored | null => {
    const st = getStorage();
    if (!st) {
      broken = true;
      return null;
    }
    try {
      const raw = st.getItem(LOGBOOK_KEY);
      broken = false;
      return raw === null ? null : parseStored(raw);
    } catch {
      broken = true;
      return null;
    }
  };

  const save = (state: Stored): boolean => {
    const st = getStorage();
    if (!st) {
      broken = true;
      return false;
    }
    const fit = fitToCap(state);
    if (!fit) return false;
    try {
      st.setItem(LOGBOOK_KEY, fit.json);
      writeFailed = false;
      bump();
      return true;
    } catch {
      writeFailed = true;
      return false;
    }
  };

  /** 켜져 있을 때만 상태를 돌려준다. 꺼져 있으면 아무것도 쓰지 않으려고 null. */
  const active = (): Stored | null => {
    const s = load();
    return s && s.enabled ? s : null;
  };

  /** 같은 단원·종류·날짜 항목을 갱신(없으면 만든다). 갱신한 항목은 맨 뒤(가장 최근)로 옮긴다. */
  function upsert<K extends LogKind>(
    unitId: string,
    kind: K,
    update: (prev: SummaryMap[K] | undefined) => SummaryMap[K],
  ): boolean {
    const s = active();
    if (!s) return false;
    const day = dayOf(now());
    const same = (e: LogEntry) => e.unitId === unitId && e.kind === kind && e.day === day;
    const prev = s.entries.find(same)?.summary as SummaryMap[K] | undefined;
    const entry = { unitId, kind, day, summary: update(prev) } as LogEntry;
    const cleaned = cleanEntry(entry);
    if (!cleaned) return false;
    return save({ ...s, entries: [...s.entries.filter((e) => !same(e)), cleaned] });
  }

  /** 모두 지우기: 키를 삭제한다(기록장도 꺼진다). */
  function clearAll(): boolean {
    const st = getStorage();
    if (!st) {
      broken = true;
      return false;
    }
    try {
      st.removeItem(LOGBOOK_KEY);
      broken = false;
      bump();
      return true;
    } catch {
      broken = true;
      return false;
    }
  }

  /** 켜져 있을 때만 기록을 돌려준다(꺼져 있으면 빈 배열). 오래된 것부터. */
  function entries(): LogEntry[] {
    return active()?.entries ?? [];
  }

  return {
    /** 이 기기에서 기록장을 쓸 수 있는가(마지막 저장소 접근이 성공했는가). */
    usable(): boolean {
      load();
      return !broken && !writeFailed;
    },
    isEnabled(): boolean {
      return active() !== null;
    },
    /** 켜져 있지 않아도 이전 기록이 저장돼 있는가(끄기만 하고 지우지 않은 경우). */
    hasStoredData(): boolean {
      return load() !== null;
    },
    /** 켠다. 이전에 끄기만 했다면 그 기록이 다시 보인다. 쓰지 못하면 false. */
    enable(): boolean {
      const prev = load();
      if (broken) return false;
      return save({ v: 1, enabled: true, entries: prev?.entries ?? [] });
    },
    /** 끈다. clear면 기록과 키를 모두 지우고, 아니면 기록은 두고 기록만 멈춘다. */
    disable(clear: boolean): boolean {
      if (clear) return clearAll();
      const prev = load();
      if (!prev) return !broken;
      return save({ ...prev, enabled: false });
    },
    clearAll,
    entries,

    noteVariableTrial(unitId: string, t: { iv?: string | null; fair: boolean; predictionMatched?: boolean }): boolean {
      return upsert(unitId, 'variable', (p) => {
        const keys = p?.fairKeys ?? [];
        return {
          trials: (p?.trials ?? 0) + 1,
          fair: (p?.fair ?? 0) + (t.fair ? 1 : 0),
          fairKeys: t.fair && t.iv && !keys.includes(t.iv) ? [...keys, t.iv] : keys,
          predicted: (p?.predicted ?? 0) + (t.predictionMatched === undefined ? 0 : 1),
          matched: (p?.matched ?? 0) + (t.predictionMatched === true ? 1 : 0),
        };
      });
    },
    noteClassifyComplete(unitId: string): boolean {
      return upsert(unitId, 'classify', () => ({ completed: true }));
    },
    noteCardSort(unitId: string, criteriaDone: number, finished: boolean): boolean {
      return upsert(unitId, 'card-sort', (p) => ({
        criteriaDone: Math.max(p?.criteriaDone ?? 0, count(criteriaDone)),
        finished: (p?.finished ?? false) || finished,
      }));
    },
    noteObservation(unitId: string, taskId: string, matched: boolean): boolean {
      return upsert(unitId, 'observation', (p) => {
        const recorded = p?.recorded ?? [];
        const ok = p?.matched ?? [];
        return {
          recorded: recorded.includes(taskId) ? recorded : [...recorded, taskId],
          matched: matched && !ok.includes(taskId) ? [...ok, taskId] : ok,
        };
      });
    },

    /** 진로 탐색 카드를 저장한다(가장 최근 카드 하나만 둔다). 꺼져 있으면 쓰지 않고 false. */
    savePortfolio(card: PortfolioSummary): boolean {
      const s = active();
      if (!s) return false;
      const entry = cleanEntry({ unitId: PORTFOLIO_UNIT_ID, kind: 'portfolio', day: dayOf(now()), summary: card });
      if (!entry) return false;
      return save({ ...s, entries: [...s.entries.filter((e) => e.kind !== 'portfolio'), entry] });
    },
    portfolioCard(): PortfolioSummary | null {
      const e = entries().find((x) => x.kind === 'portfolio');
      return e && e.kind === 'portfolio' ? e.summary : null;
    },

    /** useSyncExternalStore용. */
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    getVersion: () => version,
  };
}

export type Logbook = ReturnType<typeof createLogbook>;

export const HOME_PAGE = 'https://sci-bridge.local';

export const EXT_BASE = 'https://sci-bridge.local/xapi/ext/';

/** xAPI result.extensions 키는 IRI여야 한다. */
export const ext = (name: string): string => EXT_BASE + name;

export function toExtensions(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [ext(k), v]));
}

const RESULT_KEYS = ['score', 'success', 'completion', 'response', 'duration', 'extensions'];
const IRI = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

function validateResult(result: Record<string, unknown>): void {
  for (const k of Object.keys(result)) {
    if (!RESULT_KEYS.includes(k)) throw new TypeError(`xAPI result에 허용되지 않는 키: ${k}`);
  }
  if (result.response !== undefined && typeof result.response !== 'string') {
    throw new TypeError('xAPI result.response는 문자열이어야 합니다.');
  }
  const extensions = result.extensions;
  if (extensions !== undefined) {
    if (typeof extensions !== 'object' || extensions === null || Array.isArray(extensions)) {
      throw new TypeError('xAPI result.extensions는 객체여야 합니다.');
    }
    for (const k of Object.keys(extensions)) {
      if (!IRI.test(k)) throw new TypeError(`xAPI extensions 키는 IRI여야 합니다: ${k}`);
    }
  }
}

export interface Statement {
  id: string;
  actor: { objectType: 'Agent'; account: { homePage: string; name: string } };
  verb: { id: string; display: Record<string, string> };
  object: { objectType: 'Activity'; id: string };
  result?: Record<string, unknown>;
  timestamp: string;
}

export interface StatementInput {
  /** 가명 ID */
  actorId: string;
  verb: string;
  objectId: string;
  result?: Record<string, unknown>;
  id?: string;
  timestamp?: string;
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

/** xAPI 1.0.3 형태의 문장을 만든다. */
export function buildStatement(input: StatementInput): Statement {
  const stmt: Statement = {
    id: input.id ?? uuid(),
    actor: { objectType: 'Agent', account: { homePage: HOME_PAGE, name: input.actorId } },
    verb: { id: `${HOME_PAGE}/verbs/${input.verb}`, display: { 'en-US': input.verb } },
    object: { objectType: 'Activity', id: input.objectId },
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
  if (input.result) validateResult(input.result);
  if (input.result) stmt.result = input.result;
  return stmt;
}

/** 메모리 큐. 오프라인 큐의 최소판. */
export class MemoryRecorder {
  private queue: Statement[] = [];

  record(stmt: Statement) {
    this.queue.push(stmt);
  }

  get pending(): readonly Statement[] {
    return this.queue;
  }

  /** 쌓인 문장을 모두 꺼내 돌려주고 큐를 비운다. */
  flush(): Statement[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}

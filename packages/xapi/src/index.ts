export const HOME_PAGE = 'https://sci-bridge.local';

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

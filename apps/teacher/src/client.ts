import { parseServerMessage, type ErrorCode, type SafetyType, type Snapshot } from '@sci/classroom';

export type ConnState = 'connecting' | 'open' | 'closed';

export interface TeacherState {
  conn: ConnState;
  snapshot: Snapshot | null;
  /** 수업을 새로 만들었을 때 받은 코드와 토큰(주소 해시에 넣는다). */
  created: { code: string; token: string } | null;
  /** 수업을 볼 수 없는 오류(없는 수업, 잘못된 토큰 등). */
  error: ErrorCode | null;
}

const EMPTY: TeacherState = { conn: 'connecting', snapshot: null, created: null, error: null };

/** 교사 화면의 서버 연결. 끊기면 자동으로 다시 이어서 watch한다. */
export class TeacherClient {
  private state: TeacherState = EMPTY;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private creds: { code: string; token: string } | null;
  private wantCreate = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly url: string,
    creds: { code: string; token: string } | null,
  ) {
    this.creds = creds;
    this.connect();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;

  private set(patch: Partial<TeacherState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private connect() {
    if (this.disposed) return;
    this.set({ conn: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.set({ conn: 'closed' });
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.set({ conn: 'open' });
      if (this.creds) this.send({ t: 'watch', ...this.creds });
      else if (this.wantCreate) this.send({ t: 'create' });
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const m = parseServerMessage(ev.data);
      if (!m) return;
      if (m.t === 'created') {
        this.wantCreate = false;
        this.creds = { code: m.code, token: m.token };
        this.set({ created: { code: m.code, token: m.token } });
      } else if (m.t === 'snapshot') {
        this.set({ snapshot: m });
      } else if (m.t === 'error') {
        if (m.code === 'no_class' || m.code === 'bad_token' || m.code === 'bad_message') {
          this.creds = null;
          this.set({ error: m.code, snapshot: null });
        } else {
          this.wantCreate = false;
          this.set({ error: m.code });
        }
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.disposed) return;
      this.set({ conn: 'closed' });
      this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose가 이어서 불린다 */
    };
  }

  private scheduleRetry() {
    if (this.disposed || this.timer) return;
    const wait = Math.min(10_000, 500 * 2 ** this.retry++);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, wait);
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  create() {
    this.wantCreate = true;
    this.set({ error: null });
    this.send({ t: 'create' });
  }
  pause(on: boolean) {
    this.send({ t: 'pause', on });
  }
  ack(group: number, type: SafetyType) {
    this.send({ t: 'ack', group, type });
  }
  end() {
    this.send({ t: 'end' });
    this.leave();
  }
  /** 이 수업 보기를 그만둔다(처음 화면으로). */
  leave() {
    this.creds = null;
    this.wantCreate = false;
    this.set({ snapshot: null, created: null, error: null });
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}

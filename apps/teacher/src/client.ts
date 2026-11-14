import { parseServerMessage, type ErrorCode, type SafetyType, type Snapshot, type TutorEdits, type TutorModelRef } from '@sci/classroom';

export type ConnState = 'connecting' | 'open' | 'closed';

export interface TeacherState {
  conn: ConnState;
  snapshot: Snapshot | null;
  /** 수업을 새로 만들었을 때 받은 코드와 토큰(주소 해시에 넣는다). */
  created: { code: string; token: string } | null;
  /** 수업을 볼 수 없는 오류(없는 수업, 잘못된 토큰 등). */
  error: ErrorCode | null;
  /** 수업 만들기를 보냈고 아직 답이 없다(버튼을 잠그는 데 쓴다). */
  creating: boolean;
}

/** 튜터 질문 덧씌우기를 서버에 보내기 전에 묶는 시간(ms). */
export const TUTOR_SEND_DEBOUNCE_MS = 500;

const EMPTY: TeacherState = { conn: 'connecting', snapshot: null, created: null, error: null, creating: false };

/** 교사 화면의 서버 연결. 끊기면 자동으로 다시 이어서 watch한다. */
export class TeacherClient {
  private state: TeacherState = EMPTY;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private creds: { code: string; token: string } | null;
  private wantCreate = false;
  private secret: string | undefined;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** 교사가 저장한 튜터 질문 덧씌우기(setTutorEdits로 받은 마지막 것). 한 번도 받지 않았으면 null. */
  private tutor: TutorEdits | null = null;
  /** 교사 PC에 있는 튜터 모델(setTutorModel로 받은 마지막 것). 없다는 뜻은 null, 한 번도 받지 않았으면 undefined(보내지 않는다). */
  private tutorModel: TutorModelRef | null | undefined = undefined;
  /** 이번 연결에서 수업(created/snapshot)에 들어와 서버가 tutor를 받을 수 있는가. */
  private tutorReady = false;
  private tutorTimer: ReturnType<typeof setTimeout> | null = null;

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
      this.tutorReady = false;
      this.set({ conn: 'open' });
      if (this.creds) this.send({ t: 'watch', ...this.creds });
      else if (this.wantCreate) this.send(this.createMsg());
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const m = parseServerMessage(ev.data);
      if (!m) return;
      if (m.t === 'created') {
        this.wantCreate = false;
        this.creds = { code: m.code, token: m.token };
        this.set({ created: { code: m.code, token: m.token }, creating: false });
        this.tutorIn();
      } else if (m.t === 'snapshot') {
        this.set({ snapshot: m });
        this.tutorIn();
      } else if (m.t === 'error') {
        if (m.code === 'bad_message' && (this.state.created || this.state.snapshot)) {
          // 이미 수업을 보고 있는 중에 온 bad_message(중복 create 등)는 치명적이지 않다.
          return;
        }
        if (m.code === 'no_class' || m.code === 'bad_token' || m.code === 'bad_message') {
          this.creds = null;
          this.set({ error: m.code, snapshot: null, creating: false });
        } else {
          this.wantCreate = false;
          this.set({ error: m.code, creating: false });
        }
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.tutorReady = false;
      }
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

  private createMsg() {
    return { t: 'create', ...(this.secret ? { secret: this.secret } : {}) };
  }

  /** 수업 만들기. 이미 보낸 요청의 답을 기다리는 중이면 다시 보내지 않는다. secret은 서버에 CREATE_SECRET이 있을 때 쓴다. */
  create(secret?: string) {
    if (this.state.creating) return;
    this.wantCreate = true;
    this.secret = secret?.slice(0, 64) || undefined;
    this.set({ error: null, creating: true });
    this.send(this.createMsg());
  }
  /**
   * 저장된 튜터 질문 덧씌우기를 알려 둔다. 수업에 들어가 있으면(500 ms 묶어서) 서버에 보내고,
   * 수업을 만들거나 다시 연결(watch)될 때도 이 값을 보낸다. 서버는 학생 기기에 전달한다.
   */
  setTutorEdits(edits: TutorEdits) {
    this.tutor = edits;
    if (!this.tutorReady) return;
    if (this.tutorTimer) clearTimeout(this.tutorTimer);
    this.tutorTimer = setTimeout(() => {
      this.tutorTimer = null;
      this.sendTutor();
    }, TUTOR_SEND_DEBOUNCE_MS);
  }
  /** 수업에 들어갔다(created, 또는 watch 뒤 첫 snapshot). 이때 서버에 현재 덧씌우기를 보낸다. */
  private tutorIn() {
    if (this.tutorReady) return;
    this.tutorReady = true;
    this.sendTutor();
  }
  private sendTutor() {
    if (this.tutor) this.send({ t: 'tutor', edits: this.tutor });
    if (this.tutorModel !== undefined) this.send({ t: 'tutorModel', model: this.tutorModel });
  }
  /**
   * 이 PC에 있는 튜터 모델을 알려 둔다(없으면 null). 수업에 들어가 있으면 바뀔 때 바로 서버에 보내고,
   * 수업을 만들거나 다시 연결(watch)될 때도 보낸다. 서버는 학생 기기에 전달한다. 같은 값을 다시 주면 보내지 않는다.
   */
  setTutorModel(model: TutorModelRef | null) {
    const prev = this.tutorModel;
    const same = prev !== undefined && (prev === null || model === null ? prev === model : prev.id === model.id && prev.sha256 === model.sha256 && prev.size === model.size);
    this.tutorModel = model;
    if (!same && this.tutorReady) this.send({ t: 'tutorModel', model });
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
    this.tutorReady = false;
    if (this.tutorTimer) clearTimeout(this.tutorTimer);
    this.tutorTimer = null;
    this.wantCreate = false;
    this.set({ snapshot: null, created: null, error: null, creating: false });
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.tutorTimer) clearTimeout(this.tutorTimer);
    this.ws?.close();
  }
}

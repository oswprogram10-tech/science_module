import { bus, type BusEvent } from './bus';
import { FLUSH_GAP_MS, LIMITS, MAX_QUEUE, clampText, compactQueue } from './queue';
import { APP_VERSION } from './config';
import { normalizeCode, parseServerMessage, type DeviceTier } from '@sci/classroom';

export interface Session {
  code: string;
  group: number;
}

export type Link = 'off' | 'connecting' | 'online' | 'retrying';

export interface ClassroomState {
  session: Session | null;
  link: Link;
  /** 참여 대화상자에 보여 줄 오류 문장. */
  error: string | null;
  /** 선생님이 수업을 끝냈거나 수업이 사라졌을 때 알릴 문장. */
  notice: string | null;
}

const STORAGE_KEY = 'sci.classroom.session';
const STATUS_INTERVAL_MS = 1000;

const ERROR_TEXT: Record<string, string> = {
  no_class: '수업을 찾을 수 없어요. 코드를 다시 확인해 주세요.',
  group_taken: '이 모둠 번호는 이미 쓰고 있어요. 다른 번호를 골라 주세요.',
  class_full: '이 수업은 더 참여할 수 없어요. 선생님께 알려 주세요.',
  bad_message: '수업에 참여하지 못했어요. 선생님께 알려 주세요.',
};

const readStored = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Session>;
    const code = typeof v.code === 'string' ? normalizeCode(v.code) : null;
    return code && Number.isInteger(v.group) && v.group! >= 1 && v.group! <= 12 ? { code, group: v.group! } : null;
  } catch {
    return null;
  }
};
const writeStored = (s: Session | null) => {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장하지 못해도 수업은 계속된다 */
  }
};

/** 학생 기기의 수업 연결. 끊기면 자동으로 다시 이어서 참여하고, 재연결되면 최신 상태를 다시 보낸다. */
export class StudentClassroom {
  private state: ClassroomState = { session: null, link: 'off', error: null, notice: null };
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private url = '';
  private tier: DeviceTier | undefined;
  /** 참여 대화상자에서 막 누른 참여인가(오류를 대화상자에 보여 주고 다시 시도하지 않는다). */
  private fresh = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStatusAt = 0;
  private lastStatusJson = '';
  private queue: BusEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    bus.onEvent((e) => this.onBus(e));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getState = () => this.state;

  private set(patch: Partial<ClassroomState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** 새로고침 뒤 sessionStorage의 참여 정보로 다시 참여한다. */
  restore(url: string, tier: DeviceTier | undefined) {
    // 등급은 항상 갱신해 둔다(이미 참여 중이어도 다음 재연결 join에 실린다).
    this.url = url;
    this.tier = tier;
    if (this.state.session) return;
    const s = readStored();
    if (s) {
      this.fresh = false;
      this.set({ session: s, link: 'connecting', error: null });
      this.connect();
    }
  }

  join(url: string, tier: DeviceTier | undefined, session: Session) {
    this.url = url;
    this.tier = tier;
    this.stop();
    this.fresh = true;
    this.set({ session, link: 'connecting', error: null, notice: null });
    this.connect();
  }

  leave() {
    this.stop();
    writeStored(null);
    this.set({ session: null, link: 'off', error: null });
  }

  clearNotice() {
    this.set({ notice: null });
  }
  clearError() {
    if (this.state.error) this.set({ error: null });
  }

  /** 연결과 타이머를 모두 멈춘다. 멈춤 화면도 걷는다. */
  private stop() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.retryTimer = this.statusTimer = this.flushTimer = null;
    this.retry = 0;
    this.queue = [];
    this.lastStatusJson = '';
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* 이미 닫힘 */
      }
    }
    bus.setPaused(false);
  }

  private connect() {
    const session = this.state.session;
    if (!session) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.onDown();
      return;
    }
    this.ws = ws;
    ws.onopen = () =>
      ws.send(JSON.stringify({ t: 'join', code: session.code, group: session.group, ...(this.tier ? { deviceTier: this.tier } : {}), appVersion: clampText(APP_VERSION, LIMITS.appVersion) }));
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const m = parseServerMessage(ev.data);
      if (!m) return;
      if (m.t === 'joined') {
        this.retry = 0;
        this.fresh = false;
        writeStored(session);
        this.set({ link: 'online', error: null });
        // 재연결되면 최신 상태를 한 번 다시 보내고, 끊긴 동안 쌓인 안전 알림도 보낸다.
        this.lastStatusJson = '';
        this.sendStatus(true);
        // 쌓인 안전 알림은 줄여서(compactQueue) 간격을 두고 보낸다. 한꺼번에 보내면 서버 속도 제한에 걸린다.
        this.queue = compactQueue(this.queue, MAX_QUEUE);
        this.scheduleFlush();
      } else if (m.t === 'pause') {
        if (this.state.link === 'online') bus.setPaused(m.on);
      } else if (m.t === 'ended') {
        this.stop();
        writeStored(null);
        this.set({ session: null, link: 'off', notice: '선생님이 수업을 끝냈어요.' });
      } else if (m.t === 'error') {
        this.onError(m.code);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onDown();
    };
    ws.onerror = () => {
      /* onclose가 이어서 불린다 */
    };
  }

  private onError(code: string) {
    if (code === 'rate_limited') return;
    if (code === 'bad_message' && this.state.link === 'online') {
      // 참여한 뒤의 bad_message는 우리가 보낸 메시지 하나가 거절된 것이다. 수업에서 내보내지 않는다.
      console.warn('수업 서버가 메시지 하나를 받아들이지 않았어요(bad_message).');
      return;
    }
    const text = ERROR_TEXT[code] ?? ERROR_TEXT.bad_message!;
    if (code === 'group_taken' && !this.fresh) {
      // 내 기기가 끊긴 걸 서버가 아직 모를 수 있다. 조금 뒤에 다시 시도한다.
      this.ws?.close();
      return;
    }
    const wasFresh = this.fresh;
    this.stop();
    writeStored(null);
    this.set(
      wasFresh
        ? { session: null, link: 'off', error: text }
        : { session: null, link: 'off', notice: code === 'no_class' ? '수업이 끝났거나 찾을 수 없어요.' : text },
    );
  }

  /** 연결이 끊겼거나 서버에 닿지 못했다. */
  private onDown() {
    if (!this.state.session) return;
    // 끊긴 상태에서는 멈춤을 걸지 않는다(선생님이 확인할 수 없으므로).
    bus.setPaused(false);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.fresh) {
      this.stop();
      this.set({ session: null, link: 'off', error: '서버에 연결하지 못했어요. 선생님께 알려 주세요.' });
      return;
    }
    this.set({ link: 'retrying' });
    if (this.retryTimer) return;
    const wait = Math.min(10_000, 1000 * 2 ** this.retry++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, wait);
  }

  // ---- 보내기 ----

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN && this.state.link === 'online') this.ws.send(JSON.stringify(msg));
  }

  private onBus(e: BusEvent) {
    if (!this.state.session) return;
    if (e.k === 'status') {
      this.scheduleStatus();
    } else if (this.state.link === 'online' && this.queue.length === 0 && !this.flushTimer) {
      this.sendEvent(e);
    } else {
      // 끊긴 동안, 또는 아직 비우는 중이면 순서를 지키기 위해 뒤에 쌓는다.
      this.queue = compactQueue([...this.queue, e], MAX_QUEUE);
      if (this.state.link === 'online') this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer || this.queue.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.state.link !== 'online') return;
      const e = this.queue.shift();
      if (e) this.sendEvent(e);
      this.scheduleFlush();
    }, FLUSH_GAP_MS);
  }

  private sendEvent(e: BusEvent) {
    if (e.k === 'safety') this.send({ t: 'safety', type: e.type, at: Math.max(0, Math.trunc(e.at)) });
    else if (e.k === 'clear') this.send({ t: 'safetyClear', type: e.type });
  }

  /** status는 묶어서 초당 1회 이하로 보낸다. */
  private scheduleStatus() {
    if (this.state.link !== 'online' || this.statusTimer) return;
    const wait = Math.max(0, this.lastStatusAt + STATUS_INTERVAL_MS - Date.now());
    if (wait === 0) this.sendStatus(false);
    else this.statusTimer = setTimeout(() => ((this.statusTimer = null), this.sendStatus(false)), wait);
  }

  private sendStatus(force: boolean) {
    if (this.state.link !== 'online') return;
    const { unitId, activity, phase, trials, lastKind, mismatch, safetyLocked } = bus.getStatus();
    const msg = {
      t: 'status',
      ...(unitId ? { unitId: clampText(unitId, LIMITS.shortText) } : {}),
      ...(activity ? { activity } : {}),
      phase,
      trials: Math.min(9999, Math.max(0, Math.trunc(trials))),
      ...(lastKind ? { lastKind: clampText(lastKind, LIMITS.shortText) } : {}),
      ...(mismatch !== undefined ? { mismatch } : {}),
      safetyLocked,
    };
    const json = JSON.stringify(msg);
    if (!force && json === this.lastStatusJson) return;
    this.lastStatusJson = json;
    this.lastStatusAt = Date.now();
    this.send(msg);
  }
}

export const classroom = new StudentClassroom();

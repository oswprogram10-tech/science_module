import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_MESSAGE_BYTES,
  checkJoin,
  createClass,
  isExpired,
  parseClientMessage,
  reduce,
  toSnapshot,
  type ClassEvent,
  type ClassState,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from '@sci/classroom';

export const MAX_CLASSES = 50;
export const MSGS_PER_SECOND = 10;
export const MAX_BAD_MESSAGES = 3;
/** 교사에게 보내는 snapshot 간격의 최소값(ms): 초당 최대 4회. */
export const SNAPSHOT_INTERVAL_MS = 250;

/** ws 소켓 중 허브가 쓰는 부분. 테스트에서 가짜로 바꿀 수 있다. */
export interface Conn {
  send(data: string): void;
  close(code?: number): void;
}

/** 로그에는 수업 코드와 모둠 번호, 이벤트 종류만 남긴다. 메시지 본문은 넘기지 않는다. */
export type LogFn = (event: string, code?: string, group?: number) => void;

interface ClassRec {
  state: ClassState;
  token: Buffer;
  teachers: Set<Conn>;
  students: Map<number, Conn>;
  lastSnapshotAt: number;
  snapshotTimer: ReturnType<typeof setTimeout> | null;
}

interface ConnMeta {
  role: 'none' | 'teacher' | 'student';
  code?: string;
  group?: number;
  windowStart: number;
  windowCount: number;
  bad: number;
}

export interface HubOptions {
  now?: () => number;
  log?: LogFn;
  maxClasses?: number;
}

export function makeCode(): string {
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const b of randomBytes(16)) {
      // 31자 알파벳에서 치우침이 없도록 248(=31*8) 미만의 값만 쓴다.
      if (b < 248 && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

export class Hub {
  readonly classes = new Map<string, ClassRec>();
  private readonly meta = new WeakMap<Conn, ConnMeta>();
  private readonly now: () => number;
  private readonly log: LogFn;
  private readonly maxClasses: number;

  constructor(opts: HubOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
    this.maxClasses = opts.maxClasses ?? MAX_CLASSES;
  }

  /** 새 연결을 등록한다. */
  open(conn: Conn): void {
    this.meta.set(conn, { role: 'none', windowStart: this.now(), windowCount: 0, bad: 0 });
  }

  /** 원문 메시지 하나를 처리한다. */
  message(conn: Conn, raw: string): void {
    const m = this.meta.get(conn);
    if (!m) return;
    const t = this.now();
    if (t - m.windowStart >= 1000) {
      m.windowStart = t;
      m.windowCount = 0;
    }
    if (++m.windowCount > MSGS_PER_SECOND) {
      this.send(conn, { t: 'error', code: 'rate_limited' });
      return;
    }
    // 글자 수가 8 KB의 절반도 안 되면 바이트 수를 따로 세지 않아도 된다(parseClientMessage가 다시 확인한다).
    const msg = raw.length > MAX_MESSAGE_BYTES * 2 ? null : parseClientMessage(raw);
    if (!msg) {
      this.send(conn, { t: 'error', code: 'bad_message' });
      if (++m.bad >= MAX_BAD_MESSAGES) {
        this.log('too_many_bad_messages', m.code, m.group);
        conn.close(1008);
      }
      return;
    }
    this.handle(conn, m, msg);
  }

  /** 연결이 닫혔다. */
  close(conn: Conn): void {
    const m = this.meta.get(conn);
    if (!m) return;
    this.meta.delete(conn);
    const rec = m.code ? this.classes.get(m.code) : undefined;
    if (!rec) return;
    if (m.role === 'teacher') {
      rec.teachers.delete(conn);
      this.log('teacher_left', rec.state.code);
    } else if (m.role === 'student' && m.group !== undefined && rec.students.get(m.group) === conn) {
      rec.students.delete(m.group);
      this.apply(rec, { type: 'leave', group: m.group, now: this.now() });
      this.log('group_left', rec.state.code, m.group);
    }
  }

  /** pong 등으로 연결이 살아 있음을 알린다. */
  alive(conn: Conn): void {
    const m = this.meta.get(conn);
    if (m?.role === 'student' && m.code && m.group !== undefined) {
      const rec = this.classes.get(m.code);
      if (rec?.students.get(m.group) === conn) rec.state = reduce(rec.state, { type: 'seen', group: m.group, now: this.now() });
    }
  }

  /** 만료된 수업을 지운다. 지운 개수를 돌려준다. */
  sweep(): number {
    const t = this.now();
    let n = 0;
    for (const [code, rec] of this.classes) {
      if (isExpired(rec.state, t, rec.teachers.size + rec.students.size > 0)) {
        this.dropClass(code, false);
        this.log('class_expired', code);
        n++;
      }
    }
    return n;
  }

  /** 모든 타이머를 멈춘다(서버 종료용). */
  shutdown(): void {
    for (const rec of this.classes.values()) if (rec.snapshotTimer) clearTimeout(rec.snapshotTimer);
  }

  // ---- 내부 ----

  private send(conn: Conn, msg: ServerMessage): void {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      /* 이미 닫힌 연결 */
    }
  }

  private error(conn: Conn, code: ErrorCode): void {
    this.send(conn, { t: 'error', code });
  }

  private handle(conn: Conn, m: ConnMeta, msg: ClientMessage): void {
    switch (msg.t) {
      case 'create': {
        if (m.role !== 'none') return this.error(conn, 'bad_message');
        if (this.classes.size >= this.maxClasses) return this.error(conn, 'class_full');
        let code = makeCode();
        while (this.classes.has(code)) code = makeCode();
        const tokenBytes = randomBytes(16);
        const rec: ClassRec = {
          state: createClass(code, this.now()),
          token: tokenBytes,
          teachers: new Set([conn]),
          students: new Map(),
          lastSnapshotAt: 0,
          snapshotTimer: null,
        };
        this.classes.set(code, rec);
        m.role = 'teacher';
        m.code = code;
        this.log('class_created', code);
        this.send(conn, { t: 'created', code, token: tokenBytes.toString('hex') });
        this.send(conn, toSnapshot(rec.state));
        return;
      }
      case 'watch': {
        if (m.role !== 'none') return this.error(conn, 'bad_message');
        const rec = this.classes.get(msg.code);
        if (!rec) return this.error(conn, 'no_class');
        const given = Buffer.from(msg.token, 'hex');
        if (given.length !== rec.token.length || !timingSafeEqual(given, rec.token)) return this.error(conn, 'bad_token');
        rec.teachers.add(conn);
        m.role = 'teacher';
        m.code = msg.code;
        rec.state = reduce(rec.state, { type: 'touch', now: this.now() });
        this.log('teacher_watch', msg.code);
        this.send(conn, toSnapshot(rec.state));
        return;
      }
      case 'join': {
        if (m.role !== 'none') return this.error(conn, 'bad_message');
        const rec = this.classes.get(msg.code);
        if (!rec) return this.error(conn, 'no_class');
        const t = this.now();
        const refusal = checkJoin(rec.state, msg.group, t);
        if (refusal) {
          this.log(`join_${refusal}`, msg.code, msg.group);
          return this.error(conn, refusal);
        }
        // 오래 조용했던 이전 연결은 새 연결로 바꾼다.
        const old = rec.students.get(msg.group);
        if (old) {
          this.meta.delete(old);
          rec.students.delete(msg.group);
          try {
            old.close(4001);
          } catch {
            /* 이미 끊김 */
          }
          this.log('group_replaced', msg.code, msg.group);
        }
        m.role = 'student';
        m.code = msg.code;
        m.group = msg.group;
        rec.students.set(msg.group, conn);
        this.apply(rec, { type: 'join', group: msg.group, ...(msg.deviceTier ? { deviceTier: msg.deviceTier } : {}), now: t });
        this.log('group_joined', msg.code, msg.group);
        this.send(conn, { t: 'joined', code: msg.code, group: msg.group });
        if (rec.state.paused) this.send(conn, { t: 'pause', on: true });
        return;
      }
      case 'status':
      case 'safety':
      case 'safetyClear': {
        const rec = this.studentClass(conn, m);
        if (!rec) return;
        const group = m.group!;
        const now = this.now();
        if (msg.t === 'status') {
          const { t: _t, ...status } = msg;
          this.apply(rec, { type: 'status', group, status, now });
        } else if (msg.t === 'safety') {
          this.apply(rec, { type: 'safety', group, safetyType: msg.type, at: msg.at, now });
          this.log('safety', rec.state.code, group);
        } else {
          this.apply(rec, { type: 'safetyClear', group, safetyType: msg.type, now });
        }
        return;
      }
      case 'pause':
      case 'ack':
      case 'end': {
        const rec = m.role === 'teacher' && m.code ? this.classes.get(m.code) : undefined;
        if (!rec) return this.error(conn, m.role === 'none' ? 'no_class' : 'bad_token');
        const now = this.now();
        if (msg.t === 'pause') {
          this.apply(rec, { type: 'pause', on: msg.on, now });
          for (const s of rec.students.values()) this.send(s, { t: 'pause', on: msg.on });
          this.log(msg.on ? 'pause_on' : 'pause_off', rec.state.code);
        } else if (msg.t === 'ack') {
          this.apply(rec, { type: 'ack', group: msg.group, safetyType: msg.type, now });
        } else {
          this.endClass(rec);
        }
        return;
      }
    }
  }

  private studentClass(conn: Conn, m: ConnMeta): ClassRec | null {
    const rec = m.role === 'student' && m.code ? this.classes.get(m.code) : undefined;
    if (!rec) {
      this.error(conn, 'no_class');
      return null;
    }
    return rec;
  }

  private apply(rec: ClassRec, event: ClassEvent): void {
    const next = reduce(rec.state, event);
    if (next === rec.state) return;
    rec.state = next;
    this.scheduleSnapshot(rec);
  }

  /** 변경이 있을 때마다 교사에게 snapshot을 보내되 초당 4회까지로 묶는다. */
  private scheduleSnapshot(rec: ClassRec): void {
    if (rec.snapshotTimer || rec.teachers.size === 0) return;
    const wait = Math.max(0, rec.lastSnapshotAt + SNAPSHOT_INTERVAL_MS - this.now());
    const fire = () => {
      rec.snapshotTimer = null;
      rec.lastSnapshotAt = this.now();
      const snap = toSnapshot(rec.state);
      for (const tc of rec.teachers) this.send(tc, snap);
    };
    if (wait === 0) fire();
    else rec.snapshotTimer = setTimeout(fire, wait);
  }

  private endClass(rec: ClassRec): void {
    for (const s of rec.students.values()) {
      this.send(s, { t: 'ended' });
    }
    this.log('class_ended', rec.state.code);
    this.dropClass(rec.state.code, true);
  }

  private dropClass(code: string, closeConns: boolean): void {
    const rec = this.classes.get(code);
    if (!rec) return;
    if (rec.snapshotTimer) clearTimeout(rec.snapshotTimer);
    this.classes.delete(code);
    if (closeConns) {
      for (const c of [...rec.teachers, ...rec.students.values()]) {
        this.meta.delete(c);
        try {
          c.close(1000);
        } catch {
          /* 이미 끊김 */
        }
      }
    }
  }
}

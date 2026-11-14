import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_TUTOR_MESSAGE_BYTES,
  TEACHERLESS_EXPIRE_MS,
  TEACHER_GONE_UNPAUSE_MS,
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
  type TutorEdits,
  type TutorModelRef,
} from '@sci/classroom';

export const MAX_CLASSES = 50;
export const MSGS_PER_SECOND = 10;
export const MAX_BAD_MESSAGES = 3;
/** 교사에게 보내는 snapshot 간격의 최소값(ms): 초당 최대 4회. */
export const SNAPSHOT_INTERVAL_MS = 250;
/** 서버 전체에서 열려 있는 소켓 수 상한. */
export const MAX_SOCKETS = 600;
/** IP 하나당 열려 있는 소켓 수 상한. 학교는 공용 IP 하나를 쓰므로 이보다 낮추지 않는다. */
export const MAX_SOCKETS_PER_IP = 80;
/** 연결 후 이 시간(ms) 안에 create/watch/join에 성공하지 못하면 끊는다. */
export const UNAUTH_TIMEOUT_MS = 10_000;
/** IP 하나당 수업 만들기 한도(시간당). */
export const CREATES_PER_HOUR = 10;
/** 속도 제한을 이 시간(ms) 동안 계속 넘기면 연결을 끊는다. */
export const RATE_OVERFLOW_CLOSE_MS = 5000;
/** 교사 소켓의 쓰기 대기량이 이 값(바이트)을 넘으면 snapshot을 다음 기회로 미룬다. */
export const MAX_BUFFERED_BYTES = 1024 * 1024;
const HOUR_MS = 3600_000;

/** ws 소켓 중 허브가 쓰는 부분. 테스트에서 가짜로 바꿀 수 있다. */
export interface Conn {
  send(data: string): void;
  close(code?: number): void;
  /** 아직 보내지 못하고 쌓인 바이트 수(ws의 bufferedAmount). 없으면 0으로 본다. */
  buffered?(): number;
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
  /** 교사 연결이 마지막으로 하나도 없게 된 때. 교사가 있으면 null. */
  noTeacherSince: number | null;
  /** 교사가 마지막으로 보낸 튜터 질문 덧씌우기. 메모리에만 두고 파일로 쓰지 않는다. 수업이 끝나면 버린다. */
  tutorEdits: TutorEdits | null;
  /** 교사가 마지막으로 알린 교사 PC의 튜터 모델(없으면 null). 메모리에만 둔다. */
  tutorModel: TutorModelRef | null;
}

interface ConnMeta {
  role: 'none' | 'teacher' | 'student';
  code?: string;
  group?: number;
  ip?: string;
  /** 이 서버가 있는 PC 자신(루프백)에서 온 연결인가. 호스트 모드의 수업 만들기 검사에 쓴다. */
  local: boolean;
  openedAt: number;
  /** 허브가 이미 닫은 연결(교체·수업 종료). 이후 메시지는 무시한다. */
  dead: boolean;
  windowStart: number;
  windowCount: number;
  windowOverflowed: boolean;
  /** 속도 제한을 넘기 시작한 때(연속으로 넘기는 동안만 유지). */
  overflowSince: number | null;
  /**
   * 규격 위반 누적 횟수. 시간이 지나도 줄어들지 않는다(연결 하나가 평생 3번까지).
   * 속도 제한 같은 일시적 오류와 달리 정상 클라이언트는 규격 위반을 내지 않으므로 의도한 동작이다.
   */
  bad: number;
}

export interface HubOptions {
  now?: () => number;
  log?: LogFn;
  maxClasses?: number;
  /** 설정하면 create에 같은 secret이 있어야 한다(CREATE_SECRET). */
  createSecret?: string;
  /** IP당 시간당 create 한도. 기본 10. */
  createsPerHour?: number;
  /** 켜면 수업 만들기는 서버가 있는 PC 자신(localhost)에서 온 연결만 된다(교사 PC 수업 서버). 기본 꺼짐. */
  localOnlyCreate?: boolean;
  maxSockets?: number;
  maxSocketsPerIp?: number;
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
  private readonly meta = new Map<Conn, ConnMeta>();
  private readonly ipCounts = new Map<string, number>();
  private readonly createLog = new Map<string, number[]>();
  private readonly secretHash: Buffer | null;
  private readonly createsPerHour: number;
  private readonly localOnlyCreate: boolean;
  private readonly maxSockets: number;
  private readonly maxSocketsPerIp: number;
  private readonly now: () => number;
  private readonly log: LogFn;
  private readonly maxClasses: number;

  constructor(opts: HubOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
    this.maxClasses = opts.maxClasses ?? MAX_CLASSES;
    this.secretHash = opts.createSecret ? sha(opts.createSecret) : null;
    this.createsPerHour = opts.createsPerHour ?? CREATES_PER_HOUR;
    this.localOnlyCreate = opts.localOnlyCreate ?? false;
    this.maxSockets = opts.maxSockets ?? MAX_SOCKETS;
    this.maxSocketsPerIp = opts.maxSocketsPerIp ?? MAX_SOCKETS_PER_IP;
  }

  /** 열려 있는 소켓 수. */
  get socketCount(): number {
    return this.meta.size;
  }

  /** 새 연결을 등록한다. 상한을 넘으면 1013으로 닫고 false를 돌려준다(등록하지 않는다). */
  open(conn: Conn, ip?: string, local = false): boolean {
    if (this.meta.size >= this.maxSockets || (ip !== undefined && (this.ipCounts.get(ip) ?? 0) >= this.maxSocketsPerIp)) {
      this.log('socket_cap');
      try {
        conn.close(1013);
      } catch {
        /* 이미 끊김 */
      }
      return false;
    }
    if (ip !== undefined) this.ipCounts.set(ip, (this.ipCounts.get(ip) ?? 0) + 1);
    const t = this.now();
    this.meta.set(conn, {
      role: 'none',
      ...(ip !== undefined ? { ip } : {}),
      local,
      openedAt: t,
      dead: false,
      windowStart: t,
      windowCount: 0,
      windowOverflowed: false,
      overflowSince: null,
      bad: 0,
    });
    return true;
  }

  /** 원문 메시지 하나를 처리한다. */
  message(conn: Conn, raw: string): void {
    const m = this.meta.get(conn);
    if (!m || m.dead) return;
    const t = this.now();
    if (t - m.windowStart >= 1000) {
      // 직전 1초가 정상이었거나 한동안 조용했다면 "연속" 초과가 아니다.
      if (!m.windowOverflowed || t - m.windowStart >= 2000) m.overflowSince = null;
      m.windowStart = t;
      m.windowCount = 0;
      m.windowOverflowed = false;
    }
    if (++m.windowCount > MSGS_PER_SECOND) {
      m.windowOverflowed = true;
      m.overflowSince ??= t;
      if (t - m.overflowSince >= RATE_OVERFLOW_CLOSE_MS) {
        this.log('rate_limit_close', m.code, m.group);
        conn.close(1008);
        return;
      }
      this.send(conn, { t: 'error', code: 'rate_limited' });
      return;
    }
    // 글자 수가 가장 큰 메시지(tutor)의 바이트 상한보다 길면 바이트 수를 따로 세지 않아도 된다(parseClientMessage가 다시 확인한다).
    const msg = raw.length > MAX_TUTOR_MESSAGE_BYTES ? null : parseClientMessage(raw);
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
    if (m.ip !== undefined) {
      const n = (this.ipCounts.get(m.ip) ?? 1) - 1;
      if (n <= 0) this.ipCounts.delete(m.ip);
      else this.ipCounts.set(m.ip, n);
    }
    const rec = m.code ? this.classes.get(m.code) : undefined;
    if (!rec) return;
    if (m.role === 'teacher') {
      rec.teachers.delete(conn);
      if (rec.teachers.size === 0) rec.noTeacherSince = this.now();
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

  /**
   * 주기적으로 부른다. 만료된 수업을 지우고(지운 개수를 돌려준다),
   * 교사가 사라진 채 멈춰 있는 수업의 멈춤을 풀고, 인증하지 못한 연결을 끊는다.
   */
  sweep(): number {
    const t = this.now();
    let n = 0;
    for (const [code, rec] of this.classes) {
      const gone = rec.teachers.size === 0 && rec.noTeacherSince !== null ? t - rec.noTeacherSince : 0;
      if (isExpired(rec.state, t, rec.teachers.size + rec.students.size > 0)) {
        this.dropClass(code, false);
        this.log('class_expired', code);
        n++;
      } else if (gone >= TEACHERLESS_EXPIRE_MS) {
        // 교사 없이 오래된 수업: 학생에게 끝났음을 알리고 지운다.
        this.endClass(rec);
        this.log('class_expired_teacherless', code);
        n++;
      } else if (rec.state.paused && gone >= TEACHER_GONE_UNPAUSE_MS) {
        this.apply(rec, { type: 'pause', on: false, now: t });
        for (const s of rec.students.values()) this.send(s, { t: 'pause', on: false });
        this.log('pause_off_teacher_gone', code);
      }
    }
    for (const [conn, m] of this.meta) {
      if (m.role === 'none' && !m.dead && t - m.openedAt >= UNAUTH_TIMEOUT_MS) {
        m.dead = true;
        this.log('unauth_timeout');
        try {
          conn.close(1008);
        } catch {
          /* 이미 끊김 */
        }
      }
    }
    for (const [ip, list] of this.createLog) {
      const recent = list.filter((x) => t - x < HOUR_MS);
      if (recent.length === 0) this.createLog.delete(ip);
      else if (recent.length !== list.length) this.createLog.set(ip, recent);
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
        if (m.role === 'teacher') {
          // 이미 교사인 연결의 create는 멱등: 현재 수업의 created와 snapshot을 다시 보낸다.
          const cur = m.code ? this.classes.get(m.code) : undefined;
          if (!cur) return this.error(conn, 'bad_message');
          this.send(conn, { t: 'created', code: cur.state.code, token: cur.token.toString('hex') });
          this.send(conn, toSnapshot(cur.state));
          return;
        }
        if (m.role !== 'none') return this.error(conn, 'bad_message');
        if (this.localOnlyCreate && !m.local) return this.error(conn, 'not_local');
        if (!this.allowCreate(m)) return this.error(conn, 'rate_limited');
        if (this.secretHash && !(typeof msg.secret === 'string' && timingSafeEqual(sha(msg.secret), this.secretHash))) {
          return this.error(conn, 'bad_secret');
        }
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
          noTeacherSince: null,
          tutorEdits: null,
          tutorModel: null,
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
        if (m.role === 'teacher') {
          // 이미 교사인 연결의 watch는 멱등: 같은 수업이면 현재 snapshot을 다시 보낸다.
          const cur = m.code ? this.classes.get(m.code) : undefined;
          if (!cur || cur.state.code !== msg.code) return this.error(conn, 'bad_message');
          this.send(conn, toSnapshot(cur.state));
          return;
        }
        if (m.role !== 'none') return this.error(conn, 'bad_message');
        const rec = this.classes.get(msg.code);
        if (!rec) return this.error(conn, 'no_class');
        const given = Buffer.from(msg.token, 'hex');
        if (given.length !== rec.token.length || !timingSafeEqual(given, rec.token)) return this.error(conn, 'bad_token');
        rec.teachers.add(conn);
        rec.noTeacherSince = null;
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
          const om = this.meta.get(old);
          if (om) {
            om.dead = true;
            om.role = 'none';
            delete om.code;
            delete om.group;
          }
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
        if (rec.tutorEdits) this.send(conn, { t: 'tutor', edits: rec.tutorEdits });
        if (rec.tutorModel) this.send(conn, { t: 'tutorModel', model: rec.tutorModel });
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
      case 'tutor': {
        // 이 수업을 만든 교사 연결(또는 token으로 watch한 연결)만 보낼 수 있다.
        const rec = m.role === 'teacher' && m.code ? this.classes.get(m.code) : undefined;
        if (!rec) return this.error(conn, 'bad_message');
        rec.tutorEdits = msg.edits;
        rec.state = reduce(rec.state, { type: 'touch', now: this.now() });
        for (const s of rec.students.values()) this.send(s, { t: 'tutor', edits: msg.edits });
        this.log('tutor_edits', rec.state.code);
        return;
      }
      case 'tutorModel': {
        // 이 수업의 교사 연결만 보낼 수 있다. 학생에게는 바뀔 때마다 같은 모양으로 전달한다.
        const rec = m.role === 'teacher' && m.code ? this.classes.get(m.code) : undefined;
        if (!rec) return this.error(conn, 'bad_message');
        rec.tutorModel = msg.model;
        rec.state = reduce(rec.state, { type: 'touch', now: this.now() });
        for (const s of rec.students.values()) this.send(s, { t: 'tutorModel', model: msg.model });
        this.log('tutor_model', rec.state.code);
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
    const fire = (targets: Iterable<Conn>) => {
      rec.snapshotTimer = null;
      rec.lastSnapshotAt = this.now();
      const snap = toSnapshot(rec.state);
      const skipped: Conn[] = [];
      for (const tc of targets) {
        if (!rec.teachers.has(tc)) continue;
        // 쓰기 대기량이 큰 교사 소켓에는 쌓아 두지 않고 다음 기회에 보낸다.
        if ((tc.buffered?.() ?? 0) > MAX_BUFFERED_BYTES) skipped.push(tc);
        else this.send(tc, snap);
      }
      if (skipped.length > 0) rec.snapshotTimer = setTimeout(() => fire(skipped), SNAPSHOT_INTERVAL_MS);
    };
    if (wait === 0) fire([...rec.teachers]);
    else rec.snapshotTimer = setTimeout(() => fire([...rec.teachers]), wait);
  }

  /** IP당 시간당 create 횟수를 센다. 한도를 넘으면 false. IP를 모르는 연결(테스트)은 세지 않는다. */
  private allowCreate(m: ConnMeta): boolean {
    if (m.ip === undefined) return true;
    const t = this.now();
    const list = (this.createLog.get(m.ip) ?? []).filter((x) => t - x < HOUR_MS);
    if (list.length >= this.createsPerHour) {
      this.createLog.set(m.ip, list);
      return false;
    }
    list.push(t);
    this.createLog.set(m.ip, list);
    return true;
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
        const cm = this.meta.get(c);
        if (cm) {
          cm.dead = true;
          cm.role = 'none';
          delete cm.code;
          delete cm.group;
        }
        try {
          c.close(1000);
        } catch {
          /* 이미 끊김 */
        }
      }
    }
  }
}

const sha = (v: string): Buffer => createHash('sha256').update(v).digest();

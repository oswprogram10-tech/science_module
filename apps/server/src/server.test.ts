import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { STALE_MS, parseServerMessage, type ServerMessage, type Snapshot } from '@sci/classroom';
import { buildServer, normalizeOrigin } from './app';
import { Hub, makeCode, MAX_CLASSES, MAX_BUFFERED_BYTES, SNAPSHOT_INTERVAL_MS, type Conn } from './hub';

type Srv = Awaited<ReturnType<typeof buildServer>>;
let srv: Srv;
let url: string;
const sockets: WebSocket[] = [];

async function start(opts: Parameters<typeof buildServer>[0] = {}) {
  srv = await buildServer(opts);
  await srv.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = srv.app.server.address();
  url = `ws://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/ws`;
}

class Client {
  readonly msgs: ServerMessage[] = [];
  closeCode: number | null = null;
  private waiters: (() => void)[] = [];
  private constructor(readonly ws: WebSocket) {
    ws.on('message', (d) => {
      const m = parseServerMessage(d.toString());
      if (m) this.msgs.push(m);
      this.waiters.splice(0).forEach((w) => w());
    });
    ws.on('close', (code) => {
      this.closeCode = code;
      this.waiters.splice(0).forEach((w) => w());
    });
  }
  static async connect(origin?: string): Promise<Client> {
    const ws = new WebSocket(url, origin ? { origin } : undefined);
    sockets.push(ws);
    const c = new Client(ws);
    await new Promise<void>((res, rej) => {
      ws.once('open', () => res());
      ws.once('error', rej);
      ws.once('close', () => res());
    });
    return c;
  }
  send(o: unknown) {
    this.ws.send(typeof o === 'string' ? o : JSON.stringify(o));
  }
  /** 조건에 맞는 메시지가 올 때까지 기다린다(최대 3초). */
  async until<T extends ServerMessage>(pred: (m: ServerMessage) => m is T): Promise<T>;
  async until(pred: (m: ServerMessage) => boolean): Promise<ServerMessage>;
  async until(pred: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + 3000;
    for (;;) {
      const hit = this.msgs.find(pred);
      if (hit) return hit;
      if (Date.now() > deadline) throw new Error(`기다린 메시지가 오지 않았어요: ${JSON.stringify(this.msgs)}`);
      await new Promise<void>((res) => {
        this.waiters.push(res);
        setTimeout(res, 100);
      });
    }
  }
  snapshot(pred: (s: Snapshot) => boolean = () => true) {
    return this.until((m): m is Snapshot => m.t === 'snapshot' && pred(m));
  }
  async closed(): Promise<number> {
    const deadline = Date.now() + 3000;
    while (this.closeCode === null) {
      if (Date.now() > deadline) throw new Error('연결이 닫히지 않았어요');
      await new Promise<void>((res) => {
        this.waiters.push(res);
        setTimeout(res, 50);
      });
    }
    return this.closeCode;
  }
}

async function makeClass() {
  const teacher = await Client.connect();
  teacher.send({ t: 'create' });
  const created = await teacher.until((m): m is Extract<ServerMessage, { t: 'created' }> => m.t === 'created');
  return { teacher, code: created.code, token: created.token };
}
const student = async (code: string, group: number) => {
  const s = await Client.connect();
  s.send({ t: 'join', code, group, deviceTier: 'B', appVersion: '0.0.0' });
  return s;
};

beforeEach(() => start());
afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await srv.app.close();
});

describe('교사와 학생', () => {
  it('create -> 코드·토큰과 첫 snapshot', async () => {
    const { teacher, code, token } = await makeClass();
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const snap = await teacher.snapshot();
    expect(snap).toMatchObject({ code, paused: false, groups: [] });
  });

  it('학생 join/status/safety -> 교사 snapshot', async () => {
    const { teacher, code } = await makeClass();
    const s = await student(code, 2);
    await s.until((m) => m.t === 'joined');
    s.send({ t: 'status', unitId: 'g5-solution', activity: 'variable', phase: 'reviewing', trials: 1, lastKind: 'first-trial', mismatch: false, safetyLocked: false });
    s.send({ t: 'safety', type: 'NO_GOGGLES', at: 123456 });
    const snap = await teacher.snapshot((x) => x.groups[0]?.safety.length === 1 && x.groups[0]?.trials === 1);
    expect(snap.groups[0]).toMatchObject({
      group: 2,
      online: true,
      deviceTier: 'B',
      unitId: 'g5-solution',
      phase: 'reviewing',
      trials: 1,
      safety: [{ type: 'NO_GOGGLES', at: 123456, acked: false }],
    });
    teacher.send({ t: 'ack', group: 2, type: 'NO_GOGGLES' });
    const acked = await teacher.snapshot((x) => x.groups[0]?.safety[0]?.acked === true);
    expect(acked.groups[0]!.safety[0]!.acked).toBe(true);
    s.ws.close();
    await teacher.snapshot((x) => x.groups[0]?.online === false);
  });

  it('활동이 넷인 단원(g3-force)은 모둠마다 다른 활동을 해도 교사 snapshot이 모둠별 experimentId를 그대로 싣고, 활동 넷의 튜터 덧씌우기를 모두 전달한다', async () => {
    const { teacher, code } = await makeClass();
    const ids = ['lever-balance', 'lever-lift', 'push-pull', 'spring-scale'];
    const students = await Promise.all(ids.map((_, i) => student(code, i + 1)));
    for (const [i, s] of students.entries()) {
      await s.until((m) => m.t === 'joined');
      s.send({ t: 'status', unitId: 'g3-force', experimentId: ids[i], activity: 'variable', phase: 'reviewing', trials: i + 1, lastKind: 'first-trial', mismatch: false, safetyLocked: false });
    }
    const snap = await teacher.snapshot((x) => x.groups.length === 4 && x.groups.every((g) => g.trials > 0));
    expect(snap.groups.map((g) => [g.group, g.unitId, g.experimentId])).toEqual(ids.map((id, i) => [i + 1, 'g3-force', id]));
    const probe = (text: string) => ({ changed: { '|before-run|': { text } }, added: [] });
    const edits = { v: 1, units: { 'g3-force': Object.fromEntries(ids.map((id) => [id, probe('무엇을 바꾸면 달라질지 먼저 적어 볼까요?')])) } };
    teacher.send({ t: 'tutor', edits });
    for (const s of students) expect(await s.until((m) => m.t === 'tutor')).toEqual({ t: 'tutor', edits });
  });

  it('watch로 같은 수업을 다시 볼 수 있다', async () => {
    const { code, token } = await makeClass();
    const t2 = await Client.connect();
    t2.send({ t: 'watch', code, token });
    expect(await t2.snapshot()).toMatchObject({ code });
  });

  it('pause가 학생에게 전달되고, 나중에 들어온 학생에게도 알린다', async () => {
    const { teacher, code } = await makeClass();
    const s1 = await student(code, 2);
    const s2 = await student(code, 5);
    await s1.until((m) => m.t === 'joined');
    await s2.until((m) => m.t === 'joined');
    teacher.send({ t: 'pause', on: true });
    expect(await s1.until((m) => m.t === 'pause')).toEqual({ t: 'pause', on: true });
    await s2.until((m) => m.t === 'pause');
    await teacher.snapshot((x) => x.paused);
    const s3 = await student(code, 7);
    expect(await s3.until((m) => m.t === 'pause')).toEqual({ t: 'pause', on: true });
    teacher.send({ t: 'pause', on: false });
    await s1.until((m) => m.t === 'pause' && !m.on);
  });

  it('end: 학생에게 ended, 수업 삭제', async () => {
    const { teacher, code } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    teacher.send({ t: 'end' });
    await s.until((m) => m.t === 'ended');
    await s.closed();
    expect(srv.hub.classes.size).toBe(0);
    const late = await student(code, 1);
    expect(await late.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'no_class' });
  });
});

describe('거절', () => {
  it('잘못된 토큰·없는 수업', async () => {
    const { code } = await makeClass();
    const t = await Client.connect();
    t.send({ t: 'watch', code, token: '0'.repeat(32) });
    expect(await t.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_token' });
    const t2 = await Client.connect();
    t2.send({ t: 'watch', code: 'ZZZZZZ', token: '0'.repeat(32) });
    expect(await t2.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'no_class' });
  });

  it('학생은 교사 기능을 쓸 수 없다', async () => {
    const { code } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    s.send({ t: 'pause', on: true });
    expect(await s.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_token' });
    expect(srv.hub.classes.get(code)!.state.paused).toBe(false);
  });

  it('같은 모둠 번호는 group_taken', async () => {
    const { code } = await makeClass();
    const a = await student(code, 4);
    await a.until((m) => m.t === 'joined');
    const b = await student(code, 4);
    expect(await b.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'group_taken' });
  });

  it('규격에 맞지 않으면 bad_message, 3번이면 연결을 끊는다', async () => {
    const c = await Client.connect();
    c.send('not json');
    c.send({ t: 'join', code: 'ABC234', group: 99, appVersion: 'x' });
    c.send({ t: 'status' });
    expect(await c.closed()).toBe(1008);
    expect(c.msgs.filter((m) => m.t === 'error' && m.code === 'bad_message').length).toBeGreaterThanOrEqual(2);
  });

  it('8 KB를 넘는 일반 메시지는 거절하고(bad_message), ws 상한(tutor 48 KB)을 넘는 메시지는 연결을 닫는다', async () => {
    const c = await Client.connect();
    c.send(JSON.stringify({ t: 'status', lastKind: 'x'.repeat(9000) }));
    expect(await c.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_message' });
    c.send(JSON.stringify({ t: 'status', lastKind: 'x'.repeat(60_000) }));
    expect(await c.closed()).toBe(1009);
  });

  it('초당 10개를 넘으면 rate_limited', async () => {
    const { code } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    for (let i = 0; i < 30; i++) s.send({ t: 'status', phase: 'idle', trials: i, safetyLocked: false });
    expect(await s.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'rate_limited' });
  });

  it('수업은 최대 50개', async () => {
    // 한 IP에서 50개를 만들려면 IP별 create 한도(기본 시간당 10)를 풀어 둬야 한다.
    await srv.app.close();
    await start({ createsPerHour: 1000 });
    for (let i = 0; i < MAX_CLASSES; i++) {
      const t = await Client.connect();
      t.send({ t: 'create' });
      await t.until((m) => m.t === 'created');
    }
    const t = await Client.connect();
    t.send({ t: 'create' });
    expect(await t.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'class_full' });
  });

  it('/health', async () => {
    await makeClass();
    const r = await srv.app.inject({ method: 'GET', url: '/health' });
    expect(r.json()).toEqual({ ok: true, classes: 1 });
  });
});

describe('Origin 허용 목록', () => {
  it('목록에 없는 Origin은 거절한다', async () => {
    await srv.app.close();
    await start({ allowedOrigins: ['http://localhost:4175'] });
    const bad = await Client.connect('http://evil.example');
    expect(await bad.closed()).toBe(1008);
    const good = await Client.connect('http://localhost:4175');
    good.send({ t: 'create' });
    await good.until((m) => m.t === 'created');
  });
});

describe('허브(가짜 연결·가짜 시계)', () => {
  const fake = () => {
    const out: string[] = [];
    let closed: number | undefined;
    const conn: Conn = { send: (d) => out.push(d), close: (c) => void (closed = c) };
    return { conn, out, closed: () => closed, last: () => JSON.parse(out[out.length - 1]!) };
  };

  it('30초 넘게 조용한 연결은 새 연결로 바꾼다', () => {
    let t = 1_000_000;
    const hub = new Hub({ now: () => t });
    const teacher = fake();
    hub.open(teacher.conn);
    hub.message(teacher.conn, '{"t":"create"}');
    const code = JSON.parse(teacher.out[0]!).code as string;
    const join = JSON.stringify({ t: 'join', code, group: 3, appVersion: '1' });
    const a = fake();
    hub.open(a.conn);
    hub.message(a.conn, join);
    t += 10_000;
    const b = fake();
    hub.open(b.conn);
    hub.message(b.conn, join);
    expect(b.last()).toEqual({ t: 'error', code: 'group_taken' });
    t += STALE_MS; // 마지막 응답(a의 join) 이후 STALE_MS가 지나야 교체된다
    hub.message(b.conn, join);
    expect(b.last()).toEqual({ t: 'joined', code, group: 3 });
    expect(a.closed()).toBe(4001);
    hub.close(a.conn); // 이전 연결이 늦게 닫혀도 새 연결의 상태는 그대로
    expect(hub.classes.get(code)!.state.groups[3]!.online).toBe(true);
  });

  it('연결이 없으면 수업을 지운다(교사 부재 30분 규칙이 6시간 유휴 규칙보다 먼저 적용된다)', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const teacher = fake();
    hub.open(teacher.conn);
    hub.message(teacher.conn, '{"t":"create"}');
    expect(hub.sweep()).toBe(0);
    hub.close(teacher.conn);
    t += 30 * 60_000 - 1;
    expect(hub.sweep()).toBe(0);
    t += 1;
    expect(hub.sweep()).toBe(1);
    expect(hub.classes.size).toBe(0);
  });

  it('snapshot은 초당 4회로 묶는다', async () => {
    const hub = new Hub();
    const teacher = fake();
    hub.open(teacher.conn);
    hub.message(teacher.conn, '{"t":"create"}');
    const code = JSON.parse(teacher.out[0]!).code as string;
    const s = fake();
    hub.open(s.conn);
    hub.message(s.conn, JSON.stringify({ t: 'join', code, group: 1, appVersion: '1' }));
    const before = teacher.out.length;
    for (let i = 0; i < 8; i++) hub.message(s.conn, JSON.stringify({ t: 'status', phase: 'idle', trials: i, safetyLocked: false }));
    await new Promise((r) => setTimeout(r, 400));
    expect(teacher.out.length - before).toBeLessThanOrEqual(3);
    expect(JSON.parse(teacher.out[teacher.out.length - 1]!).groups[0].trials).toBe(7);
    hub.shutdown();
  });

  it('수업 코드는 헷갈리는 글자 없이 6자', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  });
});

describe('리뷰 반영 v0.1: 서버', () => {
  const fake = (buffered?: () => number) => {
    const out: string[] = [];
    let closed: number | undefined;
    const conn: Conn = { send: (d) => out.push(d), close: (c) => void (closed = c), ...(buffered ? { buffered } : {}) };
    return { conn, out, closed: () => closed, last: () => JSON.parse(out[out.length - 1]!), msgs: () => out.map((o) => JSON.parse(o)) };
  };
  const mkClass = (hub: Hub, ip?: string) => {
    const teacher = fake();
    hub.open(teacher.conn, ip);
    hub.message(teacher.conn, '{"t":"create"}');
    const created = teacher.msgs().find((m) => m.t === 'created');
    return { teacher, code: created.code as string, token: created.token as string };
  };
  const join = (hub: Hub, code: string, group: number) => {
    const s = fake();
    hub.open(s.conn);
    hub.message(s.conn, JSON.stringify({ t: 'join', code, group, appVersion: '1' }));
    return s;
  };

  it('멈춤 중 교사가 30초 동안 없으면 멈춤을 풀고 학생에게 알린다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const { teacher, code } = mkClass(hub);
    const s = join(hub, code, 1);
    hub.message(teacher.conn, '{"t":"pause","on":true}');
    expect(s.msgs().some((m) => m.t === 'pause' && m.on)).toBe(true);
    hub.close(teacher.conn);
    t += 29_999;
    hub.sweep();
    expect(hub.classes.get(code)!.state.paused).toBe(true);
    t += 1;
    hub.sweep();
    expect(hub.classes.get(code)!.state.paused).toBe(false);
    expect(s.last()).toEqual({ t: 'pause', on: false });
    hub.shutdown();
  });

  it('교사가 30초 안에 돌아오면 멈춤이 유지된다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const { teacher, code, token } = mkClass(hub);
    hub.message(teacher.conn, '{"t":"pause","on":true}');
    hub.close(teacher.conn);
    t += 20_000;
    const t2 = fake();
    hub.open(t2.conn);
    hub.message(t2.conn, JSON.stringify({ t: 'watch', code, token }));
    t += 60_000;
    hub.sweep();
    expect(hub.classes.get(code)!.state.paused).toBe(true);
    hub.shutdown();
  });

  it('교사 연결이 30분 없으면 학생이 남아 있어도 수업을 지운다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const { teacher, code } = mkClass(hub);
    const s = join(hub, code, 1);
    hub.close(teacher.conn);
    t += 30 * 60_000 - 1;
    s.out.length = 0;
    hub.message(s.conn, JSON.stringify({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false })); // 학생 활동은 교사 부재를 되돌리지 않는다
    expect(hub.sweep()).toBe(0);
    t += 1;
    expect(hub.sweep()).toBe(1);
    expect(hub.classes.size).toBe(0);
    expect(s.msgs().some((m) => m.t === 'ended')).toBe(true);
    hub.shutdown();
  });

  it('10초 안에 인증하지 못한 연결은 1008로 끊는다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const idle = fake();
    hub.open(idle.conn);
    const { teacher } = mkClass(hub);
    t += 9_999;
    hub.sweep();
    expect(idle.closed()).toBeUndefined();
    t += 1;
    hub.sweep();
    expect(idle.closed()).toBe(1008);
    expect(teacher.closed()).toBeUndefined();
  });

  it('소켓 상한: 전체 600, IP당 80, 초과는 1013', () => {
    const hub = new Hub();
    for (let i = 0; i < 80; i++) expect(hub.open(fake().conn, '10.0.0.1')).toBe(true);
    const over = fake();
    expect(hub.open(over.conn, '10.0.0.1')).toBe(false);
    expect(over.closed()).toBe(1013);
    const other = fake();
    expect(hub.open(other.conn, '10.0.0.2')).toBe(true);
    // 닫히면 자리가 난다
    const first = fake();
    expect(hub.open(first.conn, '10.0.0.3')).toBe(true);
    hub.close(first.conn);
    for (let i = 0; i < 80; i++) hub.open(fake().conn, '10.0.0.4');
    expect(hub.socketCount).toBe(80 + 1 + 80);
    const total = new Hub();
    for (let i = 0; i < 600; i++) expect(total.open(fake().conn, `ip${i % 20}-${Math.floor(i / 80)}`)).toBe(true);
    const full = fake();
    expect(total.open(full.conn, 'fresh')).toBe(false);
    expect(full.closed()).toBe(1013);
  });

  it('IP당 create는 시간당 10번, 지나면 다시 가능', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    for (let i = 0; i < 10; i++) {
      const c = fake();
      hub.open(c.conn, '1.1.1.1');
      hub.message(c.conn, '{"t":"create"}');
      expect(c.msgs()[0].t).toBe('created');
    }
    const c = fake();
    hub.open(c.conn, '1.1.1.1');
    hub.message(c.conn, '{"t":"create"}');
    expect(c.last()).toEqual({ t: 'error', code: 'rate_limited' });
    const other = fake();
    hub.open(other.conn, '2.2.2.2');
    hub.message(other.conn, '{"t":"create"}');
    expect(other.msgs()[0].t).toBe('created');
    t += 3600_000;
    hub.message(c.conn, '{"t":"create"}');
    expect(c.last().t).toBe('snapshot');
  });

  it('CREATE_SECRET이 있으면 create에 맞는 secret이 필요하다', () => {
    const hub = new Hub({ createSecret: 'pw-1234' });
    const a = fake();
    hub.open(a.conn);
    hub.message(a.conn, '{"t":"create"}');
    expect(a.last()).toEqual({ t: 'error', code: 'bad_secret' });
    hub.message(a.conn, '{"t":"create","secret":"nope"}');
    expect(a.last()).toEqual({ t: 'error', code: 'bad_secret' });
    expect(hub.classes.size).toBe(0);
    hub.message(a.conn, '{"t":"create","secret":"pw-1234"}');
    expect(a.msgs().some((m) => m.t === 'created')).toBe(true);
    // 비밀번호가 없는 서버는 secret이 있어도 그냥 만든다
    const open = new Hub();
    const b = fake();
    open.open(b.conn);
    open.message(b.conn, '{"t":"create","secret":"x"}');
    expect(b.msgs()[0].t).toBe('created');
  });

  it('호스트 모드: 수업 만들기는 localhost에서 온 연결만, 학생 참여와 보기는 어디서든', () => {
    const hub = new Hub({ localOnlyCreate: true });
    const lan = fake();
    hub.open(lan.conn, '192.168.0.23', false);
    hub.message(lan.conn, '{"t":"create"}');
    expect(lan.last()).toEqual({ t: 'error', code: 'not_local' });
    expect(hub.classes.size).toBe(0);
    const here = fake();
    hub.open(here.conn, '127.0.0.1', true);
    hub.message(here.conn, '{"t":"create"}');
    const created = here.msgs().find((m) => m.t === 'created');
    expect(created).toBeTruthy();
    // 같은 무선망의 학생은 참여할 수 있다.
    const stu = fake();
    hub.open(stu.conn, '192.168.0.23', false);
    hub.message(stu.conn, JSON.stringify({ t: 'join', code: created.code, group: 1, appVersion: '1' }));
    expect(stu.msgs().some((m) => m.t === 'joined')).toBe(true);
    // 학교 서버 모드(기본)는 어디서든 만들 수 있다.
    const school = new Hub();
    const c = fake();
    school.open(c.conn, '192.168.0.23', false);
    school.message(c.conn, '{"t":"create"}');
    expect(c.msgs()[0].t).toBe('created');
  });

  it('create/watch를 이미 교사인 연결이 다시 보내면 멱등', () => {
    const hub = new Hub();
    const { teacher, code, token } = mkClass(hub);
    teacher.out.length = 0;
    hub.message(teacher.conn, '{"t":"create"}');
    expect(teacher.msgs().map((m) => m.t)).toEqual(['created', 'snapshot']);
    expect(teacher.msgs()[0]).toEqual({ t: 'created', code, token });
    expect(hub.classes.size).toBe(1);
    teacher.out.length = 0;
    hub.message(teacher.conn, JSON.stringify({ t: 'watch', code, token }));
    expect(teacher.msgs().map((m) => m.t)).toEqual(['snapshot']);
    expect(teacher.out.some((o) => o.includes('bad_message'))).toBe(false);
    hub.shutdown();
  });

  it('속도 제한을 5초 동안 계속 넘기면 1008로 끊는다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const { code } = mkClass(hub);
    const s = join(hub, code, 1);
    const burst = () => {
      for (let i = 0; i < 12; i++) hub.message(s.conn, JSON.stringify({ t: 'status', phase: 'idle', trials: i, safetyLocked: false }));
    };
    for (let sec = 0; sec < 5; sec++) {
      burst();
      expect(s.closed()).toBeUndefined();
      t += 1000;
    }
    burst();
    expect(s.closed()).toBe(1008);
    // 중간에 정상 1초가 있으면 처음부터 다시 센다
    const s2 = join(hub, code, 2);
    const burst2 = () => {
      for (let i = 0; i < 12; i++) hub.message(s2.conn, JSON.stringify({ t: 'status', phase: 'idle', trials: i, safetyLocked: false }));
    };
    for (let sec = 0; sec < 4; sec++) {
      burst2();
      t += 1000;
    }
    t += 1000; // 조용한 1초
    for (let sec = 0; sec < 4; sec++) {
      burst2();
      t += 1000;
    }
    expect(s2.closed()).toBeUndefined();
    hub.shutdown();
  });

  it('쓰기 대기량이 1 MB를 넘는 교사 소켓에는 snapshot을 미뤘다가 보낸다', async () => {
    const hub = new Hub();
    let buffered = MAX_BUFFERED_BYTES + 1;
    const teacher = fake(() => buffered);
    hub.open(teacher.conn);
    hub.message(teacher.conn, '{"t":"create"}');
    const code = teacher.msgs()[0].code as string;
    await new Promise((r) => setTimeout(r, SNAPSHOT_INTERVAL_MS + 20)); // 첫 snapshot 간격이 지나게
    const s = join(hub, code, 1);
    expect(s.last().t).toBe('joined');
    const before = teacher.out.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(teacher.out.length).toBe(before); // 대기량이 커서 보내지 않았다
    buffered = 0;
    await new Promise((r) => setTimeout(r, SNAPSHOT_INTERVAL_MS + 100));
    expect(teacher.out.length).toBe(before + 1);
    expect(teacher.last().groups[0].group).toBe(1);
    hub.shutdown();
  });

  it('Origin 비교는 대소문자와 끝 슬래시를 무시한다', async () => {
    expect(normalizeOrigin('HTTP://Localhost:4175/')).toBe('http://localhost:4175');
    await srv.app.close();
    await start({ allowedOrigins: ['HTTP://Localhost:4175/'] });
    const good = await Client.connect('http://localhost:4175');
    good.send({ t: 'create' });
    await good.until((m) => m.t === 'created');
    const bad = await Client.connect('http://localhost:4176');
    expect(await bad.closed()).toBe(1008);
  });

  it('pong이 없는 반쯤 끊긴 소켓은 다음 ping 때 terminate한다', async () => {
    await srv.app.close();
    await start({ pingIntervalMs: 60 });
    const dead = new WebSocket(url, { autoPong: false });
    const live = new WebSocket(url);
    sockets.push(dead, live);
    const closed = new Promise<number>((res) => dead.once('close', (c) => res(c)));
    let liveClosed = false;
    live.once('close', () => (liveClosed = true));
    await Promise.all([new Promise((r) => dead.once('open', r)), new Promise((r) => live.once('open', r))]);
    live.send(JSON.stringify({ t: 'create' }));
    expect(await closed).toBe(1006);
    await new Promise((r) => setTimeout(r, 200));
    expect(liveClosed).toBe(false); // pong을 보내는 정상 소켓은 유지
  });
});

describe('교사 PC 수업 서버 모드(서버)', () => {
  it('hostMode: localhost에서 연결한 교사 화면은 수업을 만들 수 있다', async () => {
    await srv.app.close();
    await start({ hostMode: true });
    const { code } = await makeClass();
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  });

  it('/host-info는 localhost에서 온 요청에만 응답한다', async () => {
    await srv.app.close();
    await start({ hostMode: true, hostInfo: () => ({ addresses: ['192.168.0.10'], port: 8787 }) });
    const local = await srv.app.inject({ method: 'GET', url: '/host-info', remoteAddress: '127.0.0.1' });
    expect(local.statusCode).toBe(200);
    expect(local.json()).toEqual({ addresses: ['192.168.0.10'], port: 8787 });
    expect((await srv.app.inject({ method: 'GET', url: '/host-info', remoteAddress: '::1' })).statusCode).toBe(200);
    expect((await srv.app.inject({ method: 'GET', url: '/host-info', remoteAddress: '::ffff:127.0.0.1' })).statusCode).toBe(200);
    const lan = await srv.app.inject({ method: 'GET', url: '/host-info', remoteAddress: '192.168.0.23' });
    expect(lan.statusCode).toBe(403);
    expect(lan.body).not.toContain('192.168.0.10');
  });

  it('hostInfo를 주지 않으면 /host-info는 없다(학교 서버 모드)', async () => {
    const res = await srv.app.inject({ method: 'GET', url: '/host-info', remoteAddress: '127.0.0.1' });
    expect(res.statusCode).toBe(404);
  });
});

describe('튜터 질문 덧씌우기(tutor)', () => {
  const edits = { v: 1, units: { 'g6-motion': { 'ramp-cart': { changed: { '|before-run|': { text: '출발 높이를 바꾸면 무엇이 달라질까요?' }, '|repeat|': { off: true } }, added: [] } } } };
  /** 8 KB를 넘는 덧씌우기: 질문 20개 x 200자 x 여러 활동. */
  const bigEdits = () => {
    const units: Record<string, Record<string, unknown>> = {};
    for (let u = 0; u < 3; u++) {
      const exps: Record<string, unknown> = {};
      for (let e = 0; e < 3; e++) exps[`e${e}`] = { changed: {}, added: Array.from({ length: 20 }, (_, i) => ({ when: `w${i}`, text: `${'가'.repeat(60)}?` })) };
      units[`u${u}`] = exps;
    }
    return { v: 1, units };
  };

  it('교사가 보내면 모든 학생에게 전달되고, 나중에 join한 학생도 joined 바로 뒤에 받는다', async () => {
    const { teacher, code } = await makeClass();
    const s1 = await student(code, 2);
    await s1.until((m) => m.t === 'joined');
    teacher.send({ t: 'tutor', edits });
    expect(await s1.until((m) => m.t === 'tutor')).toEqual({ t: 'tutor', edits });
    const s2 = await student(code, 5);
    await s2.until((m) => m.t === 'tutor');
    expect(s2.msgs.map((m) => m.t).slice(0, 2)).toEqual(['joined', 'tutor']);
    // 고쳐 보내면 마지막 것이 남는다.
    const edits2 = { v: 1, units: {} };
    teacher.send({ t: 'tutor', edits: edits2 });
    await s1.until((m) => m.t === 'tutor' && Object.keys(m.edits.units).length === 0);
    const s3 = await student(code, 7);
    expect((await s3.until((m) => m.t === 'tutor')) as { edits: unknown }).toMatchObject({ edits: edits2 });
  });

  it('8 KB를 넘는 덧씌우기도 교사가 보낼 수 있다', async () => {
    const { teacher, code } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    const big = bigEdits();
    const raw = JSON.stringify({ t: 'tutor', edits: big });
    expect(raw.length).toBeGreaterThan(8 * 1024);
    expect(raw.length).toBeLessThan(48 * 1024);
    teacher.send(raw);
    const got = await s.until((m) => m.t === 'tutor');
    expect(got).toEqual({ t: 'tutor', edits: big });
  });

  it('학생이 보내면 bad_message이고 다른 학생에게 전달되지 않는다', async () => {
    const { code } = await makeClass();
    const a = await student(code, 1);
    const b = await student(code, 2);
    await a.until((m) => m.t === 'joined');
    await b.until((m) => m.t === 'joined');
    a.send({ t: 'tutor', edits });
    expect(await a.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_message' });
    await new Promise((r) => setTimeout(r, 150));
    expect(b.msgs.some((m) => m.t === 'tutor')).toBe(false);
    expect(srv.hub.classes.get(code)!.tutorEdits).toBeNull();
  });

  it('규격에 맞지 않는 덧씌우기는 거절한다', async () => {
    const { teacher, code } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    teacher.send({ t: 'tutor', edits: { v: 1, units: { 'G6 Motion': {} } } });
    expect(await teacher.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_message' });
    expect(srv.hub.classes.get(code)!.tutorEdits).toBeNull();
  });

  it('token으로 watch한 교사 연결도 보낼 수 있다', async () => {
    const { code, token } = await makeClass();
    const s = await student(code, 1);
    await s.until((m) => m.t === 'joined');
    const t2 = await Client.connect();
    t2.send({ t: 'watch', code, token });
    await t2.snapshot();
    t2.send({ t: 'tutor', edits });
    await s.until((m) => m.t === 'tutor');
  });

  it('연결하지 않은 소켓이 보내면 bad_message', async () => {
    const c = await Client.connect();
    c.send({ t: 'tutor', edits });
    expect(await c.until((m) => m.t === 'error')).toEqual({ t: 'error', code: 'bad_message' });
  });

  it('수업이 끝나면 버린다(같은 코드의 수업은 다시 만들어지지 않고, 허브에 남지 않는다)', async () => {
    const { teacher, code } = await makeClass();
    teacher.send({ t: 'tutor', edits });
    await new Promise((r) => setTimeout(r, 100));
    const rec = srv.hub.classes.get(code)!;
    expect(rec.tutorEdits).toEqual(edits);
    teacher.send({ t: 'end' });
    await teacher.closed();
    expect(srv.hub.classes.has(code)).toBe(false);
    const { teacher: t2, code: code2 } = await makeClass();
    expect(code2).not.toBe(code);
    expect(srv.hub.classes.get(code2)!.tutorEdits).toBeNull();
    const late = await student(code2, 1);
    await late.until((m) => m.t === 'joined');
    await new Promise((r) => setTimeout(r, 100));
    expect(late.msgs.some((m) => m.t === 'tutor')).toBe(false);
    void t2;
  });

  it('기존 rate limit이 그대로 적용된다', async () => {
    const { teacher } = await makeClass();
    for (let i = 0; i < 30; i++) teacher.send({ t: 'tutor', edits });
    expect(await teacher.until((m) => m.t === 'error' && m.code === 'rate_limited')).toEqual({ t: 'error', code: 'rate_limited' });
  });
});

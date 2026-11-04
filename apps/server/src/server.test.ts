import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { parseServerMessage, type ServerMessage, type Snapshot } from '@sci/classroom';
import { buildServer } from './app';
import { Hub, makeCode, MAX_CLASSES, type Conn } from './hub';

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

  it('8 KB를 넘는 메시지는 연결을 닫는다', async () => {
    const c = await Client.connect();
    c.send(JSON.stringify({ t: 'status', lastKind: 'x'.repeat(9000) }));
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
    t += 30_000;
    hub.message(b.conn, join);
    expect(b.last()).toEqual({ t: 'joined', code, group: 3 });
    expect(a.closed()).toBe(4001);
    hub.close(a.conn); // 이전 연결이 늦게 닫혀도 새 연결의 상태는 그대로
    expect(hub.classes.get(code)!.state.groups[3]!.online).toBe(true);
  });

  it('연결 없이 6시간이 지나면 수업을 지운다', () => {
    let t = 0;
    const hub = new Hub({ now: () => t });
    const teacher = fake();
    hub.open(teacher.conn);
    hub.message(teacher.conn, '{"t":"create"}');
    expect(hub.sweep()).toBe(0);
    hub.close(teacher.conn);
    t += 6 * 3600_000 - 1;
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

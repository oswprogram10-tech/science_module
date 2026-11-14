import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './app';
import { ModelStore, parseRange, UploadError } from './models';

type Srv = Awaited<ReturnType<typeof buildServer>>;
let srv: Srv;
let dir: string;

const IDS = ['qwen3-1.7b', 'qwen3-4b'];
const body = (n: number, head = 'GGUF') => Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, n - head.length), 7)]);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const OCTET = { 'content-type': 'application/octet-stream', 'x-sci-bridge-upload': '1' };
const post = (id: string, payload: Buffer | Readable, remoteAddress = '127.0.0.1', headers: Record<string, string> = OCTET) =>
  srv.app.inject({ method: 'POST', url: `/tutor-models/${id}`, payload, remoteAddress, headers });
const list = async (remoteAddress = '192.168.0.9') => (await srv.app.inject({ method: 'GET', url: '/tutor-models', remoteAddress })).json();

async function start(opts: { maxBytes?: number; hostMode?: boolean } = {}) {
  srv = await buildServer({ hostMode: opts.hostMode ?? true, tutorModels: { dir, ids: IDS, ...(opts.maxBytes ? { maxBytes: opts.maxBytes } : {}) } });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sci-models-'));
});
afterEach(async () => {
  await srv?.app.close();
  await rm(dir, { recursive: true, force: true });
});

describe('튜터 모델 파일 올리기(POST /tutor-models/:id)', () => {
  it('hostMode가 아니면 경로가 없다(학교 서버 모드)', async () => {
    await start({ hostMode: false });
    expect((await srv.app.inject({ method: 'GET', url: '/tutor-models' })).statusCode).toBe(404);
    expect((await post('qwen3-1.7b', body(100))).statusCode).toBe(404);
  });

  it('localhost에서 올리면 저장하고 sha256·크기를 돌려주며 .json을 쓴다', async () => {
    await start();
    const b = body(5000);
    const res = await post('qwen3-1.7b', b);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: 'qwen3-1.7b', size: 5000, sha256: sha(b) });
    expect((await readFile(join(dir, 'qwen3-1.7b.gguf'))).equals(b)).toBe(true);
    expect(JSON.parse(await readFile(join(dir, 'qwen3-1.7b.json'), 'utf8'))).toMatchObject({ id: 'qwen3-1.7b', size: 5000, sha256: sha(b) });
    expect((await readdir(dir)).filter((n) => n.endsWith('.part'))).toEqual([]);
    // 목록은 교실 LAN 누구나 읽는다.
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 5000, sha256: sha(b) }]);
  });

  it('::1과 ::ffff:127.0.0.1도 이 PC로 본다', async () => {
    await start();
    expect((await post('qwen3-1.7b', body(64), '::1')).statusCode).toBe(201);
    expect((await post('qwen3-4b', body(64), '::ffff:127.0.0.1')).statusCode).toBe(201);
  });

  it('같은 무선망의 다른 기기가 올리면 403이고 파일이 생기지 않는다', async () => {
    await start();
    const res = await post('qwen3-1.7b', body(100), '192.168.0.23');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'localhost_only' });
    expect(existsSync(join(dir, 'qwen3-1.7b.gguf'))).toBe(false);
    expect(await list()).toEqual([]);
  });

  it('TUTOR_MODELS에 없는 id는 404이고 폴더에 아무것도 만들지 않는다', async () => {
    await start();
    expect((await post('hcx-seed-1.5b', body(100))).statusCode).toBe(404);
    expect((await post('..%2Fevil', body(100))).statusCode).toBe(404);
    expect((await readdir(dir)).filter((n) => n !== '.')).toEqual([]);
  });

  it('앞 4바이트가 GGUF가 아니면 400이고 임시 파일을 지운다(기존 파일은 그대로)', async () => {
    await start();
    const good = body(300);
    await post('qwen3-1.7b', good);
    const res = await post('qwen3-1.7b', body(300, 'GGML'));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'not_gguf' });
    expect((await post('qwen3-1.7b', Buffer.from('GG'))).statusCode).toBe(400); // 4바이트 미만
    expect((await post('qwen3-4b', Buffer.alloc(0))).statusCode).toBe(400); // 빈 본문
    expect((await readFile(join(dir, 'qwen3-1.7b.gguf'))).equals(good)).toBe(true);
    expect((await readdir(dir)).sort()).toEqual(['qwen3-1.7b.gguf', 'qwen3-1.7b.json']);
  });

  it('크기 상한을 넘으면 413이고 임시 파일을 지운다(길이를 알릴 때도, 흘려 보낼 때도)', async () => {
    await start({ maxBytes: 1000 });
    expect((await post('qwen3-1.7b', body(1000))).statusCode).toBe(201); // 상한과 같으면 받는다
    expect((await post('qwen3-4b', body(1001))).statusCode).toBe(413);
    const streamed = await post('qwen3-4b', Readable.from([body(600), Buffer.alloc(600, 1)]));
    expect(streamed.statusCode).toBe(413);
    expect(streamed.json()).toEqual({ error: 'too_large' });
    expect((await readdir(dir)).sort()).toEqual(['qwen3-1.7b.gguf', 'qwen3-1.7b.json']);
  });

  it('content-type이 application/octet-stream이 아니면 415(text/plain 등 CORS 단순 요청)', async () => {
    await start();
    for (const ct of ['text/plain', 'application/x-gguf', 'application/octet-stream; charset=x', 'multipart/form-data']) {
      const res = await post('qwen3-1.7b', body(64), '127.0.0.1', { ...OCTET, 'content-type': ct });
      expect(res.statusCode, ct).toBe(415);
    }
    expect(existsSync(join(dir, 'qwen3-1.7b.gguf'))).toBe(false);
  });

  it('x-sci-bridge-upload 머리글이 없거나 1이 아니면 403', async () => {
    await start();
    expect((await post('qwen3-1.7b', body(64), '127.0.0.1', { 'content-type': 'application/octet-stream' })).statusCode).toBe(403);
    expect((await post('qwen3-1.7b', body(64), '127.0.0.1', { ...OCTET, 'x-sci-bridge-upload': '0' })).statusCode).toBe(403);
    expect(existsSync(join(dir, 'qwen3-1.7b.gguf'))).toBe(false);
  });

  it('Host가 이 PC 이름이 아니면 403(DNS rebinding)', async () => {
    await start();
    for (const host of ['evil.example.com', 'evil.example.com:8080', '192.168.0.2:8080', 'localhost.evil.com']) {
      expect((await post('qwen3-1.7b', body(64), '127.0.0.1', { ...OCTET, host })).statusCode, host).toBe(403);
    }
    for (const host of ['localhost:8080', '127.0.0.1:3000', '[::1]:8080', '[::1]']) {
      expect((await post('qwen3-1.7b', body(64), '127.0.0.1', { ...OCTET, host })).statusCode, host).toBe(201);
    }
  });

  it('Origin이 있으면 이 PC의 같은 호스트·포트여야 한다', async () => {
    await start();
    const o = (origin: string, host = 'localhost:8080') => post('qwen3-1.7b', body(64), '127.0.0.1', { ...OCTET, host, origin });
    expect((await o('https://evil.example.com')).statusCode).toBe(403);
    expect((await o('http://localhost:9999')).statusCode).toBe(403); // 포트 다름
    expect((await o('http://127.0.0.1:8080')).statusCode).toBe(403); // 호스트 다름
    expect((await o('null')).statusCode).toBe(403);
    expect((await o('https://localhost:8080')).statusCode).toBe(403);
    expect((await o('http://localhost:8080')).statusCode).toBe(201);
    expect((await o('http://[::1]:8080', '[::1]:8080')).statusCode).toBe(201);
    expect((await o('http://127.0.0.1:8080', '127.0.0.1:8080')).statusCode).toBe(201);
  });

  it('여러 조각으로 나뉘어 와도 sha256은 전체 파일의 것이다', async () => {
    await start();
    const b = body(10_000);
    const res = await post('qwen3-1.7b', Readable.from([b.subarray(0, 2), b.subarray(2, 3), b.subarray(3, 5000), b.subarray(5000)]));
    expect(res.statusCode).toBe(201);
    expect(res.json().sha256).toBe(sha(b));
  });

  it('다시 올리면 새 파일로 바뀌고 목록의 sha256도 바뀐다', async () => {
    await start();
    await post('qwen3-1.7b', body(100));
    const b = body(200);
    await post('qwen3-1.7b', b);
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 200, sha256: sha(b) }]);
  });
});

describe('업로드 오류 처리', () => {
  it('쓰기 오류(디스크 가득)가 나도 서버가 죽지 않고 500 JSON으로 답하며 임시 파일을 지운다', async () => {
    let n = 0;
    const store = new ModelStore({
      dir,
      ids: IDS,
      openWriteStream: () =>
        new Writable({
          write(_c, _e, cb) {
            // 첫 조각은 받고 둘째에서 ENOSPC
            if (++n >= 2) cb(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }));
            else cb();
          },
        }) as never,
    });
    const slow = (async function* () {
      yield body(10);
      await new Promise((r) => setTimeout(r, 20));
      yield Buffer.alloc(10, 1);
      await new Promise((r) => setTimeout(r, 20));
      yield Buffer.alloc(10, 2);
    })();
    const uncaught: unknown[] = [];
    const onUncaught = (e: unknown) => uncaught.push(e);
    process.on('uncaughtException', onUncaught);
    try {
      await expect(store.put('qwen3-1.7b', Readable.from(slow))).rejects.toMatchObject({ code: 'failed' });
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      process.off('uncaughtException', onUncaught);
    }
    expect(uncaught).toEqual([]);
    expect((await readdir(dir)).filter((x) => x.endsWith('.part'))).toEqual([]);
    expect(existsSync(join(dir, 'qwen3-1.7b.gguf'))).toBe(false);
  });

  it('임시 파일을 열 수 없으면(없는 폴더) 서버가 죽지 않고 failed', async () => {
    const store = new ModelStore({ dir, ids: IDS, openWriteStream: (p) => createWriteStream(join(dir, 'nope', basename(p))) });
    const uncaught: unknown[] = [];
    const onUncaught = (e: unknown) => uncaught.push(e);
    process.on('uncaughtException', onUncaught);
    try {
      await expect(store.put('qwen3-1.7b', Readable.from([body(64)]))).rejects.toMatchObject({ code: 'failed' });
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      process.off('uncaughtException', onUncaught);
    }
    expect(uncaught).toEqual([]);
  });

  it('같은 id를 동시에 올리면 하나만 받고 나머지는 409', async () => {
    await start();
    const [a, b] = await Promise.all([post('qwen3-1.7b', body(5000)), post('qwen3-1.7b', body(5000))]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect((await readdir(dir)).sort()).toEqual(['qwen3-1.7b.gguf', 'qwen3-1.7b.json']);
  });

  it('store.put을 직접 동시에 불러도 하나는 busy', async () => {
    const store = new ModelStore({ dir, ids: IDS });
    const results = await Promise.allSettled([store.put('qwen3-1.7b', Readable.from([body(100)])), store.put('qwen3-1.7b', Readable.from([body(100)]))]);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(UploadError);
    expect(rejected[0]!.reason.code).toBe('busy');
  });
});

describe('튜터 모델 파일 보관(시작할 때 훑기)', () => {
  it('.json이 없거나 크기가 다른 파일은 sha256을 다시 계산한다(모르는 이름은 무시)', async () => {
    const a = body(2048);
    const b = body(4096);
    await writeFile(join(dir, 'qwen3-1.7b.gguf'), a);
    await writeFile(join(dir, 'qwen3-4b.gguf'), b);
    await writeFile(join(dir, 'qwen3-4b.json'), JSON.stringify({ id: 'qwen3-4b', size: 1, sha256: '0'.repeat(64), addedAt: 1 }));
    await writeFile(join(dir, 'other.gguf'), body(10));
    await start();
    expect(await list()).toEqual([
      { id: 'qwen3-1.7b', size: 2048, sha256: sha(a) },
      { id: 'qwen3-4b', size: 4096, sha256: sha(b) },
    ]);
    expect(JSON.parse(await readFile(join(dir, 'qwen3-4b.json'), 'utf8'))).toMatchObject({ size: 4096, sha256: sha(b) });
    expect(JSON.parse(await readFile(join(dir, 'qwen3-1.7b.json'), 'utf8'))).toMatchObject({ size: 2048, sha256: sha(a) });
  });

  it('크기와 수정 시각이 맞는 .json이 있으면 다시 계산하지 않고 그 값을 쓴다', async () => {
    await writeFile(join(dir, 'qwen3-1.7b.gguf'), body(100));
    const { mtimeMs } = await stat(join(dir, 'qwen3-1.7b.gguf'));
    await writeFile(join(dir, 'qwen3-1.7b.json'), JSON.stringify({ id: 'qwen3-1.7b', size: 100, sha256: 'c'.repeat(64), addedAt: 5, mtimeMs }));
    await start();
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 100, sha256: 'c'.repeat(64) }]);
  });

  it('크기는 같아도 수정 시각이 다르면(손으로 바꿔 넣은 파일) sha256을 다시 계산한다', async () => {
    await start();
    const a = body(300);
    await post('qwen3-1.7b', a);
    const before = JSON.parse(await readFile(join(dir, 'qwen3-1.7b.json'), 'utf8'));
    expect(typeof before.mtimeMs).toBe('number');
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 300, sha256: sha(a) }]);
    const b = body(300, 'GGUF');
    b[100] = 9; // 같은 크기, 다른 내용
    await writeFile(join(dir, 'qwen3-1.7b.gguf'), b);
    await utimes(join(dir, 'qwen3-1.7b.gguf'), new Date(Date.now() + 60_000), new Date(Date.now() + 60_000));
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 300, sha256: sha(b) }]);
    expect(JSON.parse(await readFile(join(dir, 'qwen3-1.7b.json'), 'utf8')).sha256).toBe(sha(b));
  });

  it('mtimeMs가 없는 옛 .json은 한 번 다시 계산해 채운다', async () => {
    const a = body(100);
    await writeFile(join(dir, 'qwen3-1.7b.gguf'), a);
    await writeFile(join(dir, 'qwen3-1.7b.json'), JSON.stringify({ id: 'qwen3-1.7b', size: 100, sha256: 'c'.repeat(64), addedAt: 5 }));
    await start();
    expect(await list()).toEqual([{ id: 'qwen3-1.7b', size: 100, sha256: sha(a) }]);
    expect(typeof JSON.parse(await readFile(join(dir, 'qwen3-1.7b.json'), 'utf8')).mtimeMs).toBe('number');
  });

  it('서버가 켜진 뒤 폴더에 직접 넣은 파일도 목록에 나온다', async () => {
    await start();
    expect(await list()).toEqual([]);
    const a = body(512);
    await writeFile(join(dir, 'qwen3-4b.gguf'), a);
    expect(await list()).toEqual([{ id: 'qwen3-4b', size: 512, sha256: sha(a) }]);
  });

  it('남아 있던 임시 파일(.part)은 치운다', async () => {
    await writeFile(join(dir, '.qwen3-1.7b.abc.part'), 'GGUF');
    await start();
    await list();
    expect(await readdir(dir)).toEqual([]);
  });

  it('폴더가 없으면 만든다', async () => {
    dir = join(dir, 'nested', 'tutor-models');
    await start();
    expect(await list()).toEqual([]);
    expect(existsSync(dir)).toBe(true);
  });
});

describe('튜터 모델 파일 내려받기(Range)', () => {
  const b = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
  b.write('GGUF', 0);
  const get = (headers: Record<string, string> = {}, url = '/tutor-models/qwen3-1.7b.gguf') => srv.app.inject({ method: 'GET', url, remoteAddress: '192.168.0.50', headers });
  beforeEach(async () => {
    await writeFile(join(dir, 'qwen3-1.7b.gguf'), b);
    await start();
  });

  it('전체는 200, content-length·accept-ranges', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe('1000');
    expect(res.rawPayload.equals(b)).toBe(true);
  });
  it('Range는 206과 content-range', async () => {
    const res = await get({ range: 'bytes=100-199' });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 100-199/1000');
    expect(res.headers['content-length']).toBe('100');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.equals(b.subarray(100, 200))).toBe(true);
  });
  it('끝이 없는 구간, 끝을 넘는 구간, 마지막 n바이트', async () => {
    const open = await get({ range: 'bytes=900-' });
    expect(open.statusCode).toBe(206);
    expect(open.headers['content-range']).toBe('bytes 900-999/1000');
    expect(open.rawPayload.equals(b.subarray(900))).toBe(true);
    expect((await get({ range: 'bytes=990-5000' })).headers['content-range']).toBe('bytes 990-999/1000');
    const tail = await get({ range: 'bytes=-10' });
    expect(tail.statusCode).toBe(206);
    expect(tail.headers['content-range']).toBe('bytes 990-999/1000');
    expect(tail.rawPayload.equals(b.subarray(990))).toBe(true);
  });
  it('범위를 벗어나면 416과 content-range: bytes */크기', async () => {
    for (const range of ['bytes=1000-', 'bytes=2000-3000', 'bytes=500-100', 'bytes=-0']) {
      const res = await get({ range });
      expect(res.statusCode, range).toBe(416);
      expect(res.headers['content-range'], range).toBe('bytes */1000');
    }
  });
  it('여러 구간이거나 모르는 형식이면 무시하고 전체를 보낸다', async () => {
    expect((await get({ range: 'bytes=0-1,5-6' })).statusCode).toBe(200);
    expect((await get({ range: 'items=0-1' })).statusCode).toBe(200);
  });
  it('없는 모델과 이상한 이름은 404', async () => {
    for (const url of ['/tutor-models/qwen3-4b.gguf', '/tutor-models/hcx.gguf', '/tutor-models/qwen3-1.7b', '/tutor-models/..%2Fx.gguf']) {
      expect((await get({}, url)).statusCode, url).toBe(404);
    }
  });
});

describe('parseRange', () => {
  it('구간 계산', () => {
    expect(parseRange(undefined, 10)).toBe('ignore');
    expect(parseRange('bytes=0-0', 10)).toEqual({ start: 0, end: 0 });
    expect(parseRange('bytes=5-', 10)).toEqual({ start: 5, end: 9 });
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=-30', 10)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=-', 10)).toBe('ignore');
    expect(parseRange('bytes=a-b', 10)).toBe('ignore');
  });
});

import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isLoopback } from './hostInfo';

/** 모델 파일 하나의 최대 크기: 4 GiB. */
export const MAX_MODEL_BYTES = 4 * 1024 ** 3;

export interface ModelStoreOptions {
  /** 모델 파일(`<id>.gguf`)과 정보(`<id>.json`)를 두는 폴더. 없으면 만든다. */
  dir: string;
  /** 받을 수 있는 모델 id(TUTOR_MODELS의 id). 이 밖의 id는 받지 않는다. */
  ids: readonly string[];
  /** 파일 크기 상한(바이트). 기본 4 GiB. 시험에서 작게 줄여 쓴다. */
  maxBytes?: number;
  /** 임시 파일을 여는 함수. 시험에서 쓰기 오류를 일으키는 스트림으로 바꾼다. 기본은 fs.createWriteStream. */
  openWriteStream?: (path: string) => WriteStream;
}

/** 교사 PC에 있는 모델 파일 정보. */
export interface StoredModel {
  id: string;
  size: number;
  sha256: string;
  addedAt: number;
  /** 파일의 수정 시각(ms). 같은 크기의 파일을 손으로 바꿔 넣은 경우를 알아채는 데 쓴다. 옛 `.json`에는 없다. */
  mtimeMs?: number;
}

const GGUF_MAGIC = Buffer.from('GGUF', 'ascii');
const ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,31}$/;

/** `Range` 머리글을 읽는다. 하나의 구간만 다루고, 여러 구간이거나 모르는 형식이면 'ignore'(전체를 보낸다). */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'ignore' | 'unsatisfiable' {
  if (!header) return 'ignore';
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'ignore';
  let start: number;
  let end: number;
  if (m[1] === '') {
    // 마지막 n바이트
    const n = Number(m[2]);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

const hashFile = async (path: string): Promise<string> => {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
};

/** 폴더 안의 모델 목록을 관리한다: 시작할 때 훑어 `.json`을 맞추고, 업로드를 받아 저장한다. */
export class ModelStore {
  readonly dir: string;
  readonly maxBytes: number;
  private readonly ids: readonly string[];
  private readonly openWriteStream: (path: string) => WriteStream;
  private readonly known = new Map<string, StoredModel>();
  private readonly uploading = new Set<string>();
  private chain: Promise<void> = Promise.resolve();

  constructor(opts: ModelStoreOptions) {
    this.dir = opts.dir;
    this.ids = opts.ids;
    this.maxBytes = opts.maxBytes ?? MAX_MODEL_BYTES;
    this.openWriteStream = opts.openWriteStream ?? ((path) => createWriteStream(path));
  }

  hasId(id: string): boolean {
    return ID_PATTERN.test(id) && this.ids.includes(id);
  }

  file(id: string): string {
    return join(this.dir, `${id}.gguf`);
  }

  /** 폴더를 훑는다. `.json`이 없거나 크기가 다른 파일만 sha256을 다시 계산한다. 동시에 부르면 차례로 한다. */
  scan(): Promise<void> {
    const run = this.chain.then(() => this.scanNow());
    this.chain = run.catch(() => {});
    return run;
  }

  private async scanNow(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // 업로드가 끝나지 못하고 남은 임시 파일을 치운다(진행 중인 업로드가 없을 때만).
    if (this.uploading.size === 0) {
      for (const name of await readdir(this.dir)) if (name.endsWith('.part')) await rm(join(this.dir, name), { force: true });
    }
    for (const id of this.ids) {
      if (!ID_PATTERN.test(id)) continue;
      let size: number;
      let mtimeMs: number;
      try {
        const st = await stat(this.file(id));
        if (!st.isFile()) throw new Error('not a file');
        size = st.size;
        mtimeMs = st.mtimeMs;
      } catch {
        this.known.delete(id);
        continue;
      }
      // 크기와 수정 시각이 모두 같아야 그대로 믿는다(같은 크기로 손으로 바꿔 넣은 파일은 다시 계산한다).
      const cur = this.known.get(id);
      if (cur && cur.size === size && cur.mtimeMs === mtimeMs) continue;
      const fromJson = await this.readInfo(id);
      if (fromJson && fromJson.size === size && fromJson.mtimeMs === mtimeMs) {
        this.known.set(id, fromJson);
        continue;
      }
      if (this.uploading.has(id)) continue;
      const info: StoredModel = { id, size, sha256: await hashFile(this.file(id)), addedAt: Date.now(), mtimeMs };
      await this.writeInfo(info);
      this.known.set(id, info);
    }
  }

  private async readInfo(id: string): Promise<StoredModel | null> {
    try {
      const j = JSON.parse(await readFile(join(this.dir, `${id}.json`), 'utf8')) as Partial<StoredModel>;
      if (j.id === id && Number.isSafeInteger(j.size) && typeof j.sha256 === 'string' && /^[0-9a-f]{64}$/.test(j.sha256)) {
        const info: StoredModel = { id, size: j.size!, sha256: j.sha256, addedAt: typeof j.addedAt === 'number' ? j.addedAt : 0 };
        if (typeof j.mtimeMs === 'number') info.mtimeMs = j.mtimeMs;
        return info;
      }
    } catch {
      /* 없거나 깨짐: 다시 계산한다 */
    }
    return null;
  }

  private async writeInfo(info: StoredModel): Promise<void> {
    const tmp = join(this.dir, `.${info.id}.${randomBytes(4).toString('hex')}.json.part`);
    await writeFile(tmp, JSON.stringify(info));
    await rename(tmp, join(this.dir, `${info.id}.json`));
  }

  /** 있는 모델 목록(TUTOR_MODELS 순서). */
  async list(): Promise<StoredModel[]> {
    await this.scan();
    return this.ids.flatMap((id) => {
      const m = this.known.get(id);
      return m ? [m] : [];
    });
  }

  async get(id: string): Promise<StoredModel | null> {
    await this.scan();
    return this.known.get(id) ?? null;
  }

  /**
   * 본문 스트림을 임시 파일에 쓰면서 sha256을 계산한다. 앞 4바이트가 GGUF가 아니거나 상한을 넘으면 임시 파일을 지우고 오류를 던진다.
   * 끝나면 임시 파일을 `<id>.gguf`로 바꾸고(원자적) `<id>.json`을 쓴다.
   */
  async put(id: string, body: NodeJS.ReadableStream): Promise<StoredModel> {
    // 확인과 등록 사이에 await가 끼면 같은 id의 동시 업로드가 둘 다 통과한다: 첫 await 전에 등록한다.
    if (this.uploading.has(id)) throw new UploadError('busy');
    this.uploading.add(id);
    const tmp = join(this.dir, `.${id}.${randomBytes(6).toString('hex')}.part`);
    const hash = createHash('sha256');
    let size = 0;
    let head = Buffer.alloc(0);
    let out: WriteStream | undefined;
    try {
      await mkdir(this.dir, { recursive: true });
      const stream = this.openWriteStream(tmp);
      out = stream;
      // 쓰기 오류(디스크 가득, 권한)는 계속 듣는다. 듣는 이가 없으면 uncaughtException으로 서버가 죽는다.
      let writeError: Error | undefined;
      let wake: (() => void) | undefined;
      stream.on('error', (err) => {
        writeError ??= err;
        wake?.();
      });
      const check = () => {
        if (writeError) throw writeError;
      };
      // for await 대신 직접 읽는다: 거절할 때 요청 스트림을 destroy하면 연결이 끊겨 거절 사유(JSON)를 돌려줄 수 없다.
      const it = body[Symbol.asyncIterator]();
      for (;;) {
        check();
        const next = await Promise.race([it.next(), new Promise<never>((_, rej) => { wake = () => rej(writeError); })]);
        wake = undefined;
        check();
        if (next.done) break;
        const raw = next.value as Buffer | Uint8Array;
        const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (head.length < 4) {
          head = Buffer.concat([head, chunk.subarray(0, 4 - head.length)]);
          if (head.length >= 4 && !head.equals(GGUF_MAGIC)) throw new UploadError('not_gguf');
        }
        size += chunk.length;
        if (size > this.maxBytes) throw new UploadError('too_large');
        hash.update(chunk);
        if (!stream.write(chunk)) {
          await Promise.race([once(stream, 'drain'), new Promise<never>((_, rej) => { wake = () => rej(writeError); })]);
          wake = undefined;
        }
        check();
      }
      check();
      stream.end();
      await Promise.race([once(stream, 'finish'), new Promise<never>((_, rej) => { wake = () => rej(writeError); })]);
      wake = undefined;
      check();
      if (size === 0) throw new UploadError('empty');
      if (head.length < 4 || !head.equals(GGUF_MAGIC)) throw new UploadError('not_gguf');
      await rename(tmp, this.file(id));
      const info: StoredModel = { id, size, sha256: hash.digest('hex'), addedAt: Date.now(), mtimeMs: (await stat(this.file(id))).mtimeMs };
      await this.writeInfo(info);
      this.known.set(id, info);
      return info;
    } catch (e) {
      out?.destroy();
      await rm(tmp, { force: true });
      throw e instanceof UploadError ? e : new UploadError('failed', e);
    } finally {
      this.uploading.delete(id);
    }
  }
}

export type UploadErrorCode = 'not_gguf' | 'too_large' | 'empty' | 'busy' | 'failed';

export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    readonly cause?: unknown,
  ) {
    super(code);
  }
}

const UPLOAD_STATUS: Record<UploadErrorCode, number> = { not_gguf: 400, empty: 400, too_large: 413, busy: 409, failed: 500 };

/** 업로드 요청에 꼭 있어야 하는 머리글. 교차 출처 요청에 붙이면 사전 확인(preflight)이 필요해지고, 서버는 이를 허락하지 않는다. */
export const UPLOAD_HEADER = 'x-sci-bridge-upload';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** `Host` 값에서 포트를 뺀 호스트 이름(소문자). `[::1]:8080` → `[::1]`. */
const hostnameOf = (host: string): string => {
  const h = host.trim().toLowerCase();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end < 0 ? h : h.slice(0, end + 1);
  }
  const i = h.lastIndexOf(':');
  return i >= 0 && h.indexOf(':') === i ? h.slice(0, i) : h;
};

/** `Origin`이 `http://<Host>`와 같은 이 PC 출처인지. */
const originMatchesHost = (origin: string, host: string): boolean => {
  const m = /^http:\/\/(.+)$/i.exec(origin.trim());
  if (!m) return false;
  const o = m[1]!.toLowerCase();
  return LOCAL_HOSTNAMES.has(hostnameOf(o)) && o === host.trim().toLowerCase();
};

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'not_found' });

/**
 * 교사 PC 수업 서버의 모델 파일 경로(사양 §2.1·§2.2).
 * - `POST /tutor-models/:id`: 이 PC(localhost)에서만. 본문을 파일 그대로 스트리밍으로 받는다(메모리에 모으지 않는다).
 * - `GET /tutor-models`, `GET /tutor-models/:id.gguf`: 교실 LAN 누구나(Range 지원).
 */
export async function registerModelRoutes(app: FastifyInstance, store: ModelStore): Promise<void> {
  // 시작할 때 한 번 훑는다. 큰 파일의 sha256 계산이 서버 시작을 막지 않게 기다리지 않는다(목록·내려받기는 훑기가 끝나길 기다린다).
  void store.scan().catch((e) => app.log.warn({ err: e }, 'tutor-models scan failed'));

  await app.register(async (scope) => {
    // 이 경로 안에서만: 어떤 content-type이든 본문을 읽지 않고 스트림 그대로 넘긴다(4 GiB를 메모리에 올리지 않는다).
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_req, payload, done) => done(null, payload));

    // 같은 PC의 웹 페이지가 몰래 올리지 못하게(CSRF·DNS rebinding) 막는다. 거절은 모두 본문을 읽기 전에 한다.
    const guardUpload = (req: FastifyRequest, reply: FastifyReply): FastifyReply | null => {
      if (!isLoopback(req.ip)) return reply.code(403).send({ error: 'localhost_only' });
      const host = req.headers.host ?? '';
      if (!LOCAL_HOSTNAMES.has(hostnameOf(host))) return reply.code(403).send({ error: 'bad_host' });
      const origin = req.headers.origin;
      if (origin !== undefined && !originMatchesHost(origin, host)) return reply.code(403).send({ error: 'bad_origin' });
      if (req.headers[UPLOAD_HEADER] !== '1') return reply.code(403).send({ error: 'missing_upload_header' });
      if (req.headers['content-type'] !== 'application/octet-stream') return reply.code(415).send({ error: 'unsupported_media_type' });
      return null;
    };

    scope.post<{ Params: { id: string } }>('/tutor-models/:id', { bodyLimit: store.maxBytes + 1024 }, async (req, reply) => {
      const denied = guardUpload(req, reply);
      if (denied) return denied;
      const { id } = req.params;
      if (!store.hasId(id)) return reply.code(404).send({ error: 'unknown_model' });
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > store.maxBytes) {
        return reply.code(413).header('connection', 'close').send({ error: 'too_large' });
      }
      // 본문이 비어 있으면 fastify는 본문 해석기를 부르지 않아 스트림이 없다.
      const stream = req.body as NodeJS.ReadableStream | undefined;
      if (!stream || typeof stream.pipe !== 'function') return reply.code(400).send({ error: 'empty' });
      try {
        const info = await store.put(id, stream);
        return reply.code(201).header('cache-control', 'no-store').send(info);
      } catch (e) {
        const code: UploadErrorCode = e instanceof UploadError ? e.code : 'failed';
        if (code === 'failed') app.log.warn({ err: e }, 'tutor-models upload failed');
        // 본문을 다 읽지 않고 답하므로 연결을 닫게 한다.
        return reply.code(UPLOAD_STATUS[code]).header('connection', 'close').send({ error: code });
      }
    });

    scope.get('/tutor-models', async (_req, reply) => reply.header('cache-control', 'no-store').send((await store.list()).map(({ id, size, sha256 }) => ({ id, size, sha256 }))));

    scope.get<{ Params: { file: string } }>('/tutor-models/:file', async (req, reply) => {
      const m = /^(.+)\.gguf$/.exec(req.params.file);
      if (!m || !store.hasId(m[1]!)) return notFound(reply);
      const info = await store.get(m[1]!);
      if (!info) return notFound(reply);
      let size: number;
      try {
        size = (await stat(store.file(info.id))).size;
      } catch {
        return notFound(reply);
      }
      reply.header('accept-ranges', 'bytes').header('content-type', 'application/octet-stream').header('cache-control', 'no-cache');
      const range = parseRange(req.headers.range, size);
      if (range === 'unsatisfiable') return reply.code(416).header('content-range', `bytes */${size}`).send();
      if (range === 'ignore') {
        return reply.code(200).header('content-length', size).send(createReadStream(store.file(info.id)));
      }
      return reply
        .code(206)
        .header('content-range', `bytes ${range.start}-${range.end}/${size}`)
        .header('content-length', range.end - range.start + 1)
        .send(createReadStream(store.file(info.id), { start: range.start, end: range.end }));
    });
  });
}

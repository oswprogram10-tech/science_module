import { describe, expect, it } from 'vitest';
import { HostModelsStore, MAX_MODEL_BYTES, desiredTutorModel, formatBytes, parseHostModels, uploadErrorText, type XhrLike } from './hostModels';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe('parseHostModels', () => {
  it('알려진 모델과 올바른 모양만 남긴다', () => {
    expect(
      parseHostModels([
        { id: 'qwen3-1.7b', size: 10, sha256: A },
        { id: 'unknown', size: 10, sha256: A },
        { id: 'qwen3-4b', size: 0, sha256: A },
        { id: 'qwen3-4b', size: 5, sha256: 'xyz' },
        null,
        'x',
      ]),
    ).toEqual([{ id: 'qwen3-1.7b', size: 10, sha256: A }]);
    expect(parseHostModels({ not: 'array' })).toEqual([]);
  });
});

describe('desiredTutorModel', () => {
  const models = [{ id: 'qwen3-1.7b' as const, size: 10, sha256: A }];
  it('고른 모델의 파일이 이 PC에 있으면 그 정보를 낸다', () => {
    expect(desiredTutorModel('qwen3-1.7b', models)).toEqual({ id: 'qwen3-1.7b', size: 10, sha256: A });
  });
  it('파일이 없거나 고르지 않았으면 null(모델 없음)', () => {
    expect(desiredTutorModel('qwen3-4b', models)).toBeNull();
    expect(desiredTutorModel(null, models)).toBeNull();
    expect(desiredTutorModel('qwen3-1.7b', [])).toBeNull();
  });
  it('목록을 아직 모르면 undefined(보내지 않는다)', () => {
    expect(desiredTutorModel('qwen3-1.7b', null)).toBeUndefined();
  });
});

describe('formatBytes·uploadErrorText', () => {
  it('크기를 읽기 쉽게', () => {
    expect(formatBytes(1_200_000_000)).toBe('1.12 GB');
    expect(formatBytes(5 * 1024 ** 2)).toBe('5 MB');
    expect(formatBytes(12)).toBe('12 B');
  });
  it('실패 사유마다 다른 안내', () => {
    const texts = new Set([uploadErrorText(0), uploadErrorText(403), uploadErrorText(413), uploadErrorText(400, 'not_gguf'), uploadErrorText(409), uploadErrorText(404), uploadErrorText(500)]);
    expect(texts.size).toBe(7);
  });
});

class FakeXhr implements XhrLike {
  method = '';
  url = '';
  headers: Record<string, string> = {};
  sent: Blob | null = null;
  aborted = false;
  status = 0;
  responseText = '';
  upload: XhrLike['upload'] = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(n: string, v: string) {
    this.headers[n] = v;
  }
  send(b: Blob) {
    this.sent = b;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  finish(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }
}

const file = (n: number, name = 'model.gguf') => Object.assign(new Blob([new Uint8Array(n)]), { name });
const jsonFetch = (list: unknown): typeof fetch => (async () => new Response(JSON.stringify(list), { status: 200 })) as unknown as typeof fetch;

describe('HostModelsStore', () => {
  const setup = (list: unknown = []) => {
    const xhr = new FakeXhr();
    const store = new HostModelsStore(jsonFetch(list), () => xhr);
    return { xhr, store };
  };

  it('refresh: 목록을 읽고, 같으면 알리지 않는다', async () => {
    const { store } = setup([{ id: 'qwen3-1.7b', size: 3, sha256: A }]);
    let n = 0;
    store.subscribe(() => n++);
    expect(store.getModels()).toBeNull();
    await store.refresh();
    expect(store.getModels()).toEqual([{ id: 'qwen3-1.7b', size: 3, sha256: A }]);
    await store.refresh();
    expect(n).toBe(1);
  });

  it('refresh: 읽지 못하면 이전 값을 그대로 둔다', async () => {
    const store = new HostModelsStore((async () => new Response('', { status: 403 })) as unknown as typeof fetch, () => new FakeXhr());
    await store.refresh();
    expect(store.getModels()).toBeNull();
  });

  it('올리기: POST /tutor-models/:id, 진행률, 성공하면 sha256과 목록 갱신', async () => {
    const { xhr, store } = setup([{ id: 'qwen3-1.7b', size: 100, sha256: B }]);
    const f = file(100);
    store.startUpload('qwen3-1.7b', f);
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/tutor-models/qwen3-1.7b');
    expect(xhr.headers['content-type']).toBe('application/octet-stream');
    expect(xhr.headers['x-sci-bridge-upload']).toBe('1');
    expect(xhr.sent).toBe(f);
    expect(store.getUpload()).toMatchObject({ kind: 'uploading', loaded: 0, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
    expect(store.getUpload()).toMatchObject({ kind: 'uploading', loaded: 40, total: 100 });
    xhr.finish(201, { id: 'qwen3-1.7b', size: 100, sha256: B, addedAt: 1 });
    expect(store.getUpload()).toEqual({ kind: 'done', id: 'qwen3-1.7b', fileName: 'model.gguf', size: 100, sha256: B });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getModels()).toEqual([{ id: 'qwen3-1.7b', size: 100, sha256: B }]);
  });

  it('올리는 중에는 다른 올리기를 시작하지 않는다', () => {
    const { xhr, store } = setup();
    store.startUpload('qwen3-1.7b', file(10));
    xhr.sent = null;
    store.startUpload('qwen3-4b', file(10));
    expect(xhr.sent).toBeNull();
  });

  it('서버가 거절하면 사유를 보여 준다', () => {
    const { xhr, store } = setup();
    store.startUpload('qwen3-1.7b', file(10));
    xhr.finish(400, { error: 'not_gguf' });
    expect(store.getUpload()).toEqual({ kind: 'error', id: 'qwen3-1.7b', fileName: 'model.gguf', message: uploadErrorText(400, 'not_gguf') });
    store.clearUpload();
    expect(store.getUpload()).toBeNull();
  });

  it('네트워크 오류와 취소', () => {
    const { xhr, store } = setup();
    store.startUpload('qwen3-1.7b', file(10));
    xhr.onerror?.();
    expect(store.getUpload()).toMatchObject({ kind: 'error', message: uploadErrorText(0) });
    const second = setup();
    second.store.startUpload('qwen3-1.7b', file(10));
    second.store.cancelUpload();
    expect(second.xhr.aborted).toBe(true);
    expect(second.store.getUpload()).toBeNull();
  });

  it('빈 파일과 4 GiB를 넘는 파일은 보내지 않는다', () => {
    const { xhr, store } = setup();
    store.startUpload('qwen3-1.7b', file(0));
    expect(store.getUpload()).toMatchObject({ kind: 'error' });
    const huge = Object.assign(new Blob([]), { name: 'big.gguf' });
    Object.defineProperty(huge, 'size', { value: MAX_MODEL_BYTES + 1 });
    store.startUpload('qwen3-1.7b', huge);
    expect(store.getUpload()).toMatchObject({ kind: 'error', message: uploadErrorText(413) });
    expect(xhr.sent).toBeNull();
  });
});

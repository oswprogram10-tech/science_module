import { describe, expect, it, vi } from 'vitest';
import { ModelSync, httpBaseFromWs, type ModelSyncContext, type ModelSyncDeps } from './modelSync';
import { NO_MODEL, type TutorModelState } from './modelState';

const SHA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const model = { id: 'qwen3-1.7b', sha256: SHA, size: 1000 };
const ctx: ModelSyncContext = { baseUrl: 'http://192.168.0.10:8787', tier: 'B' };

type Progress = (e: { file: string; received: number; total: number }) => void;

function setup(opts: { available?: boolean; files?: Array<{ exists: boolean; size: number; sha256?: string }>; download?: () => Promise<{ ok: boolean; size: number }> } = {}) {
  let state: TutorModelState = NO_MODEL;
  const history: TutorModelState[] = [];
  let onProgress: Progress | null = null;
  const removeListener = vi.fn(async () => {});
  const files = [...(opts.files ?? [{ exists: false, size: 0 }])];
  const plugin = {
    fileInfo: vi.fn(async () => files.length > 1 ? files.shift()! : files[0]!),
    download: vi.fn(opts.download ?? (async () => ({ ok: true, size: 1000 }))),
    remove: vi.fn(async () => {}),
    cancelDownload: vi.fn(async () => {}),
    addListener: vi.fn(async (_ev: 'progress', fn: Progress) => {
      onProgress = fn;
      return { remove: removeListener };
    }),
  };
  const deps: ModelSyncDeps = {
    plugin: plugin as unknown as ModelSyncDeps['plugin'],
    available: () => opts.available ?? true,
    sleep: async () => {},
    state: {
      get: () => state,
      set: (s) => {
        state = s;
        history.push(s);
      },
    },
  };
  return { sync: new ModelSync(deps), plugin, history, removeListener, get state() { return state; }, progress: (e: Parameters<Progress>[0]) => onProgress?.(e) };
}

describe('httpBaseFromWs', () => {
  it('ws 주소에서 같은 서버의 http 주소를 만든다', () => {
    expect(httpBaseFromWs('ws://192.168.0.10:8787/ws')).toBe('http://192.168.0.10:8787');
    expect(httpBaseFromWs('wss://school.example/ws')).toBe('https://school.example');
    expect(httpBaseFromWs('http://x/ws')).toBeNull();
    expect(httpBaseFromWs('nonsense')).toBeNull();
  });
});

describe('ModelSync', () => {
  it('없으면 교사 PC 주소에서 받아 ready가 된다(URL·sha256·파일 이름을 플러그인에 넘긴다)', async () => {
    const t = setup({ files: [{ exists: false, size: 0 }, { exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).toHaveBeenCalledWith({ url: 'http://192.168.0.10:8787/tutor-models/qwen3-1.7b.gguf', sha256: SHA, file: 'qwen3-1.7b.gguf' });
    expect(t.history[0]).toEqual({ status: 'downloading', modelId: 'qwen3-1.7b', file: 'qwen3-1.7b.gguf', progress: 0 });
    expect(t.state).toEqual({ status: 'ready', modelId: 'qwen3-1.7b', file: 'qwen3-1.7b.gguf', progress: 1 });
    expect(t.removeListener).toHaveBeenCalled();
  });

  it('이미 같은 sha256 파일이 있으면 받지 않는다', async () => {
    const t = setup({ files: [{ exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).not.toHaveBeenCalled();
    expect(t.state.status).toBe('ready');
  });

  it('파일은 있지만 sha256이 다르면 다시 받는다', async () => {
    const t = setup({ files: [{ exists: true, size: 999, sha256: OTHER }, { exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).toHaveBeenCalledTimes(1);
    expect(t.state.status).toBe('ready');
  });

  it('진행률 이벤트를 상태에 반영한다(다른 파일의 이벤트는 무시)', async () => {
    let release!: () => void;
    const t = setup({
      files: [{ exists: false, size: 0 }, { exists: true, size: 1000, sha256: SHA }],
      download: () => new Promise((r) => (release = () => r({ ok: true, size: 1000 }))),
    });
    const run = t.sync.apply(model, ctx);
    await vi.waitFor(() => expect(t.plugin.download).toHaveBeenCalled());
    t.progress({ file: 'qwen3-1.7b.gguf', received: 250, total: 1000 });
    expect(t.state).toMatchObject({ status: 'downloading', progress: 0.25 });
    t.progress({ file: 'other.gguf', received: 900, total: 1000 });
    t.progress({ file: 'qwen3-1.7b.gguf', received: 0, total: 0 });
    expect(t.state.progress).toBe(0.25);
    t.progress({ file: 'qwen3-1.7b.gguf', received: 251, total: 1000 }); // 0.5% 미만의 변화는 알리지 않는다
    expect(t.state.progress).toBe(0.25);
    release();
    await run;
    expect(t.state.status).toBe('ready');
  });

  it('받은 뒤 sha256이 다르면 지우고 error', async () => {
    const t = setup({ files: [{ exists: false, size: 0 }, { exists: true, size: 1000, sha256: OTHER }] });
    await t.sync.apply(model, ctx);
    expect(t.plugin.remove).toHaveBeenCalledWith({ file: 'qwen3-1.7b.gguf' });
    expect(t.state).toEqual({ status: 'error', modelId: 'qwen3-1.7b', file: 'qwen3-1.7b.gguf', progress: 0 });
  });

  it('받기가 실패하거나(ok false, 예외) 확인에 실패하면 error이고 다시 알려 오면 다시 시도한다', async () => {
    const t = setup({ download: async () => ({ ok: false, size: 0 }) });
    await t.sync.apply(model, ctx);
    expect(t.state.status).toBe('error');
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).toHaveBeenCalledTimes(2);

    const boom = setup({ download: async () => { throw new Error('network'); } });
    await boom.sync.apply(model, ctx);
    expect(boom.state.status).toBe('error');
    expect(boom.removeListener).toHaveBeenCalled();

    const info = setup();
    info.plugin.fileInfo.mockRejectedValueOnce(new Error('io'));
    await info.sync.apply(model, ctx);
    expect(info.state.status).toBe('error');
  });

  it('같은 모델을 다시 알려 오면(재연결) 받는 중이거나 준비된 상태는 그대로 둔다', async () => {
    const t = setup({ files: [{ exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, ctx);
    await t.sync.apply({ ...model }, ctx);
    expect(t.plugin.fileInfo).toHaveBeenCalledTimes(1);
    // 모델 파일이 바뀌면(sha256이 다르면) 다시 확인한다.
    await t.sync.apply({ ...model, sha256: OTHER }, ctx);
    expect(t.plugin.fileInfo).toHaveBeenCalledTimes(3); // 새 모델 확인 1회 + 받은 뒤 확인 1회
    expect(t.plugin.download).toHaveBeenCalledTimes(1);
  });

  it('모델이 없다는 알림(null)이면 none', async () => {
    const t = setup({ files: [{ exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, ctx);
    expect(t.state.status).toBe('ready');
    await t.sync.apply(null, ctx);
    expect(t.state).toEqual(NO_MODEL);
  });

  it('웹(플러그인 없음)에서는 받지 않고 none', async () => {
    const t = setup({ available: false });
    await t.sync.apply(model, ctx);
    expect(t.plugin.fileInfo).not.toHaveBeenCalled();
    expect(t.plugin.download).not.toHaveBeenCalled();
    expect(t.state).toEqual(NO_MODEL);
  });

  it('기기 등급이 모델의 minTier에 못 미치면 받지 않는다(4B는 A 등급만)', async () => {
    const big = { id: 'qwen3-4b', sha256: SHA, size: 2000 };
    for (const tier of ['B', 'C'] as const) {
      const t = setup();
      await t.sync.apply(big, { ...ctx, tier });
      expect(t.plugin.download, tier).not.toHaveBeenCalled();
      expect(t.state.status).toBe('none');
    }
    const a = setup({ files: [{ exists: true, size: 2000, sha256: SHA }] });
    await a.sync.apply(big, { ...ctx, tier: 'A' });
    expect(a.state).toMatchObject({ status: 'ready', modelId: 'qwen3-4b', file: 'qwen3-4b.gguf' });
    // 1.7B는 C 등급이면 받지 않고, B 이상이면 받는다.
    const c = setup();
    await c.sync.apply(model, { ...ctx, tier: 'C' });
    expect(c.plugin.fileInfo).not.toHaveBeenCalled();
  });

  it('등급이나 서버 주소를 모르면 받지 않고, 나중에 알게 되면(update) 그때 받는다', async () => {
    const t = setup({ files: [{ exists: true, size: 1000, sha256: SHA }] });
    await t.sync.apply(model, { baseUrl: ctx.baseUrl, tier: undefined });
    expect(t.state.status).toBe('none');
    await t.sync.update(ctx);
    expect(t.state.status).toBe('ready');
    const noUrl = setup();
    await noUrl.sync.apply(model, { baseUrl: null, tier: 'B' });
    expect(noUrl.plugin.fileInfo).not.toHaveBeenCalled();
  });

  it('모르는 모델 id는 받지 않는다', async () => {
    const t = setup();
    await t.sync.apply({ ...model, id: 'hcx-seed-1.5b' }, ctx);
    expect(t.plugin.fileInfo).not.toHaveBeenCalled();
    expect(t.state.status).toBe('none');
  });

  it('reset: 수업을 나가면 none으로 돌아가고, 늦게 끝난 받기가 상태를 되살리지 않는다', async () => {
    let release!: () => void;
    const t = setup({
      files: [{ exists: false, size: 0 }, { exists: true, size: 1000, sha256: SHA }],
      download: () => new Promise((r) => (release = () => r({ ok: true, size: 1000 }))),
    });
    const run = t.sync.apply(model, ctx);
    await vi.waitFor(() => expect(t.plugin.download).toHaveBeenCalled());
    t.sync.reset();
    expect(t.state).toEqual(NO_MODEL);
    release();
    await run;
    expect(t.state).toEqual(NO_MODEL);
  });

  it('reset: 받는 중이던 파일의 네이티브 내려받기를 취소한다', async () => {
    let release!: () => void;
    const t = setup({ download: () => new Promise((r) => (release = () => r({ ok: true, size: 1000 }))) });
    const run = t.sync.apply(model, ctx);
    await vi.waitFor(() => expect(t.plugin.download).toHaveBeenCalled());
    t.sync.reset();
    expect(t.plugin.cancelDownload).toHaveBeenCalledWith({ file: 'qwen3-1.7b.gguf' });
    release();
    await run;
  });

  it('apply(null): 모델이 없다고 알려 오면 받던 것을 취소한다', async () => {
    let release!: () => void;
    const t = setup({ download: () => new Promise((r) => (release = () => r({ ok: true, size: 1000 }))) });
    const run = t.sync.apply(model, ctx);
    await vi.waitFor(() => expect(t.plugin.download).toHaveBeenCalled());
    await t.sync.apply(null, ctx);
    expect(t.plugin.cancelDownload).toHaveBeenCalledWith({ file: 'qwen3-1.7b.gguf' });
    expect(t.state).toEqual(NO_MODEL);
    release();
    await run;
    expect(t.state).toEqual(NO_MODEL);
  });

  it('새 sha256이 오면 이전 내려받기를 취소하고, 플러그인이 아직 바쁘면 물러났다 다시 불러 ready가 된다', async () => {
    const NEW = 'c'.repeat(64);
    let calls = 0;
    let rejectFirst!: (e: Error) => void;
    const t = setup({
      files: [{ exists: false, size: 0 }, { exists: false, size: 0 }, { exists: true, size: 1000, sha256: NEW }],
      download: () => {
        calls++;
        if (calls === 1) return new Promise((_, rej) => (rejectFirst = rej));
        if (calls <= 3) return Promise.reject(new Error('이미 내려받고 있어요')); // 첫 내려받기가 아직 끝나지 않았다
        return Promise.resolve({ ok: true, size: 1000 });
      },
    });
    const first = t.sync.apply(model, ctx);
    await vi.waitFor(() => expect(t.plugin.download).toHaveBeenCalledTimes(1));
    const second = t.sync.apply({ ...model, sha256: NEW }, ctx);
    expect(t.plugin.cancelDownload).toHaveBeenCalledWith({ file: 'qwen3-1.7b.gguf' });
    await second;
    expect(t.plugin.download).toHaveBeenCalledTimes(4);
    expect(t.state.status).toBe('ready');
    rejectFirst(new Error('내려받기를 멈췄어요'));
    await first;
    expect(t.state.status).toBe('ready'); // 취소된 쪽의 오류가 상태를 망치지 않는다
  });

  it('바쁘다는 거절이 계속되면 몇 번 뒤 error로 끝낸다', async () => {
    const t = setup({ download: async () => { throw new Error('이미 내려받고 있어요'); } });
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).toHaveBeenCalledTimes(6);
    expect(t.state.status).toBe('error');
  });

  it('다른 오류는 다시 부르지 않는다', async () => {
    const t = setup({ download: async () => { throw new Error('서버 응답 500'); } });
    await t.sync.apply(model, ctx);
    expect(t.plugin.download).toHaveBeenCalledTimes(1);
    expect(t.state.status).toBe('error');
  });
});

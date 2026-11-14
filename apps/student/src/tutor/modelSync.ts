import { isTutorModelId, tierAllows, tutorModel, type DeviceTier } from '@sci/tutor';
import type { TutorModelRef } from '@sci/classroom';
import { TutorLlm, isTutorLlmAvailable, type TutorLlmPlugin } from './llmPlugin';
import { NO_MODEL, tutorModelState, type TutorModelState } from './modelState';

/**
 * 교사 PC에서 튜터 모델 파일을 받아 두는 일(사양 docs/specs/tutor-on-device-v1.md §3).
 * - 수업에서 `tutorModel`을 받으면, 앱(네이티브 플러그인이 있는 안드로이드)이고 기기 등급이 모델의 minTier 이상일 때만 받는다.
 * - 이미 같은 sha256 파일이 있으면 받지 않는다. 다 받은 뒤 sha256이 다르면 지우고 error.
 * - 상태는 tutorModelState에 둔다. 서버로는 그 status 한 낱말만 간다(client.ts).
 * - 웹(브라우저)이나 모델이 없다는 알림(null)이면 status는 'none'이다.
 */

export interface ModelSyncDeps {
  plugin: Pick<TutorLlmPlugin, 'fileInfo' | 'download' | 'cancelDownload' | 'remove' | 'addListener'>;
  /** 네이티브 플러그인이 있는 앱인가. */
  available: () => boolean;
  state: { get: () => TutorModelState; set: (s: TutorModelState) => void };
  /** 기다리는 함수(시험에서 바꾼다). 기본은 setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

/** 이전 내려받기가 아직 끝나지 않아 플러그인이 "이미 내려받고 있어요"로 거절하면, 이 간격(ms)으로 기다렸다가 다시 부른다. */
const BUSY_BACKOFF_MS = [200, 400, 800, 1600, 3200];
const isBusyError = (e: unknown): boolean => String((e as { message?: unknown } | null)?.message ?? e).includes('이미 내려받고');

/** 모델을 받을 곳을 알려 주는 정보. client.ts가 수업 연결에서 채운다. */
export interface ModelSyncContext {
  /** 교사 PC 서버의 http 주소(`http://192.168.0.10:8787`). 모르면 null. */
  baseUrl: string | null;
  /** 이 기기의 등급. 아직 모르면 undefined(모를 때는 받지 않는다). */
  tier: DeviceTier | undefined;
}

/** 수업 서버의 WebSocket 주소(`ws://host:port/ws`)에서 같은 서버의 http 주소를 만든다. 못 읽으면 null. */
export function httpBaseFromWs(wsUrl: string): string | null {
  try {
    const u = new URL(wsUrl);
    if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return null;
    return `${u.protocol === 'wss:' ? 'https:' : 'http:'}//${u.host}`;
  } catch {
    return null;
  }
}

/** 진행률은 이만큼(0~1) 이상 달라질 때만 화면에 알린다(네이티브 이벤트가 잦아도 화면을 덜 그린다). */
const PROGRESS_STEP = 0.005;

export class ModelSync {
  private gen = 0;
  /** 마지막으로 받기 시작(또는 끝낸) 모델의 `id:sha256`. 같은 알림이 되풀이되는지 보는 데 쓴다. */
  private key = '';
  private model: TutorModelRef | null = null;
  private ctx: ModelSyncContext = { baseUrl: null, tier: undefined };
  /** 지금 네이티브에서 내려받는 중인 파일. 목표가 바뀌면 이 내려받기를 멈추게 한다. */
  private active: string | null = null;

  constructor(private readonly deps: ModelSyncDeps) {}

  /** 수업에서 `tutorModel`을 받았다(null이면 교사 PC에 고른 모델 파일이 없다). */
  apply(model: TutorModelRef | null, ctx: ModelSyncContext): Promise<void> {
    this.model = model;
    this.ctx = ctx;
    return this.run();
  }

  /** 서버 주소나 기기 등급이 바뀌었다(등급은 나중에 알게 될 수 있다). 마지막으로 받은 알림으로 다시 판단한다. */
  update(ctx: ModelSyncContext): Promise<void> {
    if (ctx.baseUrl === this.ctx.baseUrl && ctx.tier === this.ctx.tier) return Promise.resolve();
    this.ctx = ctx;
    return this.model ? this.run() : Promise.resolve();
  }

  /** 수업을 나갔다. 알림을 잊고 상태를 'none'으로 돌린다(이미 받은 파일은 지우지 않는다). */
  reset(): void {
    this.gen++;
    this.cancelActive();
    this.key = '';
    this.model = null;
    this.deps.state.set(NO_MODEL);
  }

  /** 진행 중인 네이티브 내려받기를 멈추게 한다(받아 둔 조각은 남는다). 이미 끝났으면 플러그인이 무시한다. */
  private cancelActive(): void {
    const file = this.active;
    if (!file) return;
    this.active = null;
    void Promise.resolve(this.deps.plugin.cancelDownload({ file })).catch(() => {});
  }

  /** 다른 내려받기가 끝나길 기다리며(취소 중) 몇 번 다시 부른다. 낡은 요청이면 멈춘다. */
  private async downloadWithRetry(opts: Parameters<ModelSyncDeps['plugin']['download']>[0], stale: () => boolean) {
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    for (let i = 0; ; i++) {
      try {
        return await this.deps.plugin.download(opts);
      } catch (e) {
        if (!isBusyError(e) || i >= BUSY_BACKOFF_MS.length || stale()) throw e;
        await sleep(BUSY_BACKOFF_MS[i]!);
        if (stale()) throw e;
      }
    }
  }

  private async run(): Promise<void> {
    const { state, plugin } = this.deps;
    const model = this.model;
    const info = model && isTutorModelId(model.id) ? tutorModel(model.id) : null;
    if (!model || !info || !this.deps.available() || !this.ctx.tier || !tierAllows(this.ctx.tier, info) || !this.ctx.baseUrl) {
      this.gen++;
      this.cancelActive();
      this.key = '';
      state.set(NO_MODEL);
      return;
    }
    const cur = state.get();
    const file = `${model.id}.gguf`;
    const same = this.key === `${model.id}:${model.sha256}`;
    // 같은 모델을 다시 알려 오면(재연결 등) 받는 중이거나 준비됐을 때는 그대로 둔다. 오류였으면 다시 시도한다.
    if (same && (cur.status === 'downloading' || cur.status === 'ready')) return;
    this.key = `${model.id}:${model.sha256}`;
    this.cancelActive(); // 다른 모델·새 sha256으로 바뀌었다: 이전 내려받기는 멈춘다.
    const g = ++this.gen;
    const stale = () => g !== this.gen;
    const setState = (s: TutorModelState) => {
      if (!stale()) state.set(s);
    };

    let handle: { remove: () => Promise<void> } | null = null;
    try {
      const have = await plugin.fileInfo({ file });
      if (stale()) return;
      if (have.exists && have.sha256 === model.sha256) {
        setState({ status: 'ready', modelId: info.id, file, progress: 1 });
        return;
      }
      setState({ status: 'downloading', modelId: info.id, file, progress: 0 });
      let last = 0;
      handle = await plugin.addListener('progress', (e) => {
        if (e.file !== file || e.total <= 0) return;
        const p = Math.min(1, Math.max(0, e.received / e.total));
        if (p - last >= PROGRESS_STEP) {
          last = p;
          setState({ status: 'downloading', modelId: info.id, file, progress: p });
        }
      });
      this.active = file;
      const done = await this.downloadWithRetry({ url: `${this.ctx.baseUrl}/tutor-models/${model.id}.gguf`, sha256: model.sha256, file }, stale);
      if (!stale()) this.active = null;
      if (stale()) return;
      if (!done.ok) throw new Error('download failed');
      // 플러그인이 확인하지만 한 번 더 본다: 다르면 지운다.
      const after = await plugin.fileInfo({ file });
      if (stale()) return;
      if (!after.exists || after.sha256 !== model.sha256) {
        await plugin.remove({ file }).catch(() => {});
        throw new Error('sha256 mismatch');
      }
      setState({ status: 'ready', modelId: info.id, file, progress: 1 });
    } catch {
      if (!stale()) {
        this.key = '';
        this.active = null;
      }
      setState({ status: 'error', modelId: info.id, file, progress: 0 });
    } finally {
      void handle?.remove().catch(() => {});
    }
  }
}

export const modelSync = new ModelSync({ plugin: TutorLlm, available: isTutorLlmAvailable, state: tutorModelState });

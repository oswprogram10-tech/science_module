import { isTutorModelId, type TutorModelId } from '@sci/tutor';
import type { TutorModelRef } from '@sci/classroom';

/** 수업 서버(교사 PC)가 가지고 있는 튜터 모델 파일 정보(`GET /tutor-models`). */
export interface HostModel {
  id: TutorModelId;
  size: number;
  sha256: string;
}

/** 서버가 받는 파일 크기 상한(4 GiB). 보내기 전에 화면에서도 거른다. */
export const MAX_MODEL_BYTES = 4 * 1024 ** 3;

/** 서버 응답을 검사해 읽는다. 모르는 모델이나 모양이 틀린 항목은 버린다. */
export function parseHostModels(raw: unknown): HostModel[] {
  if (!Array.isArray(raw)) return [];
  const out: HostModel[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { id, size, sha256 } = r as { id?: unknown; size?: unknown; sha256?: unknown };
    if (isTutorModelId(id) && typeof size === 'number' && Number.isSafeInteger(size) && size > 0 && typeof sha256 === 'string' && /^[0-9a-f]{64}$/.test(sha256)) {
      out.push({ id, size, sha256 });
    }
  }
  return out;
}

/**
 * 수업에 알릴 모델: 고른 모델의 파일이 이 PC에 있으면 그 정보, 없으면(또는 모델을 고르지 않았으면) null("모델 없음"으로 알린다).
 * 이 PC의 목록을 아직 모르면(models === null) undefined: 아무것도 보내지 않는다.
 */
export function desiredTutorModel(choice: TutorModelId | null, models: readonly HostModel[] | null): TutorModelRef | null | undefined {
  if (models === null) return undefined;
  const m = choice ? models.find((x) => x.id === choice) : undefined;
  return m ? { id: m.id, sha256: m.sha256, size: m.size } : null;
}

export async function fetchHostModels(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<HostModel[] | null> {
  try {
    const r = await fetchFn('/tutor-models', { cache: 'no-store' });
    if (!r.ok) return null;
    return parseHostModels(await r.json());
  } catch {
    return null;
  }
}

/** 올리기 실패 사유를 교사에게 보일 글로. */
export function uploadErrorText(status: number, code?: string): string {
  if (status === 0) return '파일을 보내지 못했어요. 수업 서버가 켜져 있는지 확인하고 다시 해 보세요.';
  if (status === 403) return '모델 파일은 수업 서버가 켜진 PC에서 연 교사 화면에서만 넣을 수 있어요.';
  if (status === 413 || code === 'too_large') return '파일이 너무 커요. 4 GB 이하의 모델 파일만 넣을 수 있어요.';
  if (code === 'not_gguf' || code === 'empty') return '모델 파일(GGUF)이 아니에요. Kaggle 결과의 .gguf 파일을 골라 주세요.';
  if (status === 409) return '같은 모델을 이미 넣는 중이에요. 끝난 뒤에 다시 해 보세요.';
  if (status === 404) return '이 모델은 넣을 수 없어요.';
  return '모델 파일을 넣지 못했어요. 다시 해 보세요.';
}

/** 사람이 읽는 크기(GB는 소수 둘째 자리, MB는 정수). */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** 올리기 진행 상태. 화면을 닫았다 열어도 이어서 보이도록 저장소에 둔다. */
export type UploadState =
  | { kind: 'uploading'; id: TutorModelId; fileName: string; loaded: number; total: number }
  | { kind: 'done'; id: TutorModelId; fileName: string; size: number; sha256: string }
  | { kind: 'error'; id: TutorModelId; fileName: string; message: string };

/** `XMLHttpRequest`의 쓰는 부분. 시험에서 가짜로 바꾼다. */
export interface XhrLike {
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  send(body: Blob): void;
  abort(): void;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  responseText: string;
}

export class HostModelsStore {
  private models: HostModel[] | null = null;
  private upload: UploadState | null = null;
  private listeners = new Set<() => void>();
  private xhr: XhrLike | null = null;

  constructor(
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
    private readonly makeXhr: () => XhrLike = () => new XMLHttpRequest() as unknown as XhrLike,
  ) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  /** 이 PC에 있는 모델 목록. 아직 읽지 못했으면 null. */
  getModels = () => this.models;
  getUpload = () => this.upload;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** 목록을 다시 읽는다. 읽지 못하면 이전 값을 그대로 둔다. */
  async refresh(): Promise<void> {
    const next = await fetchHostModels(this.fetchFn);
    if (next === null) return;
    const same = this.models !== null && this.models.length === next.length && this.models.every((m, i) => m.id === next[i]!.id && m.sha256 === next[i]!.sha256 && m.size === next[i]!.size);
    if (same) return;
    this.models = next;
    this.emit();
  }

  /** 모델 파일을 이 PC의 수업 서버로 올린다(진행률을 알린다). 이미 올리는 중이면 무시한다. */
  startUpload(id: TutorModelId, file: Blob & { name?: string }): void {
    if (this.upload?.kind === 'uploading') return;
    const fileName = file.name ?? `${id}.gguf`;
    if (file.size > MAX_MODEL_BYTES) {
      this.upload = { kind: 'error', id, fileName, message: uploadErrorText(413) };
      this.emit();
      return;
    }
    if (file.size === 0) {
      this.upload = { kind: 'error', id, fileName, message: uploadErrorText(400, 'empty') };
      this.emit();
      return;
    }
    const xhr = this.makeXhr();
    this.xhr = xhr;
    const fail = (message: string) => {
      this.xhr = null;
      this.upload = { kind: 'error', id, fileName, message };
      this.emit();
    };
    xhr.open('POST', `/tutor-models/${encodeURIComponent(id)}`);
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    // 서버가 요구하는 머리글: 다른 웹 페이지가 몰래 올리지 못하게 한다(사전 확인이 필요해진다).
    xhr.setRequestHeader('x-sci-bridge-upload', '1');
    xhr.upload.onprogress = (e) => {
      if (this.xhr !== xhr) return;
      this.upload = { kind: 'uploading', id, fileName, loaded: e.loaded, total: e.lengthComputable ? e.total : file.size };
      this.emit();
    };
    xhr.onload = () => {
      if (this.xhr !== xhr) return;
      let body: { error?: unknown; size?: unknown; sha256?: unknown } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        /* 본문이 JSON이 아니면 상태 번호로만 판단한다 */
      }
      if (xhr.status === 201 && typeof body.sha256 === 'string' && typeof body.size === 'number') {
        this.xhr = null;
        this.upload = { kind: 'done', id, fileName, size: body.size, sha256: body.sha256 };
        this.emit();
        void this.refresh();
      } else {
        fail(uploadErrorText(xhr.status, typeof body.error === 'string' ? body.error : undefined));
      }
    };
    xhr.onerror = () => {
      if (this.xhr === xhr) fail(uploadErrorText(0));
    };
    xhr.onabort = () => {
      if (this.xhr !== xhr) return;
      this.xhr = null;
      this.upload = null;
      this.emit();
    };
    this.upload = { kind: 'uploading', id, fileName, loaded: 0, total: file.size };
    this.emit();
    xhr.send(file);
  }

  cancelUpload(): void {
    this.xhr?.abort();
  }

  /** 끝났거나 실패한 올리기 안내를 지운다. */
  clearUpload(): void {
    if (this.upload?.kind === 'uploading') return;
    this.upload = null;
    this.emit();
  }
}

let shared: HostModelsStore | null = null;
export const hostModelsStore = (): HostModelsStore => (shared ??= new HostModelsStore());

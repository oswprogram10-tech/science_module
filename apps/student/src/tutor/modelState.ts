import { useSyncExternalStore } from 'react';
import type { TutorModelId } from '@sci/tutor';

/**
 * 이 기기의 튜터 모델 준비 상태(사양 docs/specs/tutor-on-device-v1.md §3·§4.4).
 * - 내려받기(modelSync, 3b)가 상태를 바꾸고, 튜터 실행(modelTutor, 3c)이 읽는다.
 * - 기기 안에서만 쓴다. 수업 서버로는 status의 `model` 한 낱말('none'|'downloading'|'ready'|'error')만 보낸다.
 */
export type TutorModelStatus = 'none' | 'downloading' | 'ready' | 'error';

export interface TutorModelState {
  status: TutorModelStatus;
  /** 교사가 고른 모델(수업에서 받은 tutorModel). 없으면 null. */
  modelId: TutorModelId | null;
  /** 앱 전용 저장소의 파일 이름(`<id>.gguf`). ready일 때만 쓸 수 있다. */
  file: string | null;
  /** 내려받기 진행률 0~1(downloading일 때). */
  progress: number;
}

export const NO_MODEL: TutorModelState = { status: 'none', modelId: null, file: null, progress: 0 };

let state: TutorModelState = NO_MODEL;
const listeners = new Set<() => void>();

export const tutorModelState = {
  get: (): TutorModelState => state,
  set(next: TutorModelState): void {
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export const useTutorModelState = (): TutorModelState => useSyncExternalStore(tutorModelState.subscribe, tutorModelState.get);

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * 기기 안 튜터 모델(llama.cpp) 네이티브 플러그인 인터페이스(사양 docs/specs/tutor-on-device-v1.md §4.1).
 * 안드로이드 구현은 android/app/src/main/java/.../TutorLlmPlugin.java. 웹(브라우저)에는 구현이 없다(isTutorLlmAvailable가 false).
 * 학생 말·튜터 입력·출력은 이 플러그인 안(기기)에서만 쓰이고 어디로도 보내지 않는다.
 */
export interface TutorLlmPlugin {
  /** 교사 PC 수업 서버에서 모델 파일을 앱 전용 저장소로 받는다. 이어 받기(Range)를 지원하고, 다 받은 뒤 sha256을 확인한다. */
  download(opts: { url: string; sha256: string; file: string }): Promise<{ ok: boolean; size: number }>;
  fileInfo(opts: { file: string }): Promise<{ exists: boolean; size: number; sha256?: string }>;
  remove(opts: { file: string }): Promise<void>;
  load(opts: { file: string; nCtx: number; nThreads: number }): Promise<{ ok: boolean; loadMs: number }>;
  /** prompt는 대화 형식까지 입힌 완성 문자열. 탐욕 샘플링, suppressTokenIds는 생성 금지. */
  generate(opts: { prompt: string; maxTokens: number; stop: string[]; suppressTokenIds: number[] }): Promise<{
    text: string;
    firstTokenMs: number;
    tokensPerSec: number;
    tokens: number;
  }>;
  unload(): Promise<void>;
  addListener(event: 'progress', fn: (e: { file: string; received: number; total: number }) => void): Promise<PluginListenerHandle>;
}

export const TutorLlm = registerPlugin<TutorLlmPlugin>('TutorLlm');

/** 네이티브 플러그인이 있는 앱(안드로이드)에서만 true. */
export const isTutorLlmAvailable = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TutorLlm');

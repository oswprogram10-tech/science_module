import type { SafetyEventType } from '@sci/vision';

/** 단원과 무관한 기본 안전 경고 문구. 단원은 매니페스트 safetyMessages로 덮어쓴다. 같은 문장을 음성으로도 읽는다. */
export const DEFAULT_SAFETY_MESSAGES: Record<SafetyEventType, string> = {
  NO_GOGGLES: '실험을 계속하기 전에 보안경을 먼저 착용해 주세요!',
  NO_GLOVES: '실험 재료를 만지기 전에 실험용 장갑을 먼저 껴 주세요!',
  SPILL: '실험 재료가 쏟아졌어요! 손대지 말고 바로 선생님께 알려 주세요.',
  FOOD: '실험 중에는 음식을 먹거나 실험 재료를 맛보면 안 돼요!',
};

/** 산과 염기(용액 실험) 전용 문구. */
export const SAFETY_MESSAGES: Record<SafetyEventType, string> = {
  NO_GOGGLES: '산성 용액 실험 전 보안경을 먼저 착용해 주세요!',
  NO_GLOVES: '용액을 만지기 전에 실험용 장갑을 먼저 껴 주세요!',
  SPILL: '용액이 쏟아졌어요! 손대지 말고 바로 선생님께 알려 주세요.',
  FOOD: '실험 중에는 음식을 먹거나 용액을 맛보면 안 돼요!',
};

/** 단원 매니페스트가 바꾼 문구를 기본 문구 위에 덮어쓴다. */
export function resolveSafetyMessages(
  overrides?: Partial<Record<SafetyEventType, string>>,
): Record<SafetyEventType, string> {
  return { ...DEFAULT_SAFETY_MESSAGES, ...overrides };
}

export const MOCK_TYPES: SafetyEventType[] = ['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD'];

export const MOCK_LABELS: Record<SafetyEventType, string> = {
  NO_GOGGLES: '보안경 안 씀',
  NO_GLOVES: '장갑 안 낌',
  SPILL: '재료 쏟음',
  FOOD: '음식 먹음',
};

export const HAZARD_NOTICE = '⚠ 이 용액은 피부나 눈에 닿으면 위험해요. 보안경과 장갑을 꼭 착용해요.';

/** 같은 문장을 ko-KR로 읽는다. 지원하지 않거나 실패해도 화면은 계속 동작한다. */
export function speak(text: string): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* 음성은 보조 수단이다. */
  }
}

export type SafetyEventType = 'NO_GOGGLES' | 'NO_GLOVES' | 'SPILL' | 'FOOD';

export interface SafetyEvent {
  type: SafetyEventType;
  confidence: number;
  ts: number;
}

/** 안전 감지기. 실제 감지 모델은 이 인터페이스를 구현해 끼운다. */
export interface SafetyDetector {
  start(onEvent: (e: SafetyEvent) => void): void;
  stop(): void;
}

/** 시험용 감지기. trigger를 부르면 시작된 동안에만 이벤트를 낸다. */
export class MockSafetyDetector implements SafetyDetector {
  private listener: ((e: SafetyEvent) => void) | null = null;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  start(onEvent: (e: SafetyEvent) => void): void {
    this.listener = onEvent;
  }

  stop(): void {
    this.listener = null;
  }

  trigger(type: SafetyEventType, confidence = 1): void {
    this.listener?.({ type, confidence, ts: this.clock() });
  }
}

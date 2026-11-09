import type { FeedbackKind } from './observeStore';

export const FEEDBACK_IDLE = '관찰한 것을 기록하면 여기에 알려 줄게요.';
export const FEEDBACK_MISMATCH = '관찰 화면을 다시 살펴볼까요?';
export const FEEDBACK_MATCH = '관찰한 내용을 잘 기록했어요.';

export const feedbackText = (kind: FeedbackKind): string =>
  kind === 'match' ? FEEDBACK_MATCH : kind === 'mismatch' ? FEEDBACK_MISMATCH : FEEDBACK_IDLE;

import type { CheckResult } from '@sci/engine-matter';
import { josa } from '@sci/gateway';
import type { ClassificationExperiment } from '@sci/schema';

export const FEEDBACK_IDLE = '분류를 마치고 확인하기를 누르면 여기에 알려 줄게요.';
export const TUTOR_NO_SELECTION = '시험해 볼 용액을 먼저 골라 볼까요?';

const list = (labels: string[]) => labels.join(', ');

/** 확인 결과에 대한 피드백 문장. 판정 문구나 정답 무리는 말하지 않는다. */
export function classifyFeedback(exp: ClassificationExperiment, checked: CheckResult | null): string {
  if (!checked) return FEEDBACK_IDLE;
  const labelOf = (key: string) => exp.solutions.find((s) => s.key === key)?.label ?? key;
  const pick = (...statuses: string[]) =>
    checked.items.filter((i) => statuses.includes(i.status)).map((i) => labelOf(i.solution));
  const withTopic = (labels: string[]) => {
    const text = list(labels);
    return `${text}${josa(text, '은/는')}`;
  };
  if (checked.kind === 'check-inconsistent') {
    return `${withTopic(pick('inconsistent'))} 관찰한 지시약 색 변화와 넣은 무리를 다시 비교해 볼까요?`;
  }
  if (checked.kind === 'check-untested') {
    const names = pick('untested', 'undetermined');
    if (names.length > 0) return `${withTopic(names)} 아직 분류할 단서가 부족해요. 다른 지시약으로도 시험해 볼까요?`;
    return '아직 분류하지 않은 용액이 있어요. 모든 용액을 무리에 넣어 볼까요?';
  }
  return '관찰한 지시약 색 변화와 분류가 서로 잘 맞아요.';
}

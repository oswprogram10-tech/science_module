import type { SortCheck } from '@sci/cardsort';
import { josa } from '@sci/gateway';
import type { CardSortExperiment } from '@sci/schema';

export const FEEDBACK_IDLE = '분류를 마치고 확인하기를 누르면 여기에 알려 줄게요.';

const list = (labels: string[]) => labels.join(', ');

/** 확인 결과에 대한 피드백 문장. 판정 문구나 정답 무리는 말하지 않는다. */
export function cardSortFeedback(
  exp: CardSortExperiment,
  checked: SortCheck | null,
  /** 트리에서 확인한 노드가 한쪽이 빈 채로 끝났을 때 true. */
  emptySplit = false,
): string {
  if (!checked) return FEEDBACK_IDLE;
  const pick = (status: string) =>
    checked.items.filter((i) => i.status === status).map((i) => exp.cards.find((c) => c.key === i.card)?.label ?? i.card);
  const withTopic = (labels: string[]) => {
    const text = list(labels);
    return `${text}${josa(text, '은/는')}`;
  };
  switch (checked.kind) {
    case 'check-subjective':
      return '이 기준은 사람마다 다르게 나눌 수 있어요. 누가 나누어도 같은 결과가 나오는 기준을 골라 볼까요?';
    case 'check-unplaced':
      return '아직 무리에 넣지 않은 카드가 있어요. 모든 카드를 넣어 볼까요?';
    case 'check-unobserved':
      return `${withTopic(pick('unobserved'))} 아직 이 기준의 특징을 살펴보지 않았어요.`;
    case 'check-inconsistent':
      return `${withTopic(pick('inconsistent'))} 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?`;
    default:
      return emptySplit ? '모든 잎이 한쪽으로 모였어요.' : '관찰한 특징과 분류가 서로 잘 맞아요.';
  }
}

export const ORDER_FEEDBACK_IDLE = '표본을 칸에 놓고 확인하기를 누르면 여기에 알려 줄게요.';
export const FOLLOW_UP_FEEDBACK_IDLE = '무리에 넣고 확인하기를 누르면 여기에 알려 줄게요.';

/**
 * 순서 놓기의 순서 확인 피드백. 정답 칸 번호나 높이 값은 말하지 않는다.
 * 튜터 상자의 질문과 같은 문장이 되지 않도록 표현을 달리한다.
 */
export function orderFeedback(exp: CardSortExperiment, checked: SortCheck | null): string {
  if (!checked) return ORDER_FEEDBACK_IDLE;
  const pick = (status: string) =>
    checked.items.filter((i) => i.status === status).map((i) => exp.cards.find((c) => c.key === i.card)?.label ?? i.card);
  const withTopic = (labels: string[]) => {
    const text = list(labels);
    return `${text}${josa(text, '은/는')}`;
  };
  switch (checked.kind) {
    case 'check-unplaced':
      return '모든 표본을 칸에 놓으면 쌓인 차례를 확인할 수 있어요.';
    case 'check-unobserved':
      return `높이를 살펴보지 않은 표본이 있어요: ${list(pick('unobserved'))}`;
    case 'check-inconsistent':
      return `${withTopic(pick('inconsistent'))} 이웃한 칸의 표본과 채집한 높이를 견주어 보면 차례가 맞지 않아요.`;
    default:
      return '채집한 높이와 쌓인 차례가 서로 잘 맞아요.';
  }
}

/** 순서 놓기의 followUp(무리 나누기) 확인 피드백. 알맞은 무리는 말하지 않는다. */
export function followUpFeedback(exp: CardSortExperiment, checked: SortCheck | null): string {
  if (!checked) return FOLLOW_UP_FEEDBACK_IDLE;
  const pick = (status: string) =>
    checked.items.filter((i) => i.status === status).map((i) => exp.cards.find((c) => c.key === i.card)?.label ?? i.card);
  const withTopic = (labels: string[]) => {
    const text = list(labels);
    return `${text}${josa(text, '은/는')}`;
  };
  switch (checked.kind) {
    case 'check-unplaced':
      return `아직 무리에 넣지 않은 표본: ${list(pick('unplaced'))}`;
    case 'check-unobserved':
      return `${withTopic(pick('unobserved'))} 화석을 아직 살펴보지 않았어요.`;
    case 'check-inconsistent':
      return `${withTopic(pick('inconsistent'))} 화석에서 관찰한 내용과 넣은 무리가 서로 맞는지 다시 살펴볼까요?`;
    default:
      return '화석에서 관찰한 내용과 넣은 무리가 서로 잘 맞아요.';
  }
}

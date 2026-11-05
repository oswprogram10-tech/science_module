import type { Activity, GroupView, Phase, SafetyType } from './protocol';

export const PHASE_LABEL: Record<Phase, string> = {
  designing: '실험 설계 중',
  running: '실험 중',
  reviewing: '결과 보는 중',
  idle: '단원 고르는 중',
};

export const SAFETY_LABEL: Record<SafetyType, string> = {
  NO_GOGGLES: '보안경 안 씀',
  NO_GLOVES: '장갑 안 낌',
  SPILL: '재료 쏟음',
  FOOD: '음식 먹음',
};

const KIND_TEXT: Record<Activity, Record<string, string>> = {
  variable: {
    'first-trial': '첫 실험을 마침',
    repeat: '같은 조건으로 다시 실험함',
    'fair-test': '한 가지만 바꿔 실험함',
    confounded: '두 조건을 함께 바꿈',
    'iv-unchanged': '바꿀 조건을 바꾸지 않음',
  },
  classify: {
    'before-test': '용액을 골랐고 시험 전',
    testing: '지시약으로 시험 중',
    'check-inconsistent': '분류가 시험 결과와 다름',
    'check-untested': '시험하지 않은 용액이 있음',
    'check-complete': '분류를 모두 맞게 함',
    'prediction-mismatch': '예측과 다른 결과',
  },
  observe: {
    'before-observe': '예측하기 전',
    observing: '관찰하는 중',
    'record-mismatch': '기록이 관찰과 다름',
    'record-match': '관찰을 잘 기록함',
    'prediction-mismatch': '예측과 다른 결과',
  },
  // 진로 활동은 어느 단계를 보고 있는지만 알린다. 글·고른 직업은 보내지 않는다.
  portfolio: {
    'stage-1': '내 탐구 기록을 보는 중',
    'stage-2': '관심 영역을 고르는 중',
    'stage-3': '직업 카드를 살펴보는 중',
    'stage-4': '진로 탐색 카드를 쓰는 중',
  },
  'card-sort': {
    'choose-criterion': '분류 기준을 고르기 전',
    'pick-card': '카드를 고르는 중',
    'before-observe': '특징을 살펴보기 전',
    sorting: '카드를 나누는 중',
    'check-subjective': '사람마다 다르게 나눌 수 있는 기준으로 확인함',
    'check-unplaced': '무리에 넣지 않은 카드가 있음',
    'check-unobserved': '살펴보지 않은 카드가 있음',
    'check-inconsistent': '분류가 관찰과 다름',
    'check-complete': '기준 하나를 관찰에 맞게 나눔',
    finished: '두 가지 기준으로 분류함',
    'tree-split-empty': '나누었더니 한쪽으로 모두 모임',
    'tree-next-node': '한 무리를 나누고 다음 무리를 고르는 중',
    'tree-finished': '더 나눌 수 없을 때까지 나눔',
    'order-check-unplaced': '칸에 놓지 않은 표본이 있음',
    'order-check-unobserved': '높이를 확인하지 않은 표본이 있음',
    'order-check-inconsistent': '쌓인 차례가 채집 높이와 다름',
    'order-check-complete': '쌓인 차례를 맞게 놓음',
    'order-finished': '쌓인 차례와 그때의 환경을 모두 알아냄',
  },
};

/** 최근 상황을 사람이 읽는 한 문장으로 바꾼다. 알 수 없으면 null. */
export function describeSituation(g: Pick<GroupView, 'activity' | 'lastKind' | 'mismatch'>): string | null {
  if (g.mismatch) return '예측과 다른 결과';
  if (!g.activity || !g.lastKind) return null;
  return KIND_TEXT[g.activity][g.lastKind] ?? null;
}

/** "n분 전" 같은 말. 1분 미만은 "방금". */
export function agoText(lastSeen: number, now: number): string {
  const min = Math.floor(Math.max(0, now - lastSeen) / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

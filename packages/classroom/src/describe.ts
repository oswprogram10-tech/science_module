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

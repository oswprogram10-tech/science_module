import { describe, expect, it } from 'vitest';
import { agoText, describeSituation } from './describe';

describe('describeSituation', () => {
  it('변인 실험 분석 종류를 문장으로', () => {
    expect(describeSituation({ activity: 'variable', lastKind: 'confounded', mismatch: false })).toBe('두 조건을 함께 바꿈');
    expect(describeSituation({ activity: 'variable', lastKind: 'fair-test', mismatch: false })).toBe('한 가지만 바꿔 실험함');
  });
  it('예측과 다르면 그 문장이 먼저', () => {
    expect(describeSituation({ activity: 'variable', lastKind: 'fair-test', mismatch: true })).toBe('예측과 다른 결과');
  });
  it('분류·관찰 상황 키', () => {
    expect(describeSituation({ activity: 'classify', lastKind: 'testing', mismatch: false })).toBe('지시약으로 시험 중');
    expect(describeSituation({ activity: 'observe', lastKind: 'record-match', mismatch: false })).toBe('관찰을 잘 기록함');
  });
  it('카드 분류 트리 상황 키', () => {
    expect(describeSituation({ activity: 'card-sort', lastKind: 'tree-split-empty', mismatch: false })).toBe('나누었더니 한쪽으로 모두 모임');
    expect(describeSituation({ activity: 'card-sort', lastKind: 'tree-next-node', mismatch: false })).toBe('한 무리를 나누고 다음 무리를 고르는 중');
    expect(describeSituation({ activity: 'card-sort', lastKind: 'tree-finished', mismatch: false })).toBe('더 나눌 수 없을 때까지 나눔');
    expect(describeSituation({ activity: 'card-sort', lastKind: 'finished', mismatch: false })).toBe('두 가지 기준으로 분류함');
  });
  it('카드 분류 순서 놓기 상황 키', () => {
    const d = (lastKind: string) => describeSituation({ activity: 'card-sort', lastKind, mismatch: false });
    expect(d('order-check-unplaced')).toBe('칸에 놓지 않은 표본이 있음');
    expect(d('order-check-unobserved')).toBe('높이를 확인하지 않은 표본이 있음');
    expect(d('order-check-inconsistent')).toBe('쌓인 차례가 채집 높이와 다름');
    expect(d('order-check-complete')).toBe('쌓인 차례를 맞게 놓음');
    expect(d('order-finished')).toBe('쌓인 차례와 그때의 환경을 모두 알아냄');
  });
  it('진로 활동은 단계만 말한다', () => {
    const d = (lastKind: string) => describeSituation({ activity: 'portfolio', lastKind, mismatch: false });
    expect(d('stage-1')).toBe('내 탐구 기록을 보는 중');
    expect(d('stage-4')).toBe('진로 탐색 카드를 쓰는 중');
    expect(d('stage-9')).toBeNull();
  });
  it('모르는 키나 없는 값은 null', () => {
    expect(describeSituation({ activity: 'classify', lastKind: 'zzz', mismatch: false })).toBeNull();
    expect(describeSituation({ mismatch: false })).toBeNull();
  });
});

describe('agoText', () => {
  it('분 단위로', () => {
    expect(agoText(0, 30_000)).toBe('방금');
    expect(agoText(0, 3 * 60_000 + 1)).toBe('3분 전');
    expect(agoText(0, 125 * 60_000)).toBe('2시간 전');
  });
});

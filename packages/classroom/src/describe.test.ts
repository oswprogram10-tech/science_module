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

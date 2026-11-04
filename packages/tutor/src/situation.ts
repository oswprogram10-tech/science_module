import { evidenceGroup, type CheckKind } from '@sci/engine-matter';
import type { CardSortExperiment, CardSortProbeWhen, ClassificationExperiment, ClassifyProbeWhen, ObservationProbeWhen } from '@sci/schema';

/**
 * 분류 활동의 튜터 상황 키. 앱(ClassifyLab)과 튜터 데이터 도구가 같은 규칙을 쓰도록 여기에 둔다.
 * 위에서부터 첫 규칙을 적용한다: 확인 결과 → 시험 전 → 예측과 관찰 불일치 → 시험 중.
 */
export function classifyWhen(
  exp: ClassificationExperiment,
  s: {
    selected: string | null;
    predictions: Record<string, string | undefined>;
    /** 선택한 용액에 시험한 지시약(시험한 순서). */
    tested: readonly string[];
    /** 확인하기를 눌렀다면 그 결과의 종류. */
    checkKind: CheckKind | null;
  },
): ClassifyProbeWhen {
  if (s.checkKind) return s.checkKind;
  const sel = s.selected;
  if (sel && s.tested.length === 0) return 'before-test';
  const pred = sel ? s.predictions[sel] : undefined;
  if (sel && (pred === 'acid' || pred === 'base')) {
    const ev = evidenceGroup(exp, sel, s.tested);
    if (ev !== null && ev !== pred) return 'prediction-mismatch';
  }
  return 'testing';
}

/** 관찰 활동의 튜터 상황 키. 위에서부터 첫 규칙을 적용한다. */
export function observeWhen(s: {
  prediction: string | number | null;
  recorded: string | number | null;
  /** 기록이 기록 당시 조건의 모델 결과와 같은가. 기록이 없으면 null. */
  matchesModel: boolean | null;
}): ObservationProbeWhen {
  if (s.prediction === null) return 'before-observe';
  if (s.recorded === null) return 'observing';
  if (s.matchesModel === false) return 'record-mismatch';
  if (s.recorded !== s.prediction) return 'prediction-mismatch';
  return 'record-match';
}

/**
 * 카드 분류 활동의 튜터 상황 키. 위에서부터 첫 규칙을 적용한다:
 * 두 기준을 끝낸 확인 결과 → 확인 결과 → 기준 없음 → 카드 없음 → 관찰 전 → 분류 중.
 */
export function cardSortWhen(
  exp: CardSortExperiment,
  s: {
    criterion: string | null;
    selected: string | null;
    /** 고른 카드에서 관찰한 특징들. */
    observed: readonly string[];
    /** 확인하기를 눌렀다면 그 결과의 종류. */
    checkKind: string | null;
    /** 객관적 기준을 2개 이상 끝냈는가. */
    finished: boolean;
  },
): CardSortProbeWhen {
  if (s.checkKind === 'check-complete' && s.finished) return 'finished';
  if (s.checkKind) return s.checkKind as CardSortProbeWhen;
  if (!s.criterion) return 'choose-criterion';
  if (!s.selected) return 'pick-card';
  const feature = exp.criteria.find((c) => c.key === s.criterion)?.feature;
  if (feature !== undefined && !s.observed.includes(feature)) return 'before-observe';
  return 'sorting';
}
